
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

        // Check WFH balance
        const { data: wfhBalance, error: balanceError } = await supabase
          .rpc('get_monthly_leave_balance', {
            p_user_id: user.id,
            p_leave_type_id: wfhLeaveType.id,
            p_month: new Date().getMonth() + 1,
            p_year: new Date().getFullYear()
          });

        if (balanceError) throw balanceError;

        // Type cast the response properly
        const typedBalance = wfhBalance as unknown as WFHBalanceResponse;
        const remaining = typedBalance?.remaining_this_month || 0;
        
        setWfhRemaining(remaining);
        setCanApply(remaining <= 0);
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
