
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarDays, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [isApplyingLeave, setIsApplyingLeave] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(20);
  const { toast } = useToast();

  useEffect(() => {
    if (user && isLoaded) {
      createOrUpdateProfile();
      fetchLeaveApplications();
      calculateLeaveBalance();
    }
  }, [user, isLoaded]);

  const createOrUpdateProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          name: user.fullName || user.firstName || '',
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Error creating/updating profile:', error);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchLeaveApplications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select('*')
        .eq('user_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('Error fetching leave applications:', error);
      } else {
        setLeaveApplications(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const calculateLeaveBalance = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select('start_date, end_date, status')
        .eq('user_id', user.id)
        .in('status', ['approved', 'pending']);

      if (error) {
        console.error('Error calculating leave balance:', error);
        return;
      }

      let usedLeaves = 0;
      data?.forEach((leave: any) => {
        const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
        usedLeaves += days;
      });

      setLeaveBalance(20 - usedLeaves);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleApplyLeave = async () => {
    if (!user || !selectedDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    const leaveDays = differenceInDays(endDate, selectedDate) + 1;
    
    if (leaveDays > leaveBalance) {
      toast({
        title: "Error",
        description: `You don't have enough leave balance. Available: ${leaveBalance} days, Requested: ${leaveDays} days`,
        variant: "destructive"
      });
      return;
    }

    setIsApplyingLeave(true);

    try {
      const { error } = await supabase
        .from('leave_applied_users')
        .insert({
          user_id: user.id,
          start_date: format(selectedDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          reason: reason || 'No reason provided',
          status: 'pending'
        });

      if (error) {
        throw error;
      }

      // Notify admin about new leave application
      await supabase
        .from('notifications')
        .insert({
          user_id: '23510de5-ed66-402d-9511-0c8de9f59ad7', // Admin ID
          message: `${user.fullName || user.firstName} has applied for leave from ${format(selectedDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}`,
          type: 'info'
        });

      toast({
        title: "Success",
        description: "Leave application submitted successfully!"
      });

      setSelectedDate(undefined);
      setEndDate(undefined);
      setReason('');
      setIsDialogOpen(false);
      fetchLeaveApplications();
      calculateLeaveBalance();

    } catch (error) {
      console.error('Error applying for leave:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave application",
        variant: "destructive"
      });
    } finally {
      setIsApplyingLeave(false);
    }
  };

  const handleRevertLeave = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('leave_applied_users')
        .delete()
        .eq('id', applicationId)
        .eq('user_id', user?.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Leave application reverted successfully!"
      });

      fetchLeaveApplications();
      calculateLeaveBalance();
    } catch (error) {
      console.error('Error reverting leave:', error);
      toast({
        title: "Error",
        description: "Failed to revert leave application",
        variant: "destructive"
      });
    }
  };

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access the dashboard.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user.firstName}!</h1>
            <p className="text-gray-600 mt-2">Leave Balance: {leaveBalance} days remaining</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <div className="mt-2 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (endDate && date && endDate < date) {
                          setEndDate(undefined);
                        }
                      }}
                      className="rounded-md border"
                      disabled={(date) => date < new Date()}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <div className="mt-2 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      className="rounded-md border"
                      disabled={(date) => date < (selectedDate || new Date())}
                    />
                  </div>
                </div>

                {selectedDate && endDate && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Leave Duration: {differenceInDays(endDate, selectedDate) + 1} day(s)
                    </p>
                    <p className="text-sm text-blue-600">
                      From {format(selectedDate, 'MMM dd, yyyy')} to {format(endDate, 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter reason for leave..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button 
                  onClick={handleApplyLeave} 
                  disabled={isApplyingLeave || !selectedDate || !endDate}
                  className="w-full"
                >
                  {isApplyingLeave ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDays className="w-5 h-5 mr-2" />
                  Calendar View
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border w-full"
                  classNames={{
                    months: "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 flex-1",
                    month: "space-y-4 w-full flex flex-col",
                    table: "w-full h-full border-collapse space-y-1",
                    head_row: "flex w-full",
                    head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem] flex-1",
                    row: "flex w-full mt-2",
                    cell: "h-14 w-full text-center text-sm p-0 relative flex-1",
                    day: "h-14 w-full p-0 font-normal hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Leave Applications Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Leave Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaveApplications.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No leave applications yet</p>
                  ) : (
                    leaveApplications.map((application: any) => (
                      <div key={application.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {format(new Date(application.start_date), 'MMM dd')} - {format(new Date(application.end_date), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-sm text-gray-600">{application.reason}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              application.status === 'approved' ? 'bg-green-100 text-green-800' :
                              application.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {application.status}
                            </span>
                            {application.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRevertLeave(application.id)}
                                className="p-1 h-6 w-6"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          Applied: {format(new Date(application.applied_at), 'MMM dd, yyyy')}
                        </p>
                        <p className="text-xs text-blue-600">
                          Duration: {differenceInDays(new Date(application.end_date), new Date(application.start_date)) + 1} day(s)
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
