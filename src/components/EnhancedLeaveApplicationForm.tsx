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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { CalendarIcon, Clock, AlertCircle, XCircle, CheckCircle } from "lucide-react";
import { format, addDays, isSameDay, isAfter, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@clerk/clerk-react";
import { useLeaveOverlapValidation } from "@/hooks/useLeaveOverlapValidation";

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

// Create an interface for the RPC response
interface MonthlyLeaveBalanceResponse {
  used_this_month: number;
  remaining_this_month: number;
  carried_forward: number;
  allocated_balance?: number;
  monthly_allocation?: number;
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
  const [currentUsage, setCurrentUsage] = useState<{[key: string]: number}>({});

  const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveTypeId);

  // Use the overlap validation hook
  const { validationResult, loading: validationLoading } = useLeaveOverlapValidation(
    startDate,
    endDate,
    isHalfDay,
    halfDayPeriod
  );

  useEffect(() => {
    fetchLeaveTypes();
    fetchCompanyHolidays();
  }, []);

  useEffect(() => {
    if (selectedLeaveType && user?.id) {
      fetchCurrentUsage();
    }
  }, [selectedLeaveType, user?.id]);

  // Auto-sync end date with start date for Short Leave
  useEffect(() => {
    if (selectedLeaveType?.label === 'Short Leave' && startDate) {
      setEndDate(startDate);
    }
  }, [selectedLeaveType, startDate]);

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

  const fetchCurrentUsage = async () => {
    if (!user?.id || !selectedLeaveType) return;

    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      if (selectedLeaveType.label === 'Short Leave') {
        const { data: shortLeaves, error } = await supabase
          .from('leave_applied_users')
          .select('hours_requested, status')
          .eq('user_id', user.id)
          .eq('leave_type_id', selectedLeaveType.id)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        if (error) throw error;

        const totalHoursUsed = shortLeaves?.reduce((total, leave) => {
          return total + (leave.hours_requested || 1);
        }, 0) || 0;

        setCurrentUsage({[selectedLeaveType.id]: totalHoursUsed});
      } 
      else if (selectedLeaveType.label === 'Paid Leave') {
        const { data, error } = await supabase
          .rpc('get_monthly_leave_balance', {
            p_user_id: user.id,
            p_leave_type_id: selectedLeaveType.id,
            p_month: currentMonth,
            p_year: currentYear
          });

        if (error) throw error;

        if (data && typeof data === 'object') {
          const balanceData = data as unknown as MonthlyLeaveBalanceResponse;
          
          setCurrentUsage({
            [selectedLeaveType.id]: balanceData.used_this_month || 0,
            [`${selectedLeaveType.id}_remaining`]: balanceData.remaining_this_month || 0,
            [`${selectedLeaveType.id}_carried_forward`]: balanceData.carried_forward || 0
          });
        } else {
          console.error('Invalid response format from get_monthly_leave_balance');
          setCurrentUsage({
            [selectedLeaveType.id]: 0,
            [`${selectedLeaveType.id}_remaining`]: 1.5,
            [`${selectedLeaveType.id}_carried_forward`]: 0
          });
        }
      }
      else if (selectedLeaveType.label === 'Work From Home') {
        const { data: leaves, error } = await supabase
          .from('leave_applied_users')
          .select('actual_days_used, is_half_day, start_date, end_date, status')
          .eq('user_id', user.id)
          .eq('leave_type_id', selectedLeaveType.id)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        if (error) throw error;

        const totalDaysUsed = leaves?.reduce((total, leave) => {
          if (leave.actual_days_used) {
            return total + leave.actual_days_used;
          }
          if (leave.is_half_day) {
            return total + 0.5;
          }
          const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
          return total + daysDiff;
        }, 0) || 0;

        setCurrentUsage({[selectedLeaveType.id]: totalDaysUsed});
      }
      else {
        const { data: leaves, error } = await supabase
          .from('leave_applied_users')
          .select('actual_days_used, is_half_day, start_date, end_date, status')
          .eq('user_id', user.id)
          .eq('leave_type_id', selectedLeaveType.id)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        if (error) throw error;

        const totalDaysUsed = leaves?.reduce((total, leave) => {
          if (leave.actual_days_used) {
            return total + leave.actual_days_used;
          }
          if (leave.is_half_day) {
            return total + 0.5;
          }
          const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
          return total + daysDiff;
        }, 0) || 0;

        setCurrentUsage({[selectedLeaveType.id]: totalDaysUsed});
      }
    } catch (error) {
      console.error('Error fetching current usage:', error);
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

  const getMonthlyAllowance = () => {
    if (!selectedLeaveType) return 0;
    switch (selectedLeaveType.label) {
      case 'Paid Leave': return 1.5;
      case 'Short Leave': return 4;
      case 'Work From Home': return 2;
      case 'Annual Leave': return 18; // Annual allowance
      default: return 0;
    }
  };

  const canApplyForLeave = () => {
    if (!selectedLeaveType) return false;
    
    const monthlyAllowance = getMonthlyAllowance();
    const used = currentUsage[selectedLeaveType.id] || 0;
    const requestedAmount = calculateLeaveDuration();
    
    if (selectedLeaveType.label === 'Annual Leave') {
      return true;
    }
    
    if (selectedLeaveType.label === 'Paid Leave') {
      const remaining = currentUsage[`${selectedLeaveType.id}_remaining`] || (monthlyAllowance - used);
      
      if (isHalfDay && requestedAmount === 0.5) {
        return remaining >= 0.5;
      }
      
      if (!isHalfDay && requestedAmount === 1) {
        return remaining >= 1;
      }
      
      return requestedAmount <= remaining;
    }
    
    return (used + requestedAmount) <= monthlyAllowance;
  };

  const getValidationMessage = () => {
    if (!selectedLeaveType) return null;
    
    const monthlyAllowance = getMonthlyAllowance();
    const used = currentUsage[selectedLeaveType.id] || 0;
    let remaining = monthlyAllowance - used;
    
    if (selectedLeaveType.label === 'Paid Leave') {
      remaining = currentUsage[`${selectedLeaveType.id}_remaining`] || remaining;
    }
    
    const requestedAmount = calculateLeaveDuration();
    
    if (selectedLeaveType.label === 'Annual Leave') {
      return null;
    }
    
    if (remaining <= 0) {
      const unit = selectedLeaveType.label === 'Short Leave' ? 'hours' : 'days';
      return `You have exhausted your ${selectedLeaveType.label.toLowerCase()} quota for this month. Please wait for next month to get ${monthlyAllowance} new ${unit}.`;
    }
    
    if (requestedAmount > remaining) {
      const unit = selectedLeaveType.label === 'Short Leave' ? 'hours' : 'days';
      
      if (selectedLeaveType.label === 'Paid Leave' && remaining === 0.5 && !isHalfDay) {
        return `You have only 0.5 days remaining. Please select "Half Day Leave" to use your remaining quota.`;
      }
      
      return `You can only apply for ${remaining} more ${unit} this month (requested: ${requestedAmount} ${unit}).`;
    }
    
    return null;
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isCompanyHoliday = (date: Date) => {
    return companyHolidays.some(holiday => 
      isSameDay(new Date(holiday.date), date)
    );
  };

  const isDateInPast = (date: Date) => {
    const today = startOfDay(new Date());
    return isBefore(startOfDay(date), today);
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

    if (!validationResult.canApply) {
      toast.error(validationResult.message || 'Cannot apply for leave on selected dates');
      return;
    }

    if (!canApplyForLeave()) {
      toast.error(getValidationMessage() || 'Cannot apply for leave');
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

  const validationMessage = getValidationMessage();

  return (
    <div className="w-full h-full flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0 pb-4 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5" />
            Apply for Leave
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col max-h-[60vh]">
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-6 p-6">
                {validationMessage && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">{validationMessage}</p>
                  </div>
                )}

                {!validationResult.canApply && validationResult.message && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800">{validationResult.message}</p>
                  </div>
                )}

                {startDate && endDate && isSameDay(startDate, endDate) && validationResult.conflicts.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Available Time Slots:</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        {validationResult.availableSlots.morning ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                        <span className={validationResult.availableSlots.morning ? 'text-green-800' : 'text-red-800'}>
                          Morning (10:00 AM - 2:00 PM)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {validationResult.availableSlots.afternoon ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                        <span className={validationResult.availableSlots.afternoon ? 'text-green-800' : 'text-red-800'}>
                          Afternoon (2:00 PM - 6:30 PM)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {validationResult.availableSlots.fullDay ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                        <span className={validationResult.availableSlots.fullDay ? 'text-green-800' : 'text-red-800'}>
                          Full Day
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedLeaveType?.label === 'Paid Leave' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Paid Leave Balance:</h4>
                    <div className="space-y-1 text-sm text-blue-800">
                      <div>Used this month: {currentUsage[selectedLeaveType.id] || 0} days</div>
                      <div>Remaining: {currentUsage[`${selectedLeaveType.id}_remaining`] || 0} days</div>
                      <div>Carried forward: {currentUsage[`${selectedLeaveType.id}_carried_forward`] || 0} days</div>
                    </div>
                  </div>
                )}

                <form id="leave-form" onSubmit={handleSubmit} className="space-y-6">
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
                            disabled={(date) => isDateInPast(date) || isWeekend(date) || isCompanyHoliday(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>End Date *</Label>
                      {selectedLeaveType?.label === 'Short Leave' ? (
                        <div className="relative">
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-gray-50"
                            disabled
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : "Same as start date"}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">
                            Short leave applications are limited to single day. For multiple days, create separate applications.
                          </p>
                        </div>
                      ) : (
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
                      )}
                    </div>
                  </div>

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
                            <RadioGroupItem 
                              value="morning" 
                              id="morning" 
                              disabled={!validationResult.availableSlots.morning}
                            />
                            <Label 
                              htmlFor="morning"
                              className={!validationResult.availableSlots.morning ? 'text-muted-foreground' : ''}
                            >
                              Morning (10:00 AM - 2:00 PM)
                              {!validationResult.availableSlots.morning && ' - Not Available'}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem 
                              value="afternoon" 
                              id="afternoon" 
                              disabled={!validationResult.availableSlots.afternoon}
                            />
                            <Label 
                              htmlFor="afternoon"
                              className={!validationResult.availableSlots.afternoon ? 'text-muted-foreground' : ''}
                            >
                              Afternoon (2:00 PM - 6:30 PM)
                              {!validationResult.availableSlots.afternoon && ' - Not Available'}
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  )}

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

                  {startDate && endDate && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm">
                        <strong>Duration:</strong> {calculateLeaveDuration()} {selectedLeaveType?.label === 'Short Leave' ? 'hours' : 'days'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <Textarea
                      id="reason"
                      placeholder="Please provide a reason for your leave request..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="min-h-[80px] resize-none"
                      required
                    />
                  </div>

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
                </form>
              </div>
            </ScrollArea>
          </div>
          
          <div className="flex-shrink-0 p-6 pt-4 border-t bg-background sticky bottom-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <Button 
              type="submit"
              form="leave-form" 
              className="w-full" 
              disabled={isSubmitting || !canApplyForLeave() || !validationResult.canApply || validationLoading}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Leave Application'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
