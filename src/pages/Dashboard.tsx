import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarDays, Plus, FileText, Clock, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/NotificationBell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EnhancedLeaveApplicationForm from '@/components/EnhancedLeaveApplicationForm';
import EnhancedCalendar from '@/components/EnhancedCalendar';
import LeaveApplicationsList from '@/components/LeaveApplicationsList';
import SlackOAuthButton from '@/components/SlackOAuthButton';
import TimelooMascot from '@/components/TimelooMascot';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import confetti from 'canvas-confetti';

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [shouldMascotWave, setShouldMascotWave] = useState(false);
  const [showLeaveRequestForm, setShowLeaveRequestForm] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const calendarRef = useRef<{ openApplyDialog: () => void } | null>(null);

  // Check if current user is admin
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

  useEffect(() => {
    if (user && isLoaded) {
      createOrUpdateProfile();
      fetchLeaveApplications();
      fetchLeaveBalances();
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

  const fetchLeaveBalances = async () => {
    if (!user) return;

    try {
      // Get all leave types
      const { data: leaveTypes, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true);

      if (leaveTypesError) {
        console.error('Error fetching leave types:', leaveTypesError);
        return;
      }

      // Calculate balances for each leave type
      const balances = await Promise.all(
        (leaveTypes || []).map(async (leaveType: any) => {
          const { data: balanceData } = await supabase.rpc('get_monthly_leave_balance', {
            p_user_id: user.id,
            p_leave_type_id: leaveType.id
          });

          return {
            ...leaveType,
            balance: balanceData || { monthly_allowance: 0, used_this_month: 0, remaining_this_month: 0 }
          };
        })
      );

      setLeaveBalances(balances);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
    }
  };

  const triggerConfetti = () => {
    // Left side confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0, y: 0.6 },
      colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b']
    });
    
    // Right side confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 1, y: 0.6 },
      colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b']
    });
  };

  const handleLeaveSuccess = () => {
    triggerConfetti();
    setShouldMascotWave(true);
    fetchLeaveApplications();
    fetchLeaveBalances();
  };

  const handleApplyLeaveClick = () => {
    // Check if all leave types are exhausted
    const allExhausted = leaveBalances.length > 0 && leaveBalances.every((type: any) => type.balance.remaining_this_month <= 0);
    if (!allExhausted) {
      calendarRef.current?.openApplyDialog();
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
      fetchLeaveBalances();
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
    <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex space-x-6">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 ${
              currentPage === 'dashboard' ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 shadow-md' : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setCurrentPage('leave-types')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 ${
              currentPage === 'leave-types' ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 shadow-md' : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Leave Types</span>
          </button>
          <button
            onClick={() => setCurrentPage('leaves-remaining')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 ${
              currentPage === 'leaves-remaining' ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 shadow-md' : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Leaves Remaining</span>
          </button>
          <button
            onClick={() => setCurrentPage('policies')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 ${
              currentPage === 'policies' ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 shadow-md' : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Policies</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-300 hover:scale-105"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <SlackOAuthButton />
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
      <h2 className="text-2xl font-bold text-gray-900">Leave Balances</h2>
      
      {/* Individual Leave Type Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaveBalances.map((leaveType: any) => (
          <Card key={leaveType.id} className="border-l-4" style={{ borderLeftColor: leaveType.color }}>
            <CardContent className="p-4">
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 mb-2">{leaveType.label}</h3>
                <div className="text-2xl font-bold mb-1" style={{ color: leaveType.color }}>
                  {leaveType.balance.remaining_this_month || 0}
                </div>
                <div className="text-sm text-gray-600">
                  {leaveType.balance.duration_type === 'hours' ? 'Hours' : 'Days'} Remaining
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Used: {leaveType.balance.used_this_month || 0} / {leaveType.balance.monthly_allowance || 0}
                </div>
                {leaveType.balance.remaining_this_month <= 0 && (
                  <div className="mt-2 p-2 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-700">All {leaveType.label.toLowerCase()} used!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Warning for low balances */}
      {leaveBalances.some((type: any) => type.balance.remaining_this_month <= 1) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You're running low on some leave types. Plan accordingly!
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Leave History</CardTitle>
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
                    {app.leave_duration_type === 'hours' ? `${app.hours_requested}h` : `${differenceInDays(new Date(app.end_date), new Date(app.start_date)) + 1} days`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>This Month's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
              <div className="flex justify-between">
                <span>Total leave types:</span>
                <span className="font-medium">{leaveBalances.length} types</span>
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
    <div className="space-y-8 relative">

      {/* Apply Leave CTA */}
      <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Ready to Take Some Time Off?</h3>
              <p className="text-purple-100">
                {leaveBalances.every((type: any) => type.balance.remaining_this_month <= 0) 
                  ? "All leave types exhausted. Request additional leave below." 
                  : "Apply for leave with just a few clicks"
                }
              </p>
            </div>
            <Button 
              onClick={handleApplyLeaveClick}
              disabled={leaveBalances.every((type: any) => type.balance.remaining_this_month <= 0)}
              className="bg-white text-purple-600 hover:bg-purple-50 hover:scale-105 transition-all duration-300 shadow-lg font-semibold px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Plus className="w-4 h-4 mr-2" />
              Apply Leave
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Balance Alert - Only show when ALL leave types are exhausted */}
      {leaveBalances.every((type: any) => type.balance.remaining_this_month <= 0) && leaveBalances.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            All leave types are exhausted. Please contact HR for additional leave requests.
          </AlertDescription>
        </Alert>
      )}

      {/* Leave Request Form Dialog */}
      <Dialog open={showLeaveRequestForm} onOpenChange={setShowLeaveRequestForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Additional Leave</DialogTitle>
          </DialogHeader>
          <LeaveRequestForm onSuccess={() => setShowLeaveRequestForm(false)} />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Calendar Section */}
        <EnhancedCalendar 
          ref={calendarRef} 
          onRefresh={handleLeaveSuccess}
          isLeaveExhausted={leaveBalances.length > 0 && leaveBalances.every((type: any) => type.balance.remaining_this_month <= 0)}
        />

        {/* Leave Applications Section with Pagination */}
        <LeaveApplicationsList
          applications={leaveApplications}
          onRevert={handleRevertLeave}
          title="Your Leave Applications"
        />
      </div>

      {/* Timeloo Mascot */}
      <TimelooMascot 
        shouldWave={shouldMascotWave} 
        onWaveComplete={() => setShouldMascotWave(false)}
      />
    </div>
  );

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access the dashboard.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
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
