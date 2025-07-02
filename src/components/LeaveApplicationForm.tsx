import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface LeaveApplicationFormProps {
  onSuccess?: () => void;
}

const LeaveApplicationForm = ({ onSuccess }: LeaveApplicationFormProps) => {
  const { user } = useUser();
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState('');
	const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<Array<{id: string, label: string, color: string}>>([]);
  const { toast } = useToast();

  // Fetch leave types from database
  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const { data: types, error } = await supabase
          .from('leave_types')
          .select('id, label, color')
          .eq('is_active', true)
          .order('label');
        
        if (error) {
          console.error('Error fetching leave types:', error);
          return;
        }
        
        setLeaveTypes(types || []);
      } catch (error) {
        console.error('Error fetching leave types:', error);
      }
    };

    fetchLeaveTypes();
  }, []);

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

    if (!startDate || !endDate) {
      toast({
        title: "Dates Required",
        description: "Please select start and end dates",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Submitting leave application...');
      
      const leaveData = {
        user_id: user.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        reason: reason.trim(),
        leave_type_id: selectedLeaveType,
        applied_at: new Date().toISOString(),
        status: 'pending'
      };

      // First ensure user profile exists and get profile data
      let { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', user.id)
        .single();

      if (!profile) {
        // Create profile if it doesn't exist
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

      console.log('Leave application submitted successfully:', newLeaveApplication);

      // Send Slack notification
      try {
        console.log('Sending Slack notification with data:', newLeaveApplication);
        const { data: slackResponse, error: slackError } = await supabase.functions.invoke('slack-notify', {
          body: {
            leaveApplication: newLeaveApplication
          }
        });

        if (slackError) {
          console.error('Slack notification error:', slackError);
          // Don't fail the whole operation if Slack fails
        } else {
          console.log('Slack notification sent successfully:', slackResponse);
        }
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError);
        // Continue with success flow even if Slack fails
      }

      // Create in-app notification for admin - first ensure admin profile exists
      try {
        console.log('Creating in-app notification...');
        
        // Check if admin profile exists, if not create it
        const adminUserId = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', adminUserId)
          .single();

        if (!adminProfile) {
          console.log('Admin profile not found, creating...');
          const { error: adminProfileError } = await supabase
            .from('profiles')
            .insert([{
              id: adminUserId,
              email: 'admin@timeloo.app',
              name: 'Admin User'
            }]);

          if (adminProfileError) {
            console.error('Error creating admin profile:', adminProfileError);
            throw adminProfileError;
          }
        }

        // Now create the notification
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert([{
            user_id: adminUserId,
            message: `New leave application from ${profile?.name || 'Unknown User'} for ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
            type: 'info'
          }]);

        if (notificationError) {
          console.error('Error creating in-app notification:', notificationError);
        } else {
          console.log('In-app notification created successfully');
        }
      } catch (notificationError) {
        console.error('Failed to create in-app notification:', notificationError);
        // Continue with success flow even if notification fails
      }

      // Show success message
      toast({
        title: "🎉 Leave Application Submitted!",
        description: "Your application has been submitted successfully and admin has been notified!",
        className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
      });

      // Reset form
      setStartDate(new Date());
      setEndDate(new Date());
      setReason('');
      setSelectedLeaveType('');

      // Call success callback
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
    <form onSubmit={handleSubmit} className="grid gap-4">
      {/* Date Range Picker */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
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
                disabled={(date) =>
                  date < new Date()
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="end-date">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
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
                disabled={(date) =>
                  date < new Date() || (startDate && date < startDate)
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

			{/* Leave Type Select */}
			<div className="grid gap-2">
				<Label htmlFor="leave-type">Type of Leave</Label>
				<Select onValueChange={setSelectedLeaveType}>
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
									></div>
									{type.label}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

      {/* Reason Textarea */}
      <div className="grid gap-2">
        <Label htmlFor="reason">Reason for Leave</Label>
        <Textarea
          id="reason"
          placeholder="Explain why you need time off..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {/* Submit Button */}
      <Button disabled={isSubmitting} className="bg-blue-500 text-white font-semibold py-3 rounded-md hover:bg-blue-700 transition-colors duration-300">
        {isSubmitting ? 'Submitting...' : 'Submit Application'}
      </Button>
    </form>
  );
};

export default LeaveApplicationForm;
