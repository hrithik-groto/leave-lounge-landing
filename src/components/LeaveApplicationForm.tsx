
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { format, isAfter, isBefore, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { useLeaveOverlapValidation } from "@/hooks/useLeaveOverlapValidation";
import { Checkbox } from "@/components/ui/checkbox";

interface LeaveType {
  id: string;
  label: string;
  color: string;
}

interface LeaveApplicationFormProps {
  onSuccess?: () => void;
}

const LeaveApplicationForm: React.FC<LeaveApplicationFormProps> = ({ onSuccess }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [wfhRemaining, setWfhRemaining] = useState(2);
  const [wfhLoading, setWfhLoading] = useState(false);
  const [wfhBalanceChecked, setWfhBalanceChecked] = useState(false);
  const [additionalWfhUsed, setAdditionalWfhUsed] = useState(0);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'morning' | 'afternoon'>('morning');
  const [hoursRequested, setHoursRequested] = useState<number>(1);

  const { user } = useUser();
  const selectedLeaveType = leaveTypes.find(type => type.id === leaveTypeId);
  
  // Use overlap validation hook
  const { validationResult, loading: validationLoading } = useLeaveOverlapValidation(
    startDate,
    endDate,
    isHalfDay,
    halfDayPeriod
  );

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    if (user?.id) {
      checkWFHBalance();
    }
  }, [user?.id]);

  // Auto-set end date to start date for half-day leaves
  useEffect(() => {
    if (isHalfDay && startDate) {
      setEndDate(startDate);
    }
  }, [isHalfDay, startDate]);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast.error('Failed to load leave types');
    }
  };

  const checkWFHBalance = async () => {
    if (!user?.id) return;

    try {
      setWfhLoading(true);
      
      // Get the Work From Home leave type ID
      const { data: wfhLeaveType, error: wfhError } = await supabase
        .from('leave_types')
        .select('id')
        .eq('label', 'Work From Home')
        .single();

      if (wfhError) {
        console.error('Error finding WFH leave type:', wfhError);
        setWfhRemaining(0);
        setWfhBalanceChecked(true);
        return;
      }

      // Get the Additional Work From Home leave type ID
      const { data: additionalWfhLeaveType, error: additionalWfhError } = await supabase
        .from('leave_types')
        .select('id')
        .eq('label', 'Additional work from home')
        .single();

      // Check regular WFH balance
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

      if (wfhLeavesError) {
        console.error('Error fetching WFH leaves:', wfhLeavesError);
        setWfhRemaining(2);
        setWfhBalanceChecked(true);
        return;
      }

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

      // Check Additional WFH usage if available
      if (!additionalWfhError && additionalWfhLeaveType) {
        const { data: additionalWfhLeaves, error: additionalWfhLeavesError } = await supabase
          .from('leave_applied_users')
          .select('actual_days_used, is_half_day, start_date, end_date')
          .eq('user_id', user.id)
          .eq('leave_type_id', additionalWfhLeaveType.id)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        if (!additionalWfhLeavesError) {
          const totalAdditionalWfhDaysUsed = additionalWfhLeaves?.reduce((total, leave) => {
            if (leave.actual_days_used) {
              return total + leave.actual_days_used;
            }
            if (leave.is_half_day) {
              return total + 0.5;
            }
            const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
            return total + daysDiff;
          }, 0) || 0;

          setAdditionalWfhUsed(totalAdditionalWfhDaysUsed);
        }
      }
      
      setWfhBalanceChecked(true);
    } catch (error) {
      console.error('Error checking WFH status:', error);
      setWfhRemaining(2);
      setWfhBalanceChecked(true);
    } finally {
      setWfhLoading(false);
    }
  };

  // Filter leave types based on WFH exhaustion
  const getAvailableLeaveTypes = () => {
    if (!wfhBalanceChecked) return [];
    
    return leaveTypes.filter(type => {
      if (type.label !== 'Additional work from home') {
        return true;
      }
      
      const canShowAdditionalWFH = wfhRemaining <= 0;
      return canShowAdditionalWFH;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('Please sign in to submit leave application');
      return;
    }

    if (!startDate || !endDate || !leaveTypeId || !reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isAfter(startDate, endDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }

    // Check for conflicts
    if (!validationResult.canApply) {
      toast.error(validationResult.message || 'Cannot apply for leave on the selected dates');
      return;
    }

    setIsSubmitting(true);

    try {
      let actualDaysUsed = 1;
      let leaveTimeStart = null;
      let leaveTimeEnd = null;

      // Handle different leave types
      if (selectedLeaveType?.label === 'Short Leave') {
        actualDaysUsed = hoursRequested / 8; // Convert hours to days
      } else if (isHalfDay) {
        actualDaysUsed = 0.5;
        if (halfDayPeriod === 'morning') {
          leaveTimeStart = '10:00:00';
          leaveTimeEnd = '14:00:00';
        } else {
          leaveTimeStart = '14:00:00';
          leaveTimeEnd = '18:30:00';
        }
      } else {
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
        actualDaysUsed = daysDiff;
      }

      const submissionData = {
        user_id: user.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        leave_type_id: leaveTypeId,
        reason: reason.trim(),
        status: 'pending' as const,
        is_half_day: isHalfDay,
        leave_time_start: leaveTimeStart,
        leave_time_end: leaveTimeEnd,
        actual_days_used: actualDaysUsed,
        hours_requested: selectedLeaveType?.label === 'Short Leave' ? hoursRequested : 0
      };

      console.log('Submitting leave application with data:', submissionData);

      const { data, error } = await supabase
        .from('leave_applied_users')
        .insert(submissionData)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Leave application submitted successfully:', data);

      toast.success('Leave application submitted successfully!');
      
      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
      setLeaveTypeId("");
      setReason("");
      setIsHalfDay(false);
      setHoursRequested(1);
      
      // Refresh WFH balance after submission
      checkWFHBalance();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast.error('Failed to submit leave application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableLeaveTypes = getAvailableLeaveTypes();

  return (
    <div className="max-h-[80vh] overflow-y-auto p-1">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto p-4">
        {/* WFH Status Messages */}
        {wfhRemaining <= 0 && additionalWfhUsed > 0 && !selectedLeaveType && (
          <div className="p-3 rounded-md text-sm bg-yellow-50 border border-yellow-200 text-yellow-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                You have exhausted your additional work from home quota for this month. Please wait for next month to get 0 new days.
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="leave-type">Leave Type *</Label>
          <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select leave type" />
            </SelectTrigger>
            <SelectContent>
              {availableLeaveTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    {type.label}
                    {type.label === 'Additional work from home' && (
                      <span className="text-xs text-orange-600 font-medium">(Activated)</span>
                    )}
                  </div>
                </SelectItem>
              ))}
              {availableLeaveTypes.length === 0 && wfhBalanceChecked && (
                <SelectItem value="disabled" disabled>
                  No leave types available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          
          {/* Leave Type Specific Messages */}
          {selectedLeaveType?.label === 'Additional work from home' && wfhRemaining > 0 && (
            <div className="mt-2 p-3 rounded-md text-sm bg-yellow-50 border border-yellow-200 text-yellow-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Your current Work from Home quota is still left, please use those first.
                </span>
              </div>
            </div>
          )}

          {selectedLeaveType?.label === 'Additional work from home' && wfhRemaining <= 0 && (
            <div className="mt-2 p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800">
              <div className="flex items-center gap-2">
                <span>
                  ✓ Additional Work From Home is now available as your regular WFH quota (2 days/month) has been exhausted. You can apply for unlimited additional WFH days.
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-green-300">
                <span className="font-medium">Additional WFH used this month: {additionalWfhUsed} days</span>
              </div>
            </div>
          )}

          {selectedLeaveType?.label === 'Work From Home' && wfhBalanceChecked && (
            <div className="mt-2 p-3 rounded-md text-sm bg-blue-50 border border-blue-200 text-blue-800">
              <span>
                You have {wfhRemaining} days of regular Work From Home remaining this month (2 days/month limit).
              </span>
            </div>
          )}

          {wfhRemaining <= 0 && wfhBalanceChecked && !selectedLeaveType && (
            <div className="mt-2 p-3 rounded-md text-sm bg-orange-50 border border-orange-200 text-orange-800">
              <span>
                Your regular Work From Home quota is exhausted. "Additional work from home" is now available in the dropdown with no monthly limit.
              </span>
            </div>
          )}

          {wfhLoading && (
            <div className="mt-2 p-3 rounded-md text-sm bg-gray-50 border border-gray-200 text-gray-600">
              <span>Checking Work From Home balance...</span>
            </div>
          )}
        </div>

        {/* Short Leave Hours Input */}
        {selectedLeaveType?.label === 'Short Leave' && (
          <div className="space-y-2">
            <Label htmlFor="hours">Hours Requested *</Label>
            <Select value={hoursRequested.toString()} onValueChange={(value) => setHoursRequested(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select hours" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {hour} hour{hour > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Half Day Checkbox (only for applicable leave types) */}
        {selectedLeaveType && !['Short Leave', 'Additional work from home'].includes(selectedLeaveType.label) && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="halfDay" 
                checked={isHalfDay} 
                onCheckedChange={setIsHalfDay}
              />
              <Label htmlFor="halfDay">Half Day Leave</Label>
            </div>
            
            {isHalfDay && (
              <div className="space-y-2">
                <Label>Half Day Period *</Label>
                <Select value={halfDayPeriod} onValueChange={(value: 'morning' | 'afternoon') => setHalfDayPeriod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (10:00 AM - 2:00 PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (2:00 PM - 6:30 PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Start Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Pick start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={(date) => isBefore(date, new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date (hidden for half day leaves) */}
        {!isHalfDay && selectedLeaveType?.label !== 'Short Leave' && (
          <div className="space-y-2">
            <Label>End Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => startDate ? isBefore(date, startDate) : isBefore(date, new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Overlap Validation Messages */}
        {validationLoading && (
          <div className="p-3 rounded-md text-sm bg-gray-50 border border-gray-200 text-gray-600">
            <span>Checking for conflicts...</span>
          </div>
        )}

        {!validationResult.canApply && validationResult.message && (
          <div className="p-3 rounded-md text-sm bg-red-50 border border-red-200 text-red-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{validationResult.message}</span>
            </div>
          </div>
        )}

        {/* Show available slots for single day applications */}
        {startDate && endDate && isSameDay(startDate, endDate) && validationResult.canApply && (
          <div className="p-3 rounded-md text-sm bg-blue-50 border border-blue-200 text-blue-800">
            <div className="space-y-1">
              <span className="font-medium">Available slots for {format(startDate, "PPP")}:</span>
              <div className="flex gap-2">
                {validationResult.availableSlots.morning && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Morning</span>
                )}
                {validationResult.availableSlots.afternoon && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Afternoon</span>
                )}
                {validationResult.availableSlots.fullDay && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Full Day</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">Reason *</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please provide a reason for your leave"
            rows={4}
            required
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isSubmitting || !validationResult.canApply}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </Button>
      </form>
    </div>
  );
};

export default LeaveApplicationForm;
