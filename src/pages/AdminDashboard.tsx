import React, { useState, useEffect } from 'react';
import { useUser, useOrganizationList, useOrganization } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Calendar, CheckCircle, XCircle, Plus, Sparkles, Zap, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { UserButton } from '@clerk/clerk-react';
import NotificationBell from '@/components/NotificationBell';
import SlackIntegration from '@/components/SlackIntegration';
import LeaveApplicationsList from '@/components/LeaveApplicationsList';

const AdminDashboard = () => {
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();
  const { createOrganization } = useOrganizationList();
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [additionalLeaves, setAdditionalLeaves] = useState('');
  const [isAddingLeaves, setIsAddingLeaves] = useState(false);
  const [processingApplications, setProcessingApplications] = useState<Set<string>>(new Set());
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);
  const [adminInviteEmail, setAdminInviteEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const { toast } = useToast();

  // Check if current user is admin
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV'|| user?.id === 'user_30JDwBWQQyzlqBrhUFRCsvOjuI4';
  

  useEffect(() => {
    if (isLoaded && isAdmin) {
      fetchAllLeaveApplications();
      fetchUserProfiles();
      setupRealtimeSubscriptions();
    }
  }, [isLoaded, isAdmin]);

  const setupRealtimeSubscriptions = () => {
    console.log('Setting up real-time subscriptions...');
    
    // Subscribe to leave applications changes
    const leaveApplicationsChannel = supabase
      .channel('leave_applications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_applied_users'
        },
        (payload) => {
          console.log('Leave application change received:', payload);
          fetchAllLeaveApplications(); // Refresh the list
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leaveApplicationsChannel);
    };
  };

  const fetchUserProfiles = async () => {
    try {
      console.log('Fetching user profiles...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching user profiles:', error);
      } else {
        console.log('User profiles fetched:', data);
        setUserProfiles(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchAllLeaveApplications = async () => {
    try {
      console.log('Fetching all leave applications...');
      
      // Fetch applications with profile information using the proper join
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          profiles!fk_leave_applied_users_user_id (
            name,
            email
          ),
          leave_types (
            label,
            color
          )
        `)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('Error fetching leave applications:', error);
        // Fallback: try a simpler query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('leave_applied_users')
          .select('*')
          .order('applied_at', { ascending: false });

        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          toast({
            title: "Error",
            description: "Failed to fetch leave applications",
            variant: "destructive"
          });
          return;
        }

        // For fallback data, we need to fetch profile data separately
        const enrichedData = await Promise.all(
          (fallbackData || []).map(async (application) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('id', application.user_id)
              .single();
            
            return {
              ...application,
              profiles: profile
            };
          })
        );

        setLeaveApplications(enrichedData);
      } else {
        console.log('Leave applications with profile data:', data);
        setLeaveApplications(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch leave applications",
        variant: "destructive"
      });
    }
  };

  const handleApproveLeave = async (applicationId: string, userId: string) => {
    console.log('Approving leave application:', applicationId, 'for user:', userId);
    setProcessingApplications(prev => new Set(prev).add(applicationId));
    
    try {
      // Update the leave application status
      const { error: updateError } = await supabase
        .from('leave_applied_users')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) {
        console.error('Error updating leave application:', updateError);
        throw updateError;
      }

      // Create notification for the user
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message: '🎉 Fantastic! Your leave application has been approved! Time to plan your time off!',
          type: 'success'
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Don't throw here as the main action succeeded
      }

      // Note: Personal Slack notification is now handled automatically by database trigger

      // Show success toast
      toast({
        title: "🎊 Leave Approved Successfully!",
        description: "The employee has been notified with an exciting approval message!",
        className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-green-100 shadow-lg"
      });

      // Refresh the applications list
      fetchAllLeaveApplications();
    } catch (error) {
      console.error('Error approving leave:', error);
      toast({
        title: "Error",
        description: "Failed to approve leave application",
        variant: "destructive"
      });
    } finally {
      setProcessingApplications(prev => {
        const newSet = new Set(prev);
        newSet.delete(applicationId);
        return newSet;
      });
    }
  };

  const handleRejectLeave = async (applicationId: string, userId: string) => {
    console.log('Rejecting leave application:', applicationId, 'for user:', userId);
    setProcessingApplications(prev => new Set(prev).add(applicationId));
    
    try {
      // Update the leave application status
      const { error: updateError } = await supabase
        .from('leave_applied_users')
        .update({
          status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) {
        console.error('Error updating leave application:', updateError);
        throw updateError;
      }

      // Create notification for the user
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message: '⚠️ Your leave application has been reviewed. Please reach out to discuss alternative dates or options.',
          type: 'error'
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Don't throw here as the main action succeeded
      }

      // Note: Personal Slack notification is now handled automatically by database trigger

      // Show rejection toast
      toast({
        title: "Leave Application Processed",
        description: "The employee has been notified about the decision.",
        className: "bg-gradient-to-r from-orange-50 to-red-50 border-orange-200"
      });

      // Refresh the applications list
      fetchAllLeaveApplications();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast({
        title: "Error",
        description: "Failed to reject leave application",
        variant: "destructive"
      });
    } finally {
      setProcessingApplications(prev => {
        const newSet = new Set(prev);
        newSet.delete(applicationId);
        return newSet;
      });
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an organization name",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingOrg(true);
    try {
      await createOrganization({ name: orgName });
      
      toast({
        title: "Success",
        description: "Organization created successfully!"
      });
      
      setOrgName('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive"
      });
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleAddLeaves = async () => {
    if (!selectedUserId || !additionalLeaves) {
      toast({
        title: "Error",
        description: "Please select a user and enter number of leaves",
        variant: "destructive"
      });
      return;
    }

    setIsAddingLeaves(true);
    try {
      // Create notification for the user about additional leaves
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedUserId,
          message: `🎁 Amazing news! Admin has granted you ${additionalLeaves} additional leave days! Your leave balance has been boosted!`,
          type: 'success'
        });

      if (error) {
        console.error('Error creating notification:', error);
        throw error;
      }

      toast({
        title: "🎉 Leaves Added Successfully!",
        description: `Added ${additionalLeaves} leave days to user's account!`,
        className: "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200"
      });

      setSelectedUserId('');
      setAdditionalLeaves('');
    } catch (error) {
      console.error('Error adding leaves:', error);
      toast({
        title: "Error",
        description: "Failed to add leaves",
        variant: "destructive"
      });
    } finally {
      setIsAddingLeaves(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsSendingTestNotification(true);
    try {
      const { error } = await supabase.functions.invoke('slack-daily-notifications', {
        body: { trigger: 'manual_test' }
      });

      if (error) {
        console.error('Error sending test notification:', error);
        throw error;
      }

      toast({
        title: "🚀 Test Notification Sent!",
        description: "Daily notification has been sent to the Slack channel successfully!",
        className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive"
      });
    } finally {
      setIsSendingTestNotification(false);
    }
  };

  const handleSendAdminInvite = async () => {
    if (!adminInviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminInviteEmail)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setIsSendingInvite(true);
    try {
      const { error } = await supabase.functions.invoke('send-admin-invite', {
        body: { 
          email: adminInviteEmail,
          invitedBy: user?.id 
        }
      });

      if (error) {
        console.error('Error sending admin invite:', error);
        throw error;
      }

      toast({
        title: "🎉 Admin Invite Sent Successfully!",
        description: `An admin invitation has been sent to ${adminInviteEmail}!`,
        className: "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200"
      });

      setAdminInviteEmail("");
    } catch (error) {
      console.error('Error sending admin invite:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send admin invite",
        variant: "destructive"
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access the admin dashboard.</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Top Navigation */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <span className="text-sm text-gray-600">Admin Panel</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>

      <div className="pt-6 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <p className="text-gray-600 mt-2">Manage leave applications and organizations</p>
            </div>
            
            <div className="flex space-x-4">
              <Button 
                onClick={handleSendTestNotification}
                disabled={isSendingTestNotification}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isSendingTestNotification ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Test Slack Notification
                  </>
                )}
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        placeholder="Enter organization name..."
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateOrganization} 
                      disabled={isCreatingOrg}
                      className="w-full"
                    >
                      {isCreatingOrg ? 'Creating...' : 'Create Organization'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-700">Total Applications</p>
                    <p className="text-2xl font-bold text-blue-900">{leaveApplications.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-700">Pending</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {leaveApplications.filter((app) => app.status === 'pending').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-700">Approved</p>
                    <p className="text-2xl font-bold text-green-900">
                      {leaveApplications.filter((app) => app.status === 'approved').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Slack Integration Section */}
          <div className="mb-8">
            <SlackIntegration />
          </div>

          {/* Add Leaves Section */}
          <Card className="mb-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center text-purple-700">
                <Sparkles className="w-5 h-5 mr-2" />
                Add Additional Leaves
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="user-select">Select User</Label>
                  <select
                    id="user-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full p-2 border rounded-md mt-1 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a user...</option>
                    {userProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} ({profile.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="additional-leaves">Additional Leaves</Label>
                  <Input
                    id="additional-leaves"
                    type="number"
                    placeholder="Enter number of leaves"
                    value={additionalLeaves}
                    onChange={(e) => setAdditionalLeaves(e.target.value)}
                    className="mt-1 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <Button 
                  onClick={handleAddLeaves}
                  disabled={isAddingLeaves}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                >
                  {isAddingLeaves ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Add Leaves
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Admin Invite Section */}
          <Card className="mb-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200">
            <CardHeader>
              <CardTitle className="flex items-center text-pink-700">
                <Users className="w-5 h-5 mr-2" />
                Send Admin Invitation
              </CardTitle>
              <p className="text-sm text-pink-600 mt-2">Invite new team members to join as administrators with full access to the Timeloo dashboard.</p>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="admin-email">Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="Enter email address to invite..."
                    value={adminInviteEmail}
                    onChange={(e) => setAdminInviteEmail(e.target.value)}
                    className="mt-1 focus:ring-2 focus:ring-pink-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">They'll receive a beautifully designed email with Timeloo branding and our mascot!</p>
                </div>
                <Button 
                  onClick={handleSendAdminInvite}
                  disabled={isSendingInvite}
                  className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 shadow-lg text-white"
                >
                  {isSendingInvite ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending Invite...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Send Admin Invite
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Organization */}
          {organization && (
            <Card className="mb-8 hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Current Organization: {organization.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">You are managing the {organization.name} organization.</p>
              </CardContent>
            </Card>
          )}

          {/* Leave Applications with Pagination */}
          <LeaveApplicationsList
            applications={leaveApplications}
            title="Leave Applications Management"
            showUserName={true}
            isAdmin={true}
            onApprove={handleApproveLeave}
            onReject={handleRejectLeave}
            processingApplications={processingApplications}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
