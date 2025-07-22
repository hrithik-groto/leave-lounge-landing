
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { isSameDay, isAfter, isBefore } from 'date-fns';

interface ExistingLeave {
  id: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  leave_time_start: string | null;
  leave_time_end: string | null;
  status: string;
  leave_types: {
    label: string;
  } | null;
}

interface OverlapValidationResult {
  canApply: boolean;
  conflictingLeaves: ExistingLeave[];
  availableTimeSlots: Array<{
    period: 'morning' | 'afternoon' | 'full';
    startTime: string;
    endTime: string;
  }>;
  errorMessage?: string;
}

export const useLeaveOverlapValidation = () => {
  const { user } = useUser();
  const [existingLeaves, setExistingLeaves] = useState<ExistingLeave[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExistingLeaves = async (startDate: Date, endDate: Date) => {
    if (!user?.id) return [];

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          id,
          start_date,
          end_date,
          is_half_day,
          leave_time_start,
          leave_time_end,
          status,
          leave_types (
            label
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['approved', 'pending'])
        .or(`start_date.lte.${endDate.toISOString().split('T')[0]},end_date.gte.${startDate.toISOString().split('T')[0]}`);

      if (error) throw error;
      
      const leaves = (data as ExistingLeave[]) || [];
      setExistingLeaves(leaves);
      return leaves;
    } catch (error) {
      console.error('Error fetching existing leaves:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const validateLeaveOverlap = async (
    startDate: Date,
    endDate: Date,
    isHalfDay: boolean = false,
    halfDayPeriod: 'morning' | 'afternoon' = 'morning'
  ): Promise<OverlapValidationResult> => {
    const existingLeaves = await fetchExistingLeaves(startDate, endDate);
    
    // Check for conflicts on each requested day
    const conflictingLeaves: ExistingLeave[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayConflicts = existingLeaves.filter(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        
        return (
          (isSameDay(currentDate, leaveStart) || isSameDay(currentDate, leaveEnd)) ||
          (isAfter(currentDate, leaveStart) && isBefore(currentDate, leaveEnd))
        );
      });

      for (const conflict of dayConflicts) {
        const conflictStart = new Date(conflict.start_date);
        const conflictEnd = new Date(conflict.end_date);
        
        // If it's the same day, check for time conflicts
        if (isSameDay(currentDate, conflictStart) && isSameDay(conflictStart, conflictEnd)) {
          // If existing leave is full day, no new leave can be applied
          if (!conflict.is_half_day) {
            conflictingLeaves.push(conflict);
            continue;
          }
          
          // If new leave is full day and existing is half day, conflict
          if (!isHalfDay) {
            conflictingLeaves.push(conflict);
            continue;
          }
          
          // Both are half day - check if they're in the same period
          if (isHalfDay && conflict.is_half_day) {
            const existingPeriod = getHalfDayPeriod(conflict.leave_time_start, conflict.leave_time_end);
            if (existingPeriod === halfDayPeriod) {
              conflictingLeaves.push(conflict);
            }
          }
        } else {
          // Multi-day leave conflict
          conflictingLeaves.push(conflict);
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate available time slots for single day applications
    const availableTimeSlots = [];
    if (isSameDay(startDate, endDate)) {
      const dayLeaves = existingLeaves.filter(leave => 
        isSameDay(new Date(leave.start_date), startDate) && 
        isSameDay(new Date(leave.end_date), startDate)
      );
      
      const hasFullDay = dayLeaves.some(leave => !leave.is_half_day);
      const hasMorning = dayLeaves.some(leave => 
        leave.is_half_day && getHalfDayPeriod(leave.leave_time_start, leave.leave_time_end) === 'morning'
      );
      const hasAfternoon = dayLeaves.some(leave => 
        leave.is_half_day && getHalfDayPeriod(leave.leave_time_start, leave.leave_time_end) === 'afternoon'
      );

      if (!hasFullDay) {
        if (!hasMorning) {
          availableTimeSlots.push({
            period: 'morning' as const,
            startTime: '10:00:00',
            endTime: '14:00:00'
          });
        }
        if (!hasAfternoon) {
          availableTimeSlots.push({
            period: 'afternoon' as const,
            startTime: '14:00:00',
            endTime: '18:30:00'
          });
        }
        if (!hasMorning && !hasAfternoon) {
          availableTimeSlots.push({
            period: 'full' as const,
            startTime: '10:00:00',
            endTime: '18:30:00'
          });
        }
      }
    } else {
      // Multi-day application
      availableTimeSlots.push({
        period: 'full' as const,
        startTime: '10:00:00',
        endTime: '18:30:00'
      });
    }

    const canApply = conflictingLeaves.length === 0;
    let errorMessage = '';

    if (!canApply) {
      const conflictTypes = [...new Set(conflictingLeaves.map(leave => leave.leave_types?.label || 'Unknown'))];
      errorMessage = `You already have ${conflictTypes.join(', ')} applied for the selected date(s). Please choose different dates or cancel existing applications.`;
    }

    return {
      canApply,
      conflictingLeaves,
      availableTimeSlots,
      errorMessage
    };
  };

  const getHalfDayPeriod = (startTime: string | null, endTime: string | null): 'morning' | 'afternoon' => {
    if (!startTime) return 'morning';
    const hour = parseInt(startTime.split(':')[0]);
    return hour < 14 ? 'morning' : 'afternoon';
  };

  return {
    validateLeaveOverlap,
    fetchExistingLeaves,
    existingLeaves,
    loading
  };
};
