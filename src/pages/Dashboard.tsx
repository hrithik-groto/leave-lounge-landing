import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarDays, Plus, X, LogOut, FileText, Clock, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/NotificationBell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LeaveCalendar from '@/components/ui/leave-calendar';
import { useLeaveApplication } from '@/hooks/useLeaveApplication';

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const { 
    isDialogOpen, 
    selectedDate, 
    endDate, 
    setSelectedDate, 
    setEndDate, 
    openLeaveDialog, 
    closeLeaveDialog 
  } = useLeaveApplication();
  const [reason, setReason] = useState('');
  const [isApplyingLeave, setIsApplyingLeave] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(20);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if current user is admin
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

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
    
    // Check if requested days exceed 20
    if (leaveDays > 20) {
      toast({
        title: "Error",
        description: "You cannot apply for more than 20 days of leave at once",
        variant: "destructive"
      });
      return;
    }
    
    if (leaveDays > leaveBalance) {
      toast({
        title: "Insufficient Leave Balance",
        description: `You don't have enough leave balance. Available: ${leaveBalance} days, Requested: ${leaveDays} days`,
        variant: "destructive"
      });
      return;
    }

    if (leaveBalance <= 0) {
      toast({
        title: "No Leave Balance",
        description: "You have used all your annual leave. Please contact HR for additional leave requests.",
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
          message: `${user.fullName || user.firstName} has applied for leave from ${format(selectedDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')} (${leaveDays} days)`,
          type: 'info'
        });

      toast({
        title: "Success",
        description: "Leave application submitted successfully!"
      });

      setSelectedDate(undefined);
      setEndDate(undefined);
      setReason('');
      closeLeaveDialog();
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
        .eq('user_id', user?.id)
        .eq('status', 'pending'); // Only allow deletion of pending applications

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Leave application cancelled successfully!"
      });

      fetchLeaveApplications();
      calculateLeaveBalance();
    } catch (error) {
      console.error('Error cancelling leave:', error);
      toast({
        title: "Error",
        description: "Failed to cancel leave application",
        variant: "destructive"
      });
    }
  };

  const renderNavbar = () => (
    <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex space-x-6">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'dashboard' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setCurrentPage('leave-types')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'leave-types' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Leave Types</span>
          </button>
          <button
            onClick={() => setCurrentPage('leaves-remaining')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'leaves-remaining' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Leaves Remaining</span>
          </button>
          <button
            onClick={() => setCurrentPage('policies')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'policies' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Policies</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <NotificationBell />
          <span className="text-sm text-gray-600">Welcome, {user?.firstName}!</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </div>
  );

  const renderLeaveTypes = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Leave Types</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Annual Leave</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-2">Regular vacation time for rest and relaxation.</p>
            <p className="text-xs text-gray-500">• 20 days per year</p>
            <p className="text-xs text-gray-500">• Can be carried forward</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Sick Leave</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-2">Time off for medical appointments and illness.</p>
            <p className="text-xs text-gray-500">• As needed basis</p>
            <p className="text-xs text-gray-500">• Medical certificate required</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Personal Leave</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-2">Emergency or personal matters requiring time off.</p>
            <p className="text-xs text-gray-500">• Subject to approval</p>
            <p className="text-xs text-gray-500">• Advance notice preferred</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderLeavesRemaining = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Leave Balance</h2>
      <Card className={`${leaveBalance > 0 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-red-500 to-orange-500'} text-white`}>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{leaveBalance}</div>
            <div className="text-lg opacity-90">Days Remaining</div>
            <div className="text-sm opacity-75 mt-2">Out of 20 annual days</div>
            {leaveBalance <= 0 && (
              <div className="mt-3 p-2 bg-white/20 rounded-lg">
                <p className="text-sm">All leave days used! Contact HR for additional requests.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {leaveBalance <= 5 && leaveBalance > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {leaveBalance} leave days remaining. Plan your time off carefully!
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaveApplications.slice(0, 5).map((app: any) => (
                <div key={app.id} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">{format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd')}</p>
                    <p className="text-sm text-gray-500">{app.status}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {differenceInDays(new Date(app.end_date), new Date(app.start_date)) + 1} days
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Used this year:</span>
                <span className="font-medium">{20 - leaveBalance} days</span>
              </div>
              <div className="flex justify-between">
                <span>Pending approval:</span>
                <span className="font-medium">
                  {leaveApplications.filter((app: any) => app.status === 'pending').length} applications
                </span>
              </div>
              <div className="flex justify-between">
                <span>Approved leaves:</span>
                <span className="font-medium">
                  {leaveApplications.filter((app: any) => app.status === 'approved').length} applications
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Leave Policies</h2>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General Leave Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Annual Leave Entitlement</h4>
              <p className="text-gray-600 text-sm">All employees are entitled to 20 days of annual leave per calendar year.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Application Process</h4>
              <p className="text-gray-600 text-sm">Leave applications must be submitted at least 2 weeks in advance for approval.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Approval Requirements</h4>
              <p className="text-gray-600 text-sm">All leave requests require manager approval and are subject to operational requirements.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Maximum Days Per Request</h4>
              <p className="text-gray-600 text-sm">You cannot apply for more than 20 days of leave in a single request.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Leave Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Maximum Consecutive Days</h4>
              <p className="text-gray-600 text-sm">Employees may take a maximum of 10 consecutive days without special approval.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Cancellation Policy</h4>
              <p className="text-gray-600 text-sm">Leave can be cancelled before approval without penalty. Approved leave cancellation requires manager consent.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Emergency Leave</h4>
              <p className="text-gray-600 text-sm">In case of emergencies, employees should contact their manager immediately.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Leave Balance Alert */}
      {leaveBalance <= 0 && (
        <div className="lg:col-span-3 mb-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              You have exhausted all your annual leave days. Please contact HR if you need additional leave.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Calendar Section */}
      <div className="lg:col-span-2">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <CalendarDays className="w-5 h-5 mr-2" />
                Calendar View
              </CardTitle>
              
              <Dialog open={isDialogOpen} onOpenChange={(open) => open ? openLeaveDialog() : closeLeaveDialog()}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white"
                    disabled={leaveBalance <= 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Apply for Leave
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Apply for Leave</DialogTitle>
                  </DialogHeader>
                  
                  {leaveBalance <= 0 ? (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        You have no remaining leave days. Please contact HR for additional leave requests.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          Available leave balance: <strong>{leaveBalance} days</strong>
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Maximum 20 days per request
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      </div>

                      {selectedDate && endDate && (
                        <div className="p-4 bg-blue-50 rounded-lg animate-fade-in">
                          <p className="text-sm text-blue-800">
                            Leave Duration: {differenceInDays(endDate, selectedDate) + 1} day(s)
                          </p>
                          <p className="text-sm text-blue-600">
                            From {format(selectedDate, 'MMM dd, yyyy')} to {format(endDate, 'MMM dd, yyyy')}
                          </p>
                          {differenceInDays(endDate, selectedDate) + 1 > 20 && (
                            <p className="text-sm text-red-600 mt-2">
                              ⚠️ Cannot apply for more than 20 days at once
                            </p>
                          )}
                          {differenceInDays(endDate, selectedDate) + 1 > leaveBalance && (
                            <p className="text-sm text-red-600 mt-2">
                              ⚠️ Insufficient leave balance
                            </p>
                          )}
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
                        disabled={isApplyingLeave || !selectedDate || !endDate || 
                          (selectedDate && endDate && 
                            (differenceInDays(endDate, selectedDate) + 1 > 20 || 
                             differenceInDays(endDate, selectedDate) + 1 > leaveBalance)
                          )}
                        className="w-full"
                      >
                        {isApplyingLeave ? 'Submitting...' : 'Submit Application'}
                      </Button>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <LeaveCalendar 
              onDayClick={(date) => openLeaveDialog(date)}
              className="w-full"
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
                  <div key={application.id} className="border rounded-lg p-4 space-y-2 hover:shadow-md transition-shadow duration-200">
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
                            className="p-1 h-6 w-6 hover:bg-red-50 hover:border-red-300"
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
  );

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access the dashboard.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderNavbar()}
      <div className="pt-6 px-4">
        <div className="max-w-7xl mx-auto">
          {currentPage === 'dashboard' && renderDashboard()}
          {currentPage === 'leave-types' && renderLeaveTypes()}
          {currentPage === 'leaves-remaining' && renderLeavesRemaining()}
          {currentPage === 'policies' && renderPolicies()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
