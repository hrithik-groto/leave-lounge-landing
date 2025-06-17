
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import LeaveTypeSelector from './LeaveTypeSelector';

interface LeaveApplicationFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  onSuccess: () => void;
}

const LeaveApplicationForm: React.FC<LeaveApplicationFormProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSuccess
}) => {
  const { user } = useUser();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>(selectedDate);
  const [endDate, setEndDate] = useState<Date | undefined>(selectedDate);
  const [reason, setReason] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [meetingDetails, setMeetingDetails] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [hoursRequested, setHoursRequested] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [userBalances, setUserBalances] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchLeaveTypes();
      fetchUserBalances();
    }
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }
  }, [selectedDate]);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select(`
          *,
          leave_policies (
            annual_allowance,
            carry_forward_limit
          )
        `)
        .eq('is_active', true);

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchUserBalances = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_leave_balances')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', new Date().getFullYear());

      if (error) throw error;

      const balances = {};
      data?.forEach(balance => {
        balances[balance.leave_type_id] = {
          allocated: balance.allocated_days,
          used: balance.used_days,
          available: balance.allocated_days - balance.used_days + balance.carried_forward_days
        };
      });

      setUserBalances(balances);
    } catch (error) {
      console.error('Error fetching user balances:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !startDate || !endDate || !selectedLeaveType || !reason.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const selectedType = leaveTypes.find(lt => lt.id === selectedLeaveType);
    if (!selectedType) return;

    const daysRequested = differenceInDays(endDate, startDate) + 1;
    const balance = userBalances[selectedLeaveType];

    // Validate leave balance for deductible leaves
    if (selectedType.annual_allowance !== 999 && balance && daysRequested > balance.available) {
      toast({
        title: "Insufficient Leave Balance",
        description: `You only have ${balance.available} days available for ${selectedType.label}`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('leave_applied_users')
        .insert({
          user_id: user.id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          reason: reason.trim(),
          leave_type_id: selectedLeaveType,
          holiday_name: holidayName.trim() || null,
          meeting_details: meetingDetails.trim() || null,
          is_half_day: isHalfDay,
          hours_requested: hoursRequested || null,
          status: 'pending'
        });

      if (error) throw error;

      // Create notification for admin
      await supabase
        .from('notifications')
        .insert({
          user_id: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV', // Admin user ID
          message: `New ${selectedType.label} application from ${user.firstName || 'User'} for ${daysRequested} day(s)`,
          type: 'info'
        });

      toast({
        title: "Success! 🎉",
        description: "Your leave application has been submitted successfully!"
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave application. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('');
    setHolidayName('');
    setMeetingDetails('');
    setSelectedLeaveType('');
    setIsHalfDay(false);
    setHoursRequested(0);
    onClose();
  };

  const selectedType = leaveTypes.find(lt => lt.id === selectedLeaveType);
  const daysRequested = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <LeaveTypeSelector
            leaveTypes={leaveTypes}
            selectedType={selectedLeaveType}
            onTypeChange={setSelectedLeaveType}
            userBalances={userBalances}
          />

          {selectedType?.label === 'Short Leave' && (
            <div>
              <Label htmlFor="hours">Hours Requested</Label>
              <Input
                id="hours"
                type="number"
                min="0.5"
                max="4"
                step="0.5"
                value={hoursRequested}
                onChange={(e) => setHoursRequested(parseFloat(e.target.value))}
                placeholder="Enter hours (max 4)"
              />
            </div>
          )}

          {selectedType?.label !== 'Short Leave' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'MMM dd, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'MMM dd, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => date < (startDate || new Date())}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {daysRequested > 0 && (
                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  Duration: {daysRequested} day(s)
                </div>
              )}
            </>
          )}

          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed reason for your leave..."
              required
              className="min-h-[80px]"
            />
          </div>

          {selectedType?.label === 'Restricted Holiday' && (
            <div>
              <Label htmlFor="holiday-name">Holiday Name *</Label>
              <Input
                id="holiday-name"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="Enter the holiday name..."
                required
              />
            </div>
          )}

          {selectedType?.label === 'Comp-offs' && (
            <div>
              <Label htmlFor="meeting-details">Meeting Details *</Label>
              <Textarea
                id="meeting-details"
                value={meetingDetails}
                onChange={(e) => setMeetingDetails(e.target.value)}
                placeholder="Provide meeting name and detailed reason..."
                required
                className="min-h-[60px]"
              />
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Submitting...' : 'Apply Leave'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveApplicationForm;
