
import React, { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users, FileText, MessageSquare, Bell, Settings } from 'lucide-react';
import AnnualLeaveInitializer from '@/components/AnnualLeaveInitializer';
import QuickActions from '@/components/QuickActions';
import { ComprehensiveLeaveBalance } from '@/components/ComprehensiveLeaveBalance';
import TabbedLeaveApplications from '@/components/TabbedLeaveApplications';
import AllUsersOnLeave from '@/components/AllUsersOnLeave';
import EnhancedCalendar from '@/components/EnhancedCalendar';
import SlackIntegration from '@/components/SlackIntegration';
import NotificationBell from '@/components/NotificationBell';

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!user) {
      navigate('/');
      return;
    }

    // Handle Slack connection success
    const urlParams = new URLSearchParams(window.location.search);
    const slackConnected = urlParams.get('slack_connected');
    
    if (slackConnected === 'true') {
      // Clean up URL immediately
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Show success toast
      toast({
        title: "🎉 Slack Connected!",
        description: "Your Slack account has been successfully connected!",
        className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
      });
    }
  }, [user, isLoaded, navigate, toast]);

  const handleQuickAction = (action: string) => {
    // Handle quick actions
    console.log('Quick action:', action);
  };

  const handleLeaveRevert = (applicationId: string) => {
    // Handle leave revert
    console.log('Revert application:', applicationId);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Quick Actions Card */}
          <Card className="bg-white shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
              <CardDescription>Manage your leave requests and team at a glance.</CardDescription>
            </CardHeader>
            <CardContent>
              <QuickActions onActionClick={handleQuickAction} />
            </CardContent>
          </Card>

          {/* Leave Balance Card */}
          <Card className="bg-white shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Leave Balance</CardTitle>
              <CardDescription>View your comprehensive leave balance.</CardDescription>
            </CardHeader>
            <CardContent>
              <ComprehensiveLeaveBalance />
            </CardContent>
          </Card>

          {/* Slack Integration Card */}
          <Card className="bg-white shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Slack Integration</CardTitle>
              <CardDescription>Connect to Slack for notifications and updates.</CardDescription>
            </CardHeader>
            <CardContent>
              <SlackIntegration />
            </CardContent>
          </Card>

          {/* Leave Applications Tabbed Interface */}
          <Card className="bg-white shadow-md rounded-lg col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Leave Applications</CardTitle>
              <CardDescription>Manage and view your leave applications.</CardDescription>
            </CardHeader>
            <CardContent>
              <TabbedLeaveApplications applications={[]} onRevert={handleLeaveRevert} />
            </CardContent>
          </Card>

          {/* Users on Leave Card */}
          <Card className="bg-white shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Users on Leave</CardTitle>
              <CardDescription>See who is currently on leave.</CardDescription>
            </CardHeader>
            <CardContent>
              <AllUsersOnLeave />
            </CardContent>
          </Card>

          {/* Calendar Card */}
          <Card className="bg-white shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Calendar</CardTitle>
              <CardDescription>View leave days on the calendar.</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedCalendar />
            </CardContent>
          </Card>

          {/* Notification Bell Card */}
          <Card className="bg-white shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
              <CardDescription>Stay updated with leave requests and approvals.</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationBell />
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
