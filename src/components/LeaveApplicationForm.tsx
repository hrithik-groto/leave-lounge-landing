
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";

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
  const [wfhRemaining, setWfhRemaining] = useState(0);
  const [wfhLoading, setWfhLoading] = useState(false);

  const { user } = useUser();
  const selectedLeaveType = leaveTypes.find(type => type.id === leaveTypeId);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    if (user?.id) {
      checkWFHBalance();
    }
  }, [user?.id]);

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
      const typedBalance = wfhBalance as unknown as { remaining_this_month: number };
      const remaining = typedBalance?.remaining_this_month || 0;
      
      setWfhRemaining(remaining);
    } catch (error) {
      console.error('Error checking WFH status:', error);
      setWfhRemaining(0);
    } finally {
      setWfhLoading(false);
    }
  };

  // Filter leave types based on WFH exhaustion
  const getAvailableLeaveTypes = () => {
    return leaveTypes.filter(type => {
      // Show all leave types except Additional work from home
      if (type.label !== 'Additional work from home') {
        return true;
      }
      
      // Only show Additional work from home if regular WFH is exhausted
      return wfhRemaining <= 0;
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

    setIsSubmitting(true);

    try {
      // Calculate days for the application
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;

      // Prepare the submission data with proper typing
      const submissionData = {
        user_id: user.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        leave_type_id: leaveTypeId,
        reason: reason.trim(),
        status: 'pending' as const,
        is_half_day: false,
        actual_days_used: daysDiff,
        hours_requested: 0
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
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
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedLeaveType?.label === 'Additional work from home' && (
          <div className="mt-2 p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800">
            <div className="flex items-center gap-2">
              <span>
                ✓ You can apply for Additional Work From Home as your regular WFH quota is exhausted. No limit on applications.
              </span>
            </div>
          </div>
        )}

        {wfhRemaining > 0 && (
          <div className="mt-2 p-3 rounded-md text-sm bg-blue-50 border border-blue-200 text-blue-800">
            <span>
              You have {wfhRemaining} days of regular Work From Home remaining this month.
            </span>
          </div>
        )}
      </div>

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
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Application'}
      </Button>
    </form>
  );
};

export default LeaveApplicationForm;
