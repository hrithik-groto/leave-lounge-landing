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

  const { user } = useUser();

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

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

  const selectedLeaveType = leaveTypes.find(type => type.id === leaveTypeId);

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

    setIsSubmitting(true);

    try {
      console.log('Submitting leave application with data:', {
        user_id: user.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        leave_type_id: leaveTypeId,
        reason: reason.trim(),
        is_half_day: isHalfDay,
        hours_requested: selectedLeaveType?.label === 'Short Leave' ? hoursRequested : null,
        leave_time_start: isHalfDay && selectedLeaveType?.label === 'Paid Leave' ? 
          (halfDayPeriod === 'morning' ? '10:00:00' : '14:00:00') : null,
        leave_time_end: isHalfDay && selectedLeaveType?.label === 'Paid Leave' ? 
          (halfDayPeriod === 'morning' ? '14:00:00' : '18:30:00') : null,
      });

      const { data, error } = await supabase
        .from('leave_applied_users')
        .insert({
          user_id: user.id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          leave_type_id: leaveTypeId,
          reason: reason.trim(),
          is_half_day: isHalfDay,
          hours_requested: selectedLeaveType?.label === 'Short Leave' ? hoursRequested : null,
          leave_time_start: isHalfDay && selectedLeaveType?.label === 'Paid Leave' ? 
            (halfDayPeriod === 'morning' ? '10:00:00' : '14:00:00') : null,
          leave_time_end: isHalfDay && selectedLeaveType?.label === 'Paid Leave' ? 
            (halfDayPeriod === 'morning' ? '14:00:00' : '18:30:00') : null,
        })
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
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
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

        {/* Half Day Option for Paid Leave */}
        {selectedLeaveType?.label === 'Paid Leave' && startDate && endDate && isSameDay(startDate, endDate) && (
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
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </Button>
      </form>
    </div>
  );
};
