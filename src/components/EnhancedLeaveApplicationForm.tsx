
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock } from "lucide-react";
import { format, isSameDay, isAfter, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeaveType {
  id: string;
  label: string;
  color: string;
}

interface CompanyHoliday {
  id: string;
  name: string;
  date: string;
}

interface LeaveBalance {
  leave_type: string;
  duration_type: string;
  monthly_allowance: number;
  used_this_month: number;
  remaining_this_month: number;
  annual_allowance?: number;
  carried_forward?: number;
}

interface EnhancedLeaveApplicationFormProps {
  onSuccess?: () => void;
  preselectedDate?: Date | null;
}

const EnhancedLeaveApplicationForm: React.FC<EnhancedLeaveApplicationFormProps> = ({ onSuccess, preselectedDate }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [companyHolidays, setCompanyHolidays] = useState<CompanyHoliday[]>([]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'morning' | 'afternoon'>('morning');
  const [hoursRequested, setHoursRequested] = useState<number>(0);
  const [leaveBalances, setLeaveBalances] = useState<Record<string, LeaveBalance>>({});
  const [holidayName, setHolidayName] = useState("");
  const [meetingDetails, setMeetingDetails] = useState("");

  const { user } = useUser();

  useEffect(() => {
    fetchLeaveTypes();
    fetchCompanyHolidays();
    if (preselectedDate) {
      setStartDate(preselectedDate);
      setEndDate(preselectedDate);
    }
  }, [preselectedDate]);

  useEffect(() => {
    if (leaveTypeId) {
      fetchLeaveBalance(leaveTypeId);
    }
  }, [leaveTypeId]);

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

  const fetchLeaveBalance = async (leaveTypeId: string) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_monthly_leave_balance', {
        p_user_id: user.id,
        p_leave_type_id: leaveTypeId,
      });

      if (error) throw error;
      
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const balanceData: LeaveBalance = {
          leave_type: (data as any).leave_type || '',
          duration_type: (data as any).duration_type || 'days',
          monthly_allowance: Number((data as any).monthly_allowance) || 0,
          used_this_month: Number((data as any).used_this_month) || 0,
          remaining_this_month: Number((data as any).remaining_this_month) || 0,
          annual_allowance: Number((data as any).annual_allowance) || undefined,
          carried_forward: Number((data as any).carried_forward) || undefined
        };
        
        setLeaveBalances(prev => ({
          ...prev,
          [leaveTypeId]: balanceData
        }));
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  const selectedLeaveType = leaveTypes.find(type => type.id === leaveTypeId);
  const currentBalance = leaveBalances[leaveTypeId];

  const getLeaveTypeColor = (typeId: string) => {
    const type = leaveTypes.find(t => t.id === typeId);
    return type?.color || '#3B82F6';
  };

  const isHolidayDate = (date: Date) => {
    return companyHolidays.some(holiday => 
      isSameDay(new Date(holiday.date), date)
    );
  };

  const getHolidayForDate = (date: Date) => {
    return companyHolidays.find(holiday => 
      isSameDay(new Date(holiday.date), date)
    );
  };

  const calculateBusinessDays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHolidayDate(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  };

  const calculateLeaveDuration = () => {
    if (!startDate || !endDate) return 0;
    
    if (selectedLeaveType?.label === 'Short Leave') {
      return hoursRequested;
    }
    
    if (isHalfDay && isSameDay(startDate, endDate)) {
      return 0.5;
    }
    
    return calculateBusinessDays(startDate, endDate);
  };

  const validateLeaveBalance = () => {
    if (!currentBalance || !selectedLeaveType) return true;
    
    const requestedAmount = calculateLeaveDuration();
    
    if (selectedLeaveType.label === 'Short Leave') {
      return requestedAmount <= currentBalance.remaining_this_month;
    }
    
    return requestedAmount <= currentBalance.remaining_this_month;
  };

  const renderLeaveBalanceInfo = () => {
    if (!currentBalance) return null;

    const isAnnualLeave = currentBalance.leave_type === 'Annual Leave';
    
    return (
      <div className="text-sm text-muted-foreground space-y-1">
        {isAnnualLeave ? (
          <>
            <div>Annual allowance: {currentBalance.annual_allowance || currentBalance.monthly_allowance} days</div>
            <div>Used this year: {currentBalance.used_this_month} days</div>
            <div>Remaining: {currentBalance.remaining_this_month} days</div>
          </>
        ) : (
          <>
            <div>Monthly allowance: {currentBalance.monthly_allowance} {currentBalance.duration_type}</div>
            <div>Used this month: {currentBalance.used_this_month} {currentBalance.duration_type}</div>
            <div>Remaining: {currentBalance.remaining_this_month} {currentBalance.duration_type}</div>
            {currentBalance.carried_forward !== undefined && currentBalance.carried_forward > 0 && (
              <div>Carried forward: {currentBalance.carried_forward} days</div>
            )}
          </>
        )}
      </div>
    );
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

    if (!validateLeaveBalance()) {
      toast.error('Insufficient leave balance for this request');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the submission data with proper null handling
      const submissionData = {
        user_id: user.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        leave_type_id: leaveTypeId,
        reason: reason.trim(),
        is_half_day: isHalfDay || false,
        hours_requested: selectedLeaveType?.label === 'Short Leave' ? hoursRequested : null,
        holiday_name: holidayName.trim() || null,
        meeting_details: meetingDetails.trim() || null,
        leave_time_start: (isHalfDay && (selectedLeaveType?.label === 'Paid Leave' || selectedLeaveType?.label === 'Annual Leave')) ? 
          (halfDayPeriod === 'morning' ? '10:00:00' : '14:00:00') : null,
        leave_time_end: (isHalfDay && (selectedLeaveType?.label === 'Paid Leave' || selectedLeaveType?.label === 'Annual Leave')) ? 
          (halfDayPeriod === 'morning' ? '14:00:00' : '18:30:00') : null,
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
      
      setStartDate(undefined);
      setEndDate(undefined);
      setLeaveTypeId("");
      setReason("");
      setIsHalfDay(false);
      setHalfDayPeriod('morning');
      setHoursRequested(0);
      setHolidayName("");
      setMeetingDetails("");
      
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Apply for Leave</CardTitle>
        <CardDescription>
          Submit your leave application with all the necessary details
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[70vh]">
        <ScrollArea className="h-full pr-4">
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
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentBalance && renderLeaveBalanceInfo()}
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
                      disabled={(date) => isBefore(date, new Date())}
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
                      disabled={(date) => startDate ? isBefore(date, startDate) : isBefore(date, new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Half Day Option for Paid Leave and Annual Leave */}
            {(selectedLeaveType?.label === 'Paid Leave' || selectedLeaveType?.label === 'Annual Leave') && startDate && endDate && isSameDay(startDate, endDate) && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="half-day"
                    checked={isHalfDay}
                    onCheckedChange={(checked) => setIsHalfDay(checked === true)}
                  />
                  <Label htmlFor="half-day" className="text-sm font-medium">
                    Apply for half day (0.5 days)
                  </Label>
                </div>

                {isHalfDay && (
                  <div className="space-y-3 pl-6">
                    <Label className="text-sm font-medium">Select Half Day Period:</Label>
                    <RadioGroup value={halfDayPeriod} onValueChange={(value) => setHalfDayPeriod(value as 'morning' | 'afternoon')}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="morning" id="morning" />
                        <Label htmlFor="morning" className="text-sm">
                          Morning (10:00 AM - 2:00 PM)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="afternoon" id="afternoon" />
                        <Label htmlFor="afternoon" className="text-sm">
                          Afternoon (2:00 PM - 6:30 PM)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>
            )}

            {/* Hours for Short Leave */}
            {selectedLeaveType?.label === 'Short Leave' && (
              <div className="space-y-2">
                <Label htmlFor="hours">Hours Requested *</Label>
                <Input
                  id="hours"
                  type="number"
                  min="0.5"
                  max="4"
                  step="0.5"
                  value={hoursRequested}
                  onChange={(e) => setHoursRequested(parseFloat(e.target.value) || 0)}
                  placeholder="Enter hours (0.5 to 4)"
                />
              </div>
            )}

            {/* Additional Fields */}
            {selectedLeaveType?.label === 'Work From Home' && (
              <div className="space-y-2">
                <Label htmlFor="meeting-details">Meeting Details (Optional)</Label>
                <Textarea
                  id="meeting-details"
                  value={meetingDetails}
                  onChange={(e) => setMeetingDetails(e.target.value)}
                  placeholder="Describe any important meetings or tasks for the day"
                  rows={3}
                />
              </div>
            )}

            {startDate && isHolidayDate(startDate) && (
              <div className="space-y-2">
                <Label htmlFor="holiday-name">Holiday Name</Label>
                <Input
                  id="holiday-name"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder={getHolidayForDate(startDate)?.name || "Enter holiday name"}
                />
              </div>
            )}

            {/* Reason */}
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

            {/* Leave Duration Display */}
            {startDate && endDate && selectedLeaveType && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm font-medium mb-2">Leave Duration Summary:</div>
                <div className="text-sm">
                  Duration: {calculateLeaveDuration()} {selectedLeaveType.label === 'Short Leave' ? 'hours' : 'days'}
                </div>
                {currentBalance && (
                  <div className="text-sm">
                    Remaining after this request: {currentBalance.remaining_this_month - calculateLeaveDuration()} {currentBalance.duration_type}
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !validateLeaveBalance()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export { EnhancedLeaveApplicationForm };
export default EnhancedLeaveApplicationForm;
