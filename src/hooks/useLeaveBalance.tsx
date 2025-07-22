
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';

interface LeaveBalance {
  leave_type: string;
  duration_type: 'days' | 'hours';
  monthly_allowance: number;
  used_this_month: number;
  remaining_this_month: number;
  annual_allowance?: number;
  carried_forward?: number;
}

export const useLeaveBalance = (leaveTypeId: string, refreshTrigger?: number) => {
  const { user } = useUser();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !leaveTypeId) {
      setLoading(false);
      return;
    }

    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: balanceError } = await supabase
          .rpc('get_monthly_leave_balance', {
            p_user_id: user.id,
            p_leave_type_id: leaveTypeId,
            p_month: new Date().getMonth() + 1,
            p_year: new Date().getFullYear()
          });

        if (balanceError) {
          console.error('Error fetching leave balance:', balanceError);
          setError(balanceError.message);
          return;
        }

        // Type guard to ensure data is properly typed
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const typedData = data as LeaveBalance;
          setBalance(typedData);
        } else {
          setError('Invalid balance data received');
        }
      } catch (err) {
        console.error('Error in fetchBalance:', err);
        setError('Failed to fetch leave balance');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [user?.id, leaveTypeId, refreshTrigger]);

  return { balance, loading, error, refetch: () => setBalance(null) };
};
