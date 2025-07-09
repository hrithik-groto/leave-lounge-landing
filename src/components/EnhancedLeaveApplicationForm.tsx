import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface LeaveType {
  id: string;
  label: string;
  color: string;
  monthly_allowance: number;
  duration_type: 'days' | 'hours';
  requires_approval: boolean;
}

interface LeaveBalance {
  monthly_allowance: number;
  used_this_month: number;
  remaining_this_month: number;
  duration_type: string;
}

interface EnhancedLeaveApplicationFormProps {
  onSuccess?: () => void;
}

const EnhancedLeaveApplicationForm = ({ onSuccess }: EnhancedLeaveApplicationFormProps) => {
  const { user } = useUser();
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const { toast } = useToast();

  // Fetch leave types from database
  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const { data: types, error } = await supabase
          .from('leave_types')
          .select('id, label, color, requires_approval')
          .eq('is_active', true)
          .order('label');
        
        if (error) {
          console.error('Error fetching leave types:', error);
          return;
        }
        
        const enhancedTypes: LeaveType[] = (types || []).map(type => ({
          ...type,
          monthly_allowance: type.label === 'Paid Leave' ? 1.5 : 
                           type.label === 'Work From Home' ? 2 : 
                           type.label === 'Short Leave' ? 4 : 0,
          duration_type: type.label === 'Short Leave' ? 'hours' : 'days'
        }));
        
        setLeaveTypes(enhancedTypes);
      } catch (error) {
        console.error('Error fetching leave types:', error);
      }
    };

    fetchLeaveTypes();
  }, []);

  // Fetch leave balance when leave type changes
  useEffect(() => {
    if (selectedLeaveType && user) {
      fetchLeaveBalance();
    }
  }, [selectedLeaveType, user]);

  const fetchLeaveBalance = async () => {
    if (!selectedLeaveType || !user) return;

    try {
      const { data, error } = await supabase.rpc('get_monthly_leave_balance', {
        p_user_id: user.id,
        p_leave_type_id: selectedLeaveType
      });

      if (error) {
        console.error('Error fetching leave balance:', error);
        return;
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setLeaveBalance(data as unknown as LeaveBalance);
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  const selectedLeaveTypeData = leaveTypes.find(type => type.id === selectedLeaveType);
  const isShortLeave = selectedLeaveTypeData?.duration_type === 'hours';

  const calculateLeaveDuration = () => {
    if (!startDate || !selectedLeaveTypeData) return 0;
    
    if (isShortLeave) {
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);
      return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
    } else {
      const end = endDate || startDate;
      const diffTime = Math.abs(end.getTime() - startDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to apply for leave",
        variant: "destructive"
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for your leave application",
        variant: "destructive"
      });
      return;
    }

    if (!selectedLeaveType) {
      toast({
        title: "Leave Type Required",
        description: "Please select a leave type",
        variant: "destructive"
      });
      return;
    }

    if (!startDate) {
      toast({
        title: "Date Required",
        description: "Please select a start date",
        variant: "destructive"
      });
      return;
    }

    const duration = calculateLeaveDuration();
    if (leaveBalance && duration > leaveBalance.remaining_this_month) {
      toast({
        title: "Insufficient Leave Balance",
        description: `You only have ${leaveBalance.remaining_this_month} ${leaveBalance.duration_type} remaining this month`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const leaveData = {
        user_id: user.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: isShortLeave ? startDate.toISOString().split('T')[0] : (endDate || startDate).toISOString().split('T')[0],
        reason: reason.trim(),
        leave_type_id: selectedLeaveType,
        applied_at: new Date().toISOString(),
        status: selectedLeaveTypeData?.requires_approval ? 'pending' : 'approved',
        leave_duration_type: isShortLeave ? 'hours' : 'days',
        hours_requested: isShortLeave ? duration : null,
        leave_time_start: isShortLeave ? startTime : null,
        leave_time_end: isShortLeave ? endTime : null
      };

      // Ensure user profile exists
      let { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', user.id)
        .single();

      if (!profile) {
        const newProfileData = {
          id: user.id,
          email: user.emailAddresses?.[0]?.emailAddress || '',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
        };

        const { error: profileError, data: newProfile } = await supabase
          .from('profiles')
          .insert([newProfileData])
          .select()
          .single();

        if (profileError) {
          console.error('Error creating profile:', profileError);
          throw new Error('Failed to create user profile');
        }
        
        profile = newProfile;
      }

      // Submit leave application
      const { data: newLeaveApplication, error } = await supabase
        .from('leave_applied_users')
        .insert([leaveData])
        .select()
        .single();

      if (error) {
        console.error('Error submitting leave application:', error);
        throw error;
      }

      // Send Slack notification
      try {
        await supabase.functions.invoke('slack-notify', {
          body: { leaveApplication: newLeaveApplication }
        });
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError);
      }

      // Create in-app notification for admin
      try {
        const adminUserId = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';
        await supabase
          .from('notifications')
          .insert([{
            user_id: adminUserId,
            message: `New ${selectedLeaveTypeData?.label} application from ${profile?.name || 'Unknown User'} for ${startDate.toLocaleDateString()}${isShortLeave ? ` (${startTime}-${endTime})` : ` to ${(endDate || startDate).toLocaleDateString()}`}`,
            type: 'info'
          }]);
      } catch (notificationError) {
        console.error('Failed to create in-app notification:', notificationError);
      }

      toast({
        title: "🎉 Leave Application Submitted!",
        description: `Your ${selectedLeaveTypeData?.label} application has been submitted successfully!`,
        className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
      });

      // Reset form
      setStartDate(new Date());
      setEndDate(new Date());
      setStartTime('09:00');
      setEndTime('10:00');
      setReason('');
      setSelectedLeaveType('');
      setLeaveBalance(null);

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit leave application. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Apply for Leave</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Leave Type Select */}
          <div className="space-y-2">
            <Label htmlFor="leave-type">Type of Leave</Label>
            <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: type.color }}
                      />
                      <span>{type.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {type.monthly_allowance}/{type.duration_type === 'hours' ? 'month' : 'month'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {leaveBalance && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>This Month:</strong> {leaveBalance.remaining_this_month} {leaveBalance.duration_type} remaining 
                  (Used: {leaveBalance.used_this_month}/{leaveBalance.monthly_allowance})
                </p>
              </div>
            )}
          </div>

          {/* Date Selection */}
          {isShortLeave ? (
            <div className="space-y-2">
              <Label htmlFor="leave-date">Leave Date</Label>
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
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
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
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
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
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date < new Date() || (startDate && date < startDate)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Time Selection for Short Leaves */}
          {isShortLeave && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="time"
                    id="start-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="time"
                    id="end-time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Duration Display */}
          {selectedLeaveTypeData && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Duration:</strong> {calculateLeaveDuration()} {selectedLeaveTypeData.duration_type}
              </p>
            </div>
          )}

          {/* Reason Textarea */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Leave</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you need time off..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-md transition-colors duration-300"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default EnhancedLeaveApplicationForm;