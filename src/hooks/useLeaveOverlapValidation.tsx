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

      // Check for conflicts day by day
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayConflicts = conflicts.filter(leave => {
          const leaveStart = new Date(leave.start_date);
          const leaveEnd = new Date(leave.end_date);
          return currentDate >= leaveStart && currentDate <= leaveEnd;
        });

        if (dayConflicts.length > 0) {
          // Check if applying for the same day
          if (isSameDay(startDate, endDate)) {
            // Single day application
            const dayConflict = dayConflicts[0];
            
            if (!dayConflict.is_half_day) {
              // Existing full day leave - cannot apply for anything
              canApply = false;
              message = `You already have a full day leave on ${format(currentDate, 'PPP')}`;
              availableSlots = {
                morning: false,
                afternoon: false,
                fullDay: false
              };
              break;
            } else {
              // Existing half day leave
              const existingPeriod = dayConflict.leave_time_start === '10:00:00' ? 'morning' : 'afternoon';
              
              if (isHalfDay && halfDayPeriod === existingPeriod) {
                // Trying to apply for the same half day period
                canApply = false;
                message = `You already have a ${existingPeriod} leave on ${format(currentDate, 'PPP')}`;
              } else if (!isHalfDay) {
                // Trying to apply for full day when half day exists
                canApply = false;
                message = `You already have a ${existingPeriod} leave on ${format(currentDate, 'PPP')}. Cannot apply for full day.`;
              }
              
              // Update available slots
              availableSlots = {
                morning: existingPeriod !== 'morning',
                afternoon: existingPeriod !== 'afternoon',
                fullDay: false
              };
            }
          } else {
            // Multi-day application with conflicts
            canApply = false;
            message = `You have existing leave applications that overlap with the selected dates`;
            availableSlots = {
              morning: false,
              afternoon: false,
              fullDay: false
            };
            break;
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
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
