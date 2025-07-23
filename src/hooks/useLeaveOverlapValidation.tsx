
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { isSameDay, format } from 'date-fns';

interface ExistingLeave {
  id: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  leave_time_start: string | null;
  leave_time_end: string | null;
  status: string;
  leave_type_id: string;
  actual_days_used: number;
}

interface OverlapValidationResult {
  canApply: boolean;
  conflicts: ExistingLeave[];
  availableSlots: {
    morning: boolean;
    afternoon: boolean;
    fullDay: boolean;
  };
  message?: string;
}

export const useLeaveOverlapValidation = (
  startDate?: Date,
  endDate?: Date,
  isHalfDay?: boolean,
  halfDayPeriod?: 'morning' | 'afternoon'
) => {
  const { user } = useUser();
  const [validationResult, setValidationResult] = useState<OverlapValidationResult>({
    canApply: true,
    conflicts: [],
    availableSlots: {
      morning: true,
      afternoon: true,
      fullDay: true
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !startDate || !endDate) {
      setValidationResult({
        canApply: true,
        conflicts: [],
        availableSlots: {
          morning: true,
          afternoon: true,
          fullDay: true
        }
      });
      return;
    }

    validateLeaveOverlap();
  }, [user?.id, startDate, endDate, isHalfDay, halfDayPeriod]);

  const validateLeaveOverlap = async () => {
    if (!user?.id || !startDate || !endDate) return;

    setLoading(true);
    try {
      // Get all existing leave applications that might overlap
      const { data: existingLeaves, error } = await supabase
        .from('leave_applied_users')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['approved', 'pending'])
        .gte('end_date', format(startDate, 'yyyy-MM-dd'))
        .lte('start_date', format(endDate, 'yyyy-MM-dd'));

      if (error) {
        console.error('Error fetching existing leaves:', error);
        return;
      }

      const conflicts = existingLeaves || [];
      let canApply = true;
      let message = '';
      let availableSlots = {
        morning: true,
        afternoon: true,
        fullDay: true
      };

      // For single day applications, check available slots
      if (isSameDay(startDate, endDate)) {
        const dayConflicts = conflicts.filter(leave => {
          const leaveStart = new Date(leave.start_date);
          const leaveEnd = new Date(leave.end_date);
          return isSameDay(startDate, leaveStart) || (startDate >= leaveStart && startDate <= leaveEnd);
        });

        if (dayConflicts.length > 0) {
          const fullDayConflict = dayConflicts.find(leave => !leave.is_half_day);
          
          if (fullDayConflict) {
            // Full day conflict - no slots available
            canApply = false;
            message = `You already have a full day leave on ${format(startDate, 'PPP')}`;
            availableSlots = {
              morning: false,
              afternoon: false,
              fullDay: false
            };
          } else {
            // Only half day conflicts
            const morningConflict = dayConflicts.find(leave => 
              leave.is_half_day && leave.leave_time_start === '10:00:00'
            );
            const afternoonConflict = dayConflicts.find(leave => 
              leave.is_half_day && leave.leave_time_start === '14:00:00'
            );

            availableSlots = {
              morning: !morningConflict,
              afternoon: !afternoonConflict,
              fullDay: false // Can't apply full day if any half day exists
            };

            // Check if the requested slot is available
            if (isHalfDay && halfDayPeriod) {
              const requestedSlotTaken = (halfDayPeriod === 'morning' && morningConflict) || 
                                       (halfDayPeriod === 'afternoon' && afternoonConflict);
              
              if (requestedSlotTaken) {
                canApply = false;
                message = `You already have a ${halfDayPeriod} leave on ${format(startDate, 'PPP')}`;
              }
            } else if (!isHalfDay) {
              // Trying to apply full day when half days exist
              canApply = false;
              message = `You already have partial leave on ${format(startDate, 'PPP')}. Cannot apply for full day.`;
            }
          }
        }
      } else {
        // Multi-day application
        if (conflicts.length > 0) {
          canApply = false;
          message = 'You have existing leave applications that overlap with the selected dates';
          availableSlots = {
            morning: false,
            afternoon: false,
            fullDay: false
          };
        }
      }

      setValidationResult({
        canApply,
        conflicts,
        availableSlots,
        message
      });

    } catch (error) {
      console.error('Error validating leave overlap:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    validationResult,
    loading,
    refetch: validateLeaveOverlap
  };
};
