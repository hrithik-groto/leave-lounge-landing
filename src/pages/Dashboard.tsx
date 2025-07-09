import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarDays, Plus, X, LogOut, FileText, Clock, Shield, AlertCircle, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/NotificationBell';
import SlackOAuthButton from '@/components/SlackOAuthButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EnhancedLeaveApplicationForm from '@/components/EnhancedLeaveApplicationForm';
import EnhancedCalendar from '@/components/EnhancedCalendar';
import LeaveApplicationsList from '@/components/LeaveApplicationsList';

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [isApplyingLeave, setIsApplyingLeave] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

      // Send Slack notification to channel and individual user
      try {
        await supabase.functions.invoke('slack-notify', {
          body: {
            leaveApplication: {
              user_id: user.id,
              start_date: format(selectedDate, 'yyyy-MM-dd'),
              end_date: format(endDate, 'yyyy-MM-dd'),
              reason: reason || 'No reason provided',
              status: 'pending',
              applied_at: new Date().toISOString()
            },
            isTest: false,
            sendToUser: true
          }
        });
      } catch (slackError) {
        console.error('Error sending Slack notification:', slackError);
        // Don't fail the leave application if Slack fails
      }

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
              <span>Paid Leave</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-2">Regular vacation time for rest and relaxation.</p>
            <p className="text-xs text-gray-500">• 1.5 days per month</p>
            <p className="text-xs text-gray-500">• Requires approval</p>
            <p className="text-xs text-gray-500">• Full day only</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Work From Home</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-2">Remote work days for better work-life balance.</p>
            <p className="text-xs text-gray-500">• 2 days per month</p>
            <p className="text-xs text-gray-500">• No approval required</p>
            <p className="text-xs text-gray-500">• Full day only</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Short Leave</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-2">Hourly leave for appointments and personal matters.</p>
            <p className="text-xs text-gray-500">• 4 hours per month</p>
            <p className="text-xs text-gray-500">• No approval required</p>
            <p className="text-xs text-gray-500">• Min 1 hour, max 4 hours per request</p>
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
            <CardTitle>Monthly Leave Entitlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                Paid Leave
              </h4>
              <p className="text-gray-600 text-sm">1.5 days per month. Requires management approval. Must be requested in advance.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                Work From Home
              </h4>
              <p className="text-gray-600 text-sm">2 days per month. No approval required. Can be used for better work-life balance.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                Short Leave
              </h4>
              <p className="text-gray-600 text-sm">4 hours per month. No approval required. For appointments and personal matters. Minimum 1 hour blocks.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Leave Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Monthly Reset</h4>
              <p className="text-gray-600 text-sm">All leave balances reset at the beginning of each month. Unused leave does not carry forward.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Short Leave Usage</h4>
              <p className="text-gray-600 text-sm">Short leaves can be taken in 1-hour increments and must be within regular working hours (9 AM - 6 PM).</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Approval Process</h4>
              <p className="text-gray-600 text-sm">Paid leaves require manager approval. WFH and Short leaves are automatically approved upon submission.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Cancellation Policy</h4>
              <p className="text-gray-600 text-sm">Leave can be cancelled before the start date. Contact your manager for approved leave cancellations.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Slack Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Slack Commands</h4>
              <p className="text-gray-600 text-sm">Use <code className="bg-gray-100 px-1 rounded">/leaves</code> command in Slack to apply for leave directly from your workspace.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Notifications</h4>
              <p className="text-gray-600 text-sm">Connect your Slack account to receive real-time notifications about leave status updates.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Enhanced Leave Application Form */}
      <EnhancedLeaveApplicationForm onSuccess={() => {
        fetchLeaveApplications();
        calculateLeaveBalance();
      }} />

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Calendar Section */}
        <EnhancedCalendar onRefresh={() => {
          fetchLeaveApplications();
          calculateLeaveBalance();
        }} />

        {/* Leave Applications Section with Pagination */}
        <LeaveApplicationsList
          applications={leaveApplications}
          onRevert={handleRevertLeave}
          title="Your Leave Applications"
        />
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
