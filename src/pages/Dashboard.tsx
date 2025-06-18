
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Users, CheckCircle, XCircle, Clock, FileText, BarChart3, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/NotificationBell';
import LeaveApplicationForm from '@/components/LeaveApplicationForm';
import EnhancedCalendar from '@/components/EnhancedCalendar';

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  // Check if current user is admin
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

  useEffect(() => {
    if (isLoaded && user) {
      fetchUserLeaveApplications();
      initializeUserProfile();
    }
  }, [isLoaded, user]);

  const initializeUserProfile = async () => {
    try {
      // Create or update user profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          email: user?.emailAddresses[0]?.emailAddress || '',
          name: user?.fullName || user?.firstName || 'User',
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error('Error initializing user profile:', error);
      }

      // Initialize user leave balances
      await supabase.rpc('initialize_user_leave_balances', {
        user_uuid: user?.id
      });
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  };

  const fetchUserLeaveApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          leave_types (
            label,
            color
          )
        `)
        .eq('user_id', user?.id)
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

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access the dashboard.</div>;
  }

  const pendingApplications = leaveApplications.filter((app: any) => app.status === 'pending');
  const approvedApplications = leaveApplications.filter((app: any) => app.status === 'approved');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            Employee Dashboard
          </h1>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <span className="text-sm text-gray-600">Welcome, {user.firstName || 'User'}!</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>

      <div className="pt-6 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Navigation Tabs */}
          <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('apply')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'apply' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Apply Leave
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'calendar' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Calendar
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Button 
              onClick={() => navigate('/leave-types')}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center space-y-1 hover:bg-purple-50"
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm">Leave Types</span>
            </Button>
            
            <Button 
              onClick={() => navigate('/leave-balances')}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center space-y-1 hover:bg-blue-50"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm">My Balances</span>
            </Button>
            
            <Button 
              onClick={() => setActiveTab('apply')}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center space-y-1 hover:bg-green-50"
            >
              <Calendar className="w-5 h-5" />
              <span className="text-sm">Apply Leave</span>
            </Button>

            {isAdmin && (
              <Button 
                onClick={() => navigate('/admin')}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center space-y-1 hover:bg-red-50"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm">Admin Panel</span>
              </Button>
            )}
          </div>

          {/* Content based on active tab */}
          {activeTab === 'overview' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Calendar className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Applications</p>
                        <p className="text-2xl font-bold text-gray-900">{leaveApplications.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Clock className="h-8 w-8 text-yellow-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Pending</p>
                        <p className="text-2xl font-bold text-gray-900">{pendingApplications.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Approved</p>
                        <p className="text-2xl font-bold text-gray-900">{approvedApplications.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Leave Applications */}
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle>My Leave Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Leave Dates</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Reason/Holiday</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveApplications.slice(0, 10).map((application: any) => (
                        <TableRow key={application.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: application.leave_types?.color }}
                              />
                              <span>{application.leave_types?.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(application.start_date), 'MMM dd')} - {format(new Date(application.end_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {application.hours_requested ? 
                              `${application.hours_requested} hours` : 
                              `${differenceInDays(new Date(application.end_date), new Date(application.start_date)) + 1} day(s)`
                            }
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {application.holiday_name || application.reason || 'No reason provided'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              application.status === 'approved' ? 'default' :
                              application.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }>
                              {application.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(application.applied_at || application.created_at), 'MMM dd, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {leaveApplications.length === 0 && (
                    <div className="text-center py-8">
                      <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-4">No leave applications yet</p>
                      <Button 
                        onClick={() => setActiveTab('apply')}
                        className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
                      >
                        Apply for Your First Leave
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'apply' && (
            <div className="space-y-6">
              <LeaveApplicationForm />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <EnhancedCalendar />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
