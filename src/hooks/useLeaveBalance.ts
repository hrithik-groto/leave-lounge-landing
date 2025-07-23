
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';

interface LeaveBalance {
  leave_type: string;
  duration_type: string;
  monthly_allowance: number;
  used_this_month: number;
  remaining_this_month: number;
  carried_forward?: number;
  annual_allowance?: number;
  can_apply?: boolean;
  wfh_remaining?: number;
}

export const useLeaveBalance = (leaveTypeId: string, refreshTrigger?: number) => {
  const { user } = useUser();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !leaveTypeId) return;

    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentDate = new Date();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        const { data, error: rpcError } = await supabase
          .rpc('get_monthly_leave_balance', {
            p_user_id: user.id,
            p_leave_type_id: leaveTypeId,
            p_month: month,
            p_year: year
          });

        if (rpcError) {
          console.error('Error fetching leave balance:', rpcError);
          setError('Failed to load balance');
          return;
        }

        setBalance(data);
      } catch (err) {
        console.error('Error in useLeaveBalance:', err);
        setError('Failed to load balance');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [user?.id, leaveTypeId, refreshTrigger]);

  return { balance, loading, error };
};
