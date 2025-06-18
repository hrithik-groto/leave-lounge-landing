
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface LeaveType {
  id: string;
  label: string;
  color: string;
  accrual_rule: string;
  annual_allowance: number;
  carry_forward_limit: number;
}

const LeaveApplicationForm = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [hoursRequested, setHoursRequested] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userBalances, setUserBalances] = useState<any[]>([]);

  useEffect(() => {
    fetchLeaveTypes();
    if (user) {
      fetchUserBalances();
    }
  }, [user]);

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

      const formattedData = data?.map((type: any) => ({
        ...type,
        annual_allowance: type.leave_policies[0]?.annual_allowance || 0,
        carry_forward_limit: type.leave_policies[0]?.carry_forward_limit || 0,
      })) || [];

      setLeaveTypes(formattedData);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchUserBalances = async () => {
    try {
      const { data, error } = await supabase
        .from('user_leave_balances')
        .select(`
          *,
          leave_types (
            label,
            color
          )
        `)
        .eq('user_id', user?.id)
        .eq('year', new Date().getFullYear());

      if (error) throw error;
      setUserBalances(data || []);
    } catch (error) {
      console.error('Error fetching user balances:', error);
    }
  };

  const getLeaveTypeDescription = (leaveType: LeaveType) => {
    switch (leaveType.label) {
      case 'Paid Leave':
        return '1.5 days per month. Carried forward monthly. Fill your detailed reason if applying (important)';
      case 'Bereavement Leave':
        return '5 days per year. Applicable for the demise of 1st-degree relatives. Does not carry forward annually.';
      case 'Restricted Holiday':
        return '2 days per year to be used for festive leaves not on the company holiday calendar. Does not carry forward annually. Fill the holiday name if applying (important)';
      case 'Short Leave':
        return '4 hours per month to be used for late-ins or early outs. Does not carry forward monthly.';
      case 'Work From Home':
        return '2 days per month. Carries forward monthly. Fill your detailed reason if applying (important)';
      default:
        return '';
    }
  };

  const getAvailableBalance = (leaveTypeId: string) => {
    const balance = userBalances.find(b => b.leave_type_id === leaveTypeId);
    if (!balance) return 0;
    return (balance.allocated_days + balance.carried_forward_days) - balance.used_days;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedLeaveType || !startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const selectedType = leaveTypes.find(type => type.id === selectedLeaveType);
    
    // Validation for specific leave types
    if (selectedType?.label === 'Restricted Holiday' && !holidayName.trim()) {
      toast({
        title: "Error",
        description: "Holiday name is required for Restricted Holiday",
        variant: "destructive"
      });
      return;
    }

    if (selectedType?.label === 'Short Leave' && !hoursRequested) {
      toast({
        title: "Error",
        description: "Hours requested is required for Short Leave",
        variant: "destructive"
      });
      return;
    }

    if ((selectedType?.label === 'Paid Leave' || selectedType?.label === 'Work From Home') && !reason.trim()) {
      toast({
        title: "Error",
        description: "Detailed reason is required for this leave type",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Initialize user leave balances if they don't exist
      await supabase.rpc('initialize_user_leave_balances', {
        user_uuid: user.id
      });

      const { error } = await supabase
        .from('leave_applied_users')
        .insert({
          user_id: user.id,
          leave_type_id: selectedLeaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason || null,
          holiday_name: holidayName || null,
          hours_requested: hoursRequested ? parseFloat(hoursRequested) : null,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success! 🎉",
        description: "Leave application submitted successfully!"
      });

      // Reset form
      setSelectedLeaveType('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setHolidayName('');
      setHoursRequested('');
      
      // Refresh balances
      fetchUserBalances();

    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave application",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return <div>Please sign in to apply for leave.</div>;
  }

  const selectedTypeData = leaveTypes.find(type => type.id === selectedLeaveType);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>Apply for Leave</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="leave-type">Leave Type *</Label>
            <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select leave type..." />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: type.color }}
                      />
                      <span>{type.label}</span>
                      <span className="text-gray-500">
                        ({type.annual_allowance} {type.label === 'Short Leave' ? 'hours' : 'days'})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTypeData && (
              <div className="mt-2 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {getLeaveTypeDescription(selectedTypeData)}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Available Balance: {getAvailableBalance(selectedLeaveType)} {selectedTypeData.label === 'Short Leave' ? 'hours' : 'days'}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
                min={startDate || format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>

          {selectedTypeData?.label === 'Short Leave' && (
            <div>
              <Label htmlFor="hours">Hours Requested *</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Clock className="w-4 h-4 text-gray-500" />
                <Input
                  id="hours"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8"
                  value={hoursRequested}
                  onChange={(e) => setHoursRequested(e.target.value)}
                  placeholder="Enter hours (0.5 to 8)"
                />
              </div>
            </div>
          )}

          {selectedTypeData?.label === 'Restricted Holiday' && (
            <div>
              <Label htmlFor="holiday-name">Holiday Name *</Label>
              <Input
                id="holiday-name"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="Enter the name of the holiday"
                className="mt-1"
              />
            </div>
          )}

          {(selectedTypeData?.label === 'Paid Leave' || 
            selectedTypeData?.label === 'Work From Home' ||
            selectedTypeData?.label === 'Bereavement Leave') && (
            <div>
              <Label htmlFor="reason">
                Reason {(selectedTypeData?.label === 'Paid Leave' || selectedTypeData?.label === 'Work From Home') ? '*' : ''}
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter detailed reason for leave application"
                className="mt-1"
                rows={3}
              />
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting...' : 'Submit Leave Application'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default LeaveApplicationForm;
