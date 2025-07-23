
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';

interface WFHBalanceResponse {
  remaining_this_month: number;
  used_this_month: number;
  monthly_allowance: number;
  leave_type: string;
  duration_type: string;
}

export const useAdditionalWFHValidation = (leaveTypeId: string) => {
  const { user } = useUser();
  const [canApply, setCanApply] = useState(false);
  const [wfhRemaining, setWfhRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !leaveTypeId) return;

    const checkWFHStatus = async () => {
      try {
        setLoading(true);
        
        // Get the Work From Home leave type ID
        const { data: wfhLeaveType, error: wfhError } = await supabase
          .from('leave_types')
          .select('id')
          .eq('label', 'Work From Home')
          .single();

        if (wfhError) throw wfhError;

        // Get current month's WFH usage
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const { data: wfhLeaves, error: wfhLeavesError } = await supabase
          .from('leave_applied_users')
          .select('actual_days_used, is_half_day, start_date, end_date')
          .eq('user_id', user.id)
          .eq('leave_type_id', wfhLeaveType.id)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        if (wfhLeavesError) throw wfhLeavesError;

        // Calculate total regular WFH days used
        const totalWfhDaysUsed = wfhLeaves?.reduce((total, leave) => {
          if (leave.actual_days_used) {
            return total + leave.actual_days_used;
          }
          if (leave.is_half_day) {
            return total + 0.5;
          }
          const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
          return total + daysDiff;
        }, 0) || 0;

        const remainingWfh = Math.max(0, 2 - totalWfhDaysUsed);
        setWfhRemaining(remainingWfh);
        
        // Additional WFH can only be applied when regular WFH is exhausted (remaining <= 0)
        setCanApply(remainingWfh <= 0);
      } catch (error) {
        console.error('Error checking WFH status:', error);
        setCanApply(false);
      } finally {
        setLoading(false);
      }
    };

    checkWFHStatus();
  }, [user?.id, leaveTypeId]);

  return { canApply, wfhRemaining, loading };
};
