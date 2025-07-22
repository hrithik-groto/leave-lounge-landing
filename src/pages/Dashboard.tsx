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
import { EnhancedLeaveApplicationForm } from '@/components/EnhancedLeaveApplicationForm';
import EnhancedCalendar from '@/components/EnhancedCalendar';
import TabbedLeaveApplications from '@/components/TabbedLeaveApplications';
import SlackOAuthButton from '@/components/SlackOAuthButton';
import TimelooMascot from '@/components/TimelooMascot';
import { ComprehensiveLeaveBalance } from '@/components/ComprehensiveLeaveBalance';

import confetti from 'canvas-confetti';

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(20);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [shouldMascotWave, setShouldMascotWave] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const calendarRef = useRef<{ openApplyDialog: () => void } | null>(null);

  // Check if current user is admin
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV' || user?.id === 'user_2yaD1O0ZB5G9XOkaJfKPDYS28qF';

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
    calculateLeaveBalance();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleApplyLeaveClick = () => {
    calendarRef.current?.openApplyDialog();
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
      setRefreshTrigger(prev => prev + 1);
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
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-2 sm:space-x-6 justify-center sm:justify-start">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 hover:scale-105 ${
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
        <div className="flex items-center space-x-2 sm:space-x-4">
          <SlackOAuthButton />
          <NotificationBell />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </div>
  );

  const renderLeaveTypes = () => (
    <div className="space-y-6 px-4 sm:px-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Leave Types</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
    <div className="space-y-6 px-4 sm:px-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Leave Balance Overview</h2>
      <ComprehensiveLeaveBalance refreshTrigger={refreshTrigger} />
    </div>
  );

  const renderPolicies = () => (
    <div className="space-y-6 px-4 sm:px-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Leave Policies</h2>
      <div className="space-y-4 sm:space-y-6">
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
    <div className="space-y-6 sm:space-y-8 relative px-4 sm:px-0">
      {/* Floating particles background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-300 rounded-full animate-pulse opacity-30"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-pink-300 rounded-full animate-bounce opacity-40"></div>
        <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 bg-blue-300 rounded-full animate-ping opacity-25"></div>
        <div className="absolute top-1/6 right-1/3 w-1 h-1 bg-green-300 rounded-full animate-pulse opacity-30"></div>
      </div>

      {/* Apply Leave CTA */}
      <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">Ready to Take Some Time Off?</h3>
              <p className="text-purple-100 text-sm sm:text-base">Apply for leave with just a few clicks</p>
            </div>
            <Button 
              onClick={handleApplyLeaveClick}
              className="bg-white text-purple-600 hover:bg-purple-50 hover:scale-105 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-2 sm:py-3 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Apply Leave
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Balance Alert */}
      {leaveBalance <= 0 && (
        <Alert className="border-red-200 bg-red-50 animate-pulse">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You have exhausted all your annual leave days. Please contact HR if you need additional leave.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Enhanced Calendar Section */}
        <EnhancedCalendar ref={calendarRef} onRefresh={handleLeaveSuccess} />

        {/* Leave Applications Section with Tabs */}
        <TabbedLeaveApplications
          applications={leaveApplications}
          onRevert={handleRevertLeave}
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 px-4 sm:px-0">
      {renderNavbar()}
      <div className="pt-6 px-4">
        <div className="max-w-7xl mx-auto">
          {currentPage === 'dashboard' && renderDashboard()}
          {currentPage === 'leave-types' && renderLeaveTypes()}
          {currentPage === 'leaves-remaining' && renderLeavesRemaining()}
          {currentPage === 'policies' && renderPolicies()}
        </div>
      </div>
      
      {/* Timeloo Mascot */}
      <TimelooMascot 
        shouldWave={shouldMascotWave} 
        onWaveComplete={() => setShouldMascotWave(false)}
        showMessage={true}
        message={`Welcome ${user?.firstName || 'User'}!`}
      />
    </div>
  );
};

export default Dashboard;
