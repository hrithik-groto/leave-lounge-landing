
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarIcon, Clock, AlertCircle } from "lucide-react";
import { format, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@clerk/clerk-react";
import { LeaveBalanceDisplay } from "./LeaveBalanceDisplay";
import { useLeaveBalance } from "@/hooks/useLeaveBalance";

interface LeaveType {
  id: string;
  label: string;
  color: string;
  requires_approval: boolean;
}

interface CompanyHoliday {
  id: string;
  name: string;
  date: string;
}

interface EnhancedLeaveApplicationFormProps {
  onSuccess?: () => void;
}

export const EnhancedLeaveApplicationForm: React.FC<EnhancedLeaveApplicationFormProps> = ({ onSuccess }) => {
  const { user } = useUser();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [companyHolidays, setCompanyHolidays] = useState<CompanyHoliday[]>([]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'morning' | 'afternoon'>('morning');
  const [hoursRequested, setHoursRequested] = useState(1);
  const [holidayName, setHolidayName] = useState("");
  const [meetingDetails, setMeetingDetails] = useState("");
  const [balanceRefreshTrigger, setBalanceRefreshTrigger] = useState(0);

  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
  const { balance: leaveBalance, loading: balanceLoading } = useLeaveBalance(leaveTypeId, balanceRefreshTrigger);

  useEffect(() => {
    fetchLeaveTypes();
    fetchCompanyHolidays();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('label');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast.error('Failed to load leave types');
    }
  };

  const fetchCompanyHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setCompanyHolidays(data || []);
    } catch (error) {
      console.error('Error fetching company holidays:', error);
    }
  };

  const calculateLeaveDuration = () => {
    if (!startDate || !endDate) return 0;
    
    if (selectedLeaveType?.label === 'Short Leave') {
      return hoursRequested;
    }
    
    if (isHalfDay && (selectedLeaveType?.label === 'Paid Leave' || selectedLeaveType?.label === 'Annual Leave')) {
      return 0.5;
    }
    
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    return daysDiff;
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  };

  const isCompanyHoliday = (date: Date) => {
    return companyHolidays.some(holiday => 
      isSameDay(new Date(holiday.date), date)
    );
  };

  const canApplyForLeave = () => {
    if (!leaveBalance || balanceLoading) return false;
    
    if (selectedLeaveType?.label === 'Paid Leave') {
      const requestedDays = calculateLeaveDuration();
      return leaveBalance.remaining_this_month >= requestedDays;
    }
    
    if (selectedLeaveType?.label === 'Short Leave') {
      const requestedHours = calculateLeaveDuration();
      return leaveBalance.remaining_this_month >= requestedHours;
    }
    
    return true;
  };

  const getLeaveValidationMessage = () => {
    if (!leaveBalance || !selectedLeaveType) return null;
    
    if (selectedLeaveType.label === 'Paid Leave') {
      const requestedDays = calculateLeaveDuration();
      const remaining = leaveBalance.remaining_this_month;
      
      if (remaining <= 0) {
        return "You have exhausted your paid leave quota for this month. Please wait for next month.";
      }
      
      if (requestedDays > remaining) {
        return `You can only apply for ${remaining} more days this month (requested: ${requestedDays} days).`;
      }
    }
    
    if (selectedLeaveType.label === 'Short Leave') {
      const requestedHours = calculateLeaveDuration();
      const remaining = leaveBalance.remaining_this_month;
      
      if (remaining <= 0) {
        return "You have exhausted your short leave quota for this month. Please wait for next month to get 4 new short leaves.";
      }
      
      if (requestedHours > remaining) {
        return `You can only apply for ${remaining} more hours this month (requested: ${requestedHours} hours).`;
      }
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to submit a leave application');
      return;
    }

    if (!startDate || !endDate || !leaveTypeId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!canApplyForLeave()) {
      toast.error(getLeaveValidationMessage() || 'Cannot apply for leave');
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionData = {
        user_id: user.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        leave_type_id: leaveTypeId,
        reason: reason.trim(),
        status: 'pending' as const,
        is_half_day: isHalfDay,
        actual_days_used: calculateLeaveDuration(),
        hours_requested: selectedLeaveType?.label === 'Short Leave' ? hoursRequested : 0,
        leave_duration_type: selectedLeaveType?.label === 'Short Leave' ? 'hours' as const : 'days' as const,
        leave_time_start: isHalfDay ? (halfDayPeriod === 'morning' ? '10:00:00' : '14:00:00') : null,
        leave_time_end: isHalfDay ? (halfDayPeriod === 'morning' ? '14:00:00' : '18:30:00') : null,
        holiday_name: holidayName.trim() || null,
        meeting_details: meetingDetails.trim() || null
      };

      console.log('Submitting leave application with data:', submissionData);

      const { data, error } = await supabase
        .from('leave_applied_users')
        .insert(submissionData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        if (error.message.includes('monthly limit') || error.message.includes('quota')) {
          toast.error(error.message);
        } else {
          toast.error('Failed to submit leave application: ' + error.message);
        }
        return;
      }

      toast.success('Leave application submitted successfully!');
      
      setStartDate(undefined);
      setEndDate(undefined);
      setLeaveTypeId("");
      setReason("");
      setIsHalfDay(false);
      setHalfDayPeriod('morning');
      setHoursRequested(1);
      setHolidayName("");
      setMeetingDetails("");
      setBalanceRefreshTrigger(prev => prev + 1);

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validationMessage = getLeaveValidationMessage();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Apply for Leave
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Leave Balance Display */}
          {leaveTypeId && (
            <div className="w-full">
              <LeaveBalanceDisplay 
                leaveTypeId={leaveTypeId}
                leaveTypeName={selectedLeaveType?.label || 'Selected Leave Type'}
                refreshTrigger={balanceRefreshTrigger}
              />
            </div>
          )}

          {/* Validation Message */}
          {validationMessage && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">{validationMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Leave Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="leave-type">Leave Type *</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      disabled={(date) => isBefore(date, new Date()) || isWeekend(date) || isCompanyHoliday(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

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
                      disabled={(date) => 
                        !startDate || 
                        isBefore(date, startDate) || 
                        isWeekend(date) || 
                        isCompanyHoliday(date)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Half Day Option for Paid Leave and Annual Leave */}
            {(selectedLeaveType?.label === 'Paid Leave' || selectedLeaveType?.label === 'Annual Leave') && 
             startDate && endDate && isSameDay(startDate, endDate) && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="half-day" 
                    checked={isHalfDay}
                    onCheckedChange={(checked) => setIsHalfDay(checked === true)}
                  />
                  <Label htmlFor="half-day">Half Day Leave</Label>
                </div>
                
                {isHalfDay && (
                  <RadioGroup 
                    value={halfDayPeriod} 
                    onValueChange={(value: 'morning' | 'afternoon') => setHalfDayPeriod(value)}
                    className="ml-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="morning" id="morning" />
                      <Label htmlFor="morning">Morning (10:00 AM - 2:00 PM)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="afternoon" id="afternoon" />
                      <Label htmlFor="afternoon">Afternoon (2:00 PM - 6:30 PM)</Label>
                    </div>
                  </RadioGroup>
                )}
              </div>
            )}

            {/* Hours Requested for Short Leave */}
            {selectedLeaveType?.label === 'Short Leave' && (
              <div className="space-y-2">
                <Label htmlFor="hours">Hours Requested *</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="hours"
                    type="number"
                    min="1"
                    max="4"
                    value={hoursRequested}
                    onChange={(e) => setHoursRequested(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">hours (max 4 per month)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: You get 4 hours of short leave per month. Each application can be for 1 hour.
                </p>
              </div>
            )}

            {/* Duration Display */}
            {startDate && endDate && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm">
                  <strong>Duration:</strong> {calculateLeaveDuration()} {selectedLeaveType?.label === 'Short Leave' ? 'hours' : 'days'}
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for your leave request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
                required
              />
            </div>

            {/* Optional Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="holiday-name">Holiday/Event Name (Optional)</Label>
                <Input
                  id="holiday-name"
                  placeholder="e.g., Diwali, Wedding"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting-details">Meeting Details (Optional)</Label>
                <Input
                  id="meeting-details"
                  placeholder="Meeting or event details"
                  value={meetingDetails}
                  onChange={(e) => setMeetingDetails(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !canApplyForLeave()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Leave Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
