
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

        // Get leave type info first
        const { data: leaveTypeData, error: leaveTypeError } = await supabase
          .from('leave_types')
          .select('label')
          .eq('id', leaveTypeId)
          .single();

        if (leaveTypeError) {
          console.error('Error fetching leave type:', leaveTypeError);
          setError(leaveTypeError.message);
          return;
        }

        const leaveTypeLabel = leaveTypeData?.label;

        // For Short Leave, calculate from actual records
        if (leaveTypeLabel === 'Short Leave') {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          // Get all short leave applications for current month
          const { data: shortLeaves, error: shortLeavesError } = await supabase
            .from('leave_applied_users')
            .select('hours_requested, status')
            .eq('user_id', user.id)
            .eq('leave_type_id', leaveTypeId)
            .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
            .lt('start_date', currentMonth === 12 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
            .in('status', ['approved', 'pending']);

          if (shortLeavesError) {
            console.error('Error fetching short leaves:', shortLeavesError);
            setError(shortLeavesError.message);
            return;
          }

          // Calculate total hours used
          const totalHoursUsed = shortLeaves?.reduce((total, leave) => {
            return total + (leave.hours_requested || 1);
          }, 0) || 0;

          const monthlyAllowanceHours = 4; // 4 hours per month for short leave
          const remainingHours = Math.max(0, monthlyAllowanceHours - totalHoursUsed);

          setBalance({
            leave_type: leaveTypeLabel,
            duration_type: 'hours',
            monthly_allowance: monthlyAllowanceHours,
            used_this_month: totalHoursUsed,
            remaining_this_month: remainingHours
          });
        } else {
          // For other leave types, use the existing RPC function
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
            const typedData = data as unknown as LeaveBalance;
            setBalance(typedData);
          } else {
            setError('Invalid balance data received');
          }
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
