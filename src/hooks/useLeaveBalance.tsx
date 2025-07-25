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
  can_apply?: boolean;
  wfh_remaining?: number;
  used_this_year?: number;
  remaining_this_year?: number;
}

// Create a type for the RPC response
interface LeaveBalanceResponse {
  leave_type?: string;
  duration_type?: 'days' | 'hours';
  monthly_allowance?: number;
  used_this_month: number;
  remaining_this_month: number;
  annual_allowance?: number;
  carried_forward?: number;
  allocated_balance?: number;
  used_balance?: number;
  remaining_balance?: number;
  can_apply?: boolean;
  wfh_remaining?: number;
  used_this_year?: number;
  remaining_this_year?: number;
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

        // For Additional work from home, use the updated RPC function that returns annual data
        if (leaveTypeLabel === 'Additional work from home') {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          const { data, error: balanceError } = await supabase
            .rpc('get_monthly_leave_balance', {
              p_user_id: user.id,
              p_leave_type_id: leaveTypeId,
              p_month: currentMonth,
              p_year: currentYear
            });

          if (balanceError) {
            console.error('Error fetching additional WFH balance:', balanceError);
            setError('Could not fetch Additional WFH balance');
            return;
          }

          // Type guard to ensure data is properly typed
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const typedData = data as unknown as LeaveBalanceResponse;
            
            setBalance({
              leave_type: leaveTypeLabel,
              duration_type: 'days',
              monthly_allowance: 0, // Not applicable for annual leave
              used_this_month: 0, // Not applicable for annual leave
              remaining_this_month: typedData.remaining_this_year || 0,
              annual_allowance: typedData.annual_allowance || 24,
              used_this_year: typedData.used_this_year || 0,
              remaining_this_year: typedData.remaining_this_year || 24,
              can_apply: typedData.can_apply,
              wfh_remaining: typedData.wfh_remaining
            });
          }
        }
        // For Short Leave, calculate from actual records
        else if (leaveTypeLabel === 'Short Leave') {
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
        } 
        // For Work From Home, calculate from actual records without carryforward
        else if (leaveTypeLabel === 'Work From Home') {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          // Get all WFH applications for current month
          const { data: wfhLeaves, error: wfhLeavesError } = await supabase
            .from('leave_applied_users')
            .select('actual_days_used, is_half_day, start_date, end_date, status')
            .eq('user_id', user.id)
            .eq('leave_type_id', leaveTypeId)
            .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
            .lt('start_date', currentMonth === 12 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
            .in('status', ['approved', 'pending']);

          if (wfhLeavesError) {
            console.error('Error fetching WFH leaves:', wfhLeavesError);
            setError(wfhLeavesError.message);
            return;
          }

          // Calculate total days used
          const totalDaysUsed = wfhLeaves?.reduce((total, leave) => {
            if (leave.actual_days_used) {
              return total + leave.actual_days_used;
            }
            if (leave.is_half_day) {
              return total + 0.5;
            }
            const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
            return total + daysDiff;
          }, 0) || 0;

          const monthlyAllowanceDays = 2; // 2 days per month for WFH
          const remainingDays = Math.max(0, monthlyAllowanceDays - totalDaysUsed);

          setBalance({
            leave_type: leaveTypeLabel,
            duration_type: 'days',
            monthly_allowance: monthlyAllowanceDays,
            used_this_month: totalDaysUsed,
            remaining_this_month: remainingDays
          });
        }
        // For Paid Leave, calculate from actual records directly with proper half-day handling
        else if (leaveTypeLabel === 'Paid Leave') {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          // Get all Paid Leave applications for current month
          const { data: paidLeaves, error: paidLeavesError } = await supabase
            .from('leave_applied_users')
            .select('actual_days_used, is_half_day, start_date, end_date, status')
            .eq('user_id', user.id)
            .eq('leave_type_id', leaveTypeId)
            .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
            .lt('start_date', currentMonth === 12 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
            .in('status', ['approved', 'pending']);

          if (paidLeavesError) {
            console.error('Error fetching Paid leaves:', paidLeavesError);
            setError(paidLeavesError.message);
            return;
          }

          // Calculate total days used (including half days)
          const totalDaysUsed = paidLeaves?.reduce((total, leave) => {
            if (leave.actual_days_used) {
              return total + leave.actual_days_used;
            }
            if (leave.is_half_day) {
              return total + 0.5;
            }
            const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
            return total + daysDiff;
          }, 0) || 0;

          // Use the RPC function to get proper balance with carryforward
          const { data: balanceData, error: balanceError } = await supabase
            .rpc('get_monthly_leave_balance', {
              p_user_id: user.id,
              p_leave_type_id: leaveTypeId,
              p_month: currentMonth,
              p_year: currentYear
            });

          if (balanceError) {
            console.error('Error fetching balance from RPC:', balanceError);
            // Fallback to direct calculation
            const monthlyAllowanceDays = 1.5; // 1.5 days per month for Paid Leave
            const remainingDays = Math.max(0, monthlyAllowanceDays - totalDaysUsed);

            setBalance({
              leave_type: leaveTypeLabel,
              duration_type: 'days',
              monthly_allowance: monthlyAllowanceDays,
              used_this_month: totalDaysUsed,
              remaining_this_month: remainingDays
            });
          } else {
            // Use RPC response data
            const typedData = balanceData as unknown as LeaveBalanceResponse;
            const remainingBalance = Math.max(0, (typedData.remaining_this_month || 0));

            setBalance({
              leave_type: leaveTypeLabel,
              duration_type: 'days',
              monthly_allowance: typedData.monthly_allowance || 1.5,
              used_this_month: typedData.used_this_month || 0,
              remaining_this_month: remainingBalance,
              carried_forward: typedData.carried_forward || 0
            });
          }
        }
        // For other leave types, use RPC function
        else {
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
            const typedData = data as unknown as LeaveBalanceResponse;
            
            // Ensure remaining balance is never negative
            const remainingBalance = Math.max(0, (typedData.remaining_this_month || typedData.remaining_balance || 0));
            
            // Map the response to our LeaveBalance interface
            setBalance({
              leave_type: leaveTypeLabel,
              duration_type: typedData.duration_type || 'days',
              monthly_allowance: typedData.monthly_allowance || typedData.allocated_balance || 0,
              used_this_month: typedData.used_this_month || typedData.used_balance || 0,
              remaining_this_month: remainingBalance,
              annual_allowance: typedData.annual_allowance || typedData.allocated_balance,
              carried_forward: typedData.carried_forward
            });
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
