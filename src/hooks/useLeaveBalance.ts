
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
    if (!user?.id || !leaveTypeId) {
      setLoading(false);
      return;
    }

    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentDate = new Date();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        console.log('Fetching balance for:', { userId: user.id, leaveTypeId, month, year });

        const { data, error: rpcError } = await supabase
          .rpc('get_monthly_leave_balance', {
            p_user_id: user.id,
            p_leave_type_id: leaveTypeId,
            p_month: month,
            p_year: year
          });

        if (rpcError) {
          console.error('RPC Error:', rpcError);
          setError('Failed to load balance: ' + rpcError.message);
          return;
        }

        console.log('RPC response:', data);

        // Properly handle the type conversion from Supabase Json to LeaveBalance
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // Validate that the data has the expected structure
          const typedData = data as unknown as LeaveBalance;
          
          // Ensure all required fields are present and properly typed
          const validatedBalance: LeaveBalance = {
            leave_type: typedData.leave_type || 'Unknown',
            duration_type: typedData.duration_type || 'days',
            monthly_allowance: Number(typedData.monthly_allowance) || 0,
            used_this_month: Number(typedData.used_this_month) || 0,
            remaining_this_month: Number(typedData.remaining_this_month) || 0,
            carried_forward: typedData.carried_forward ? Number(typedData.carried_forward) : undefined,
            annual_allowance: typedData.annual_allowance ? Number(typedData.annual_allowance) : undefined,
            can_apply: typedData.can_apply,
            wfh_remaining: typedData.wfh_remaining ? Number(typedData.wfh_remaining) : undefined
          };

          console.log('Validated balance:', validatedBalance);
          setBalance(validatedBalance);
        } else {
          console.error('Invalid data structure:', data);
          setError('Invalid balance data received from server');
        }
      } catch (err) {
        console.error('Error in useLeaveBalance:', err);
        setError('Failed to load balance: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [user?.id, leaveTypeId, refreshTrigger]);

  return { balance, loading, error };
};
