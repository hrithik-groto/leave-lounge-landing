
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, isSameDay, isAfter, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface LeaveType {
  id: string;
  label: string;
  color: string;
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

export const LeaveApplicationForm = () => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'morning' | 'afternoon'>('morning');
  const [hoursRequested, setHoursRequested] = useState<number>(0);
  const [leaveBalances, setLeaveBalances] = useState<Record<string, LeaveBalance>>({});

  const { user } = useUser();

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

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

  const calculateLeaveDuration = () => {
    if (!startDate || !endDate) return 0;
    
    if (selectedLeaveType?.label === 'Short Leave') {
      return hoursRequested;
    }
    
    if (isHalfDay && isSameDay(startDate, endDate)) {
      return 0.5;
    }
    
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    return daysDiff;
  };

  const validateLeaveBalance = () => {
    if (!currentBalance || !selectedLeaveType) return true;
    
    const requestedAmount = calculateLeaveDuration();
    return requestedAmount <= currentBalance.remaining_this_month;
  };

  const renderLeaveBalanceInfo = () => {
    if (!currentBalance) return null;

    const isAnnualLeave = currentBalance.leave_type === 'Annual Leave';
    
    return (
      <div className="text-sm text-muted-foreground space-y-1 mt-2">
        {isAnnualLeave ? (
          <>
            <div>Annual allowance: 18 days</div>
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
      const submissionData: any = {
        user_id: user.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        leave_type_id: leaveTypeId,
        reason: reason.trim(),
        status: 'pending'
      };

      // Only add optional fields if they have values
      if (isHalfDay) {
        submissionData.is_half_day = true;
        
        // Only add time fields for half-day Paid Leave or Annual Leave
        if (selectedLeaveType?.label === 'Paid Leave' || selectedLeaveType?.label === 'Annual Leave') {
          submissionData.leave_time_start = halfDayPeriod === 'morning' ? '10:00:00' : '14:00:00';
          submissionData.leave_time_end = halfDayPeriod === 'morning' ? '14:00:00' : '18:30:00';
        }
      }

      // Only add hours_requested for Short Leave and when it's greater than 0
      if (selectedLeaveType?.label === 'Short Leave' && hoursRequested > 0) {
        submissionData.hours_requested = hoursRequested;
      }

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
      setHalfDayPeriod('morning');
      setHoursRequested(0);
    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast.error('Failed to submit leave application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md max-h-[80vh] overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Apply for Leave</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
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
              value={hoursRequested || ''}
              onChange={(e) => setHoursRequested(parseFloat(e.target.value) || 0)}
              placeholder="Enter hours (0.5 to 4)"
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
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm font-medium">
              Duration: {calculateLeaveDuration()} {selectedLeaveType.label === 'Short Leave' ? 'hours' : 'days'}
            </div>
            {currentBalance && (
              <div className="text-sm text-gray-600">
                Remaining after this request: {currentBalance.remaining_this_month - calculateLeaveDuration()} {currentBalance.duration_type}
              </div>
            )}
          </div>
        )}

        <div className="pt-4">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || !validateLeaveBalance()}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </div>
  );
};
