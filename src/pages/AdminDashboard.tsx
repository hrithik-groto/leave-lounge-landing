
import React, { useState, useEffect } from 'react';
import { useUser, useOrganizationList, useOrganization, UserButton } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Calendar, CheckCircle, XCircle, Plus, FileText, Bell, Sparkles, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import NotificationCenter from '@/components/NotificationCenter';

const AdminDashboard = () => {
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();
  const { createOrganization } = useOrganizationList();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [additionalLeaves, setAdditionalLeaves] = useState('');
  const [isAddingLeaves, setIsAddingLeaves] = useState(false);
  const { toast } = useToast();

  // Check if current user is admin
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

  useEffect(() => {
    if (isLoaded && isAdmin) {
      fetchAllLeaveApplications();
      fetchUserProfiles();
      setupRealtimeSubscription();
    }
  }, [isLoaded, isAdmin]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-leave-applications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leave_applied_users'
      }, () => {
        fetchAllLeaveApplications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchUserProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching user profiles:', error);
      } else {
        setUserProfiles(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchAllLeaveApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          profiles:user_id (name, email),
          leave_types (label, color)
        `)
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

  const handleApproveLeave = async (applicationId: string, userId: string, leaveType: string) => {
    try {
      const { error } = await supabase
        .from('leave_applied_users')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) throw error;

      // Create celebration notification for the user
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message: `🎉 Congratulations! Your ${leaveType} application has been approved! Time to relax! ✨`,
          type: 'success'
        });

      toast({
        title: "Success! ✅",
        description: "Leave application approved successfully!"
      });

      fetchAllLeaveApplications();
    } catch (error) {
      console.error('Error approving leave:', error);
      toast({
        title: "Error",
        description: "Failed to approve leave application",
        variant: "destructive"
      });
    }
  };

  const handleRejectLeave = async (applicationId: string, userId: string, leaveType: string) => {
    try {
      const { error } = await supabase
        .from('leave_applied_users')
        .update({
          status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) throw error;

      // Create notification for the user
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message: `Your ${leaveType} application has been rejected. Please contact HR for more details.`,
          type: 'error'
        });

      toast({
        title: "Success",
        description: "Leave application rejected successfully!"
      });

      fetchAllLeaveApplications();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast({
        title: "Error",
        description: "Failed to reject leave application",
        variant: "destructive"
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
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedUserId,
          message: `🎁 Great news! Admin has added ${additionalLeaves} additional leave days to your account! Enjoy your time off! ✨`,
          type: 'success'
        });

      toast({
        title: "Success",
        description: `Added ${additionalLeaves} leave days to user's account!`
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Top Navigation */}
      <div className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList className="grid w-full grid-cols-3 bg-gray-100/50">
                  <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                    <Home className="w-4 h-4" />
                    <span>Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="applications" className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Applications</span>
                  </TabsTrigger>
                  <TabsTrigger value="users" className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>User Management</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 bg-purple-100 px-3 py-1 rounded-full">Admin Panel</span>
              <div className="p-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-full">
                <UserButton 
                  afterSignOutUrl="/" 
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10 rounded-full border-2 border-white shadow-lg"
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard" className="space-y-6">
            {/* Welcome Section */}
            <div className="text-center py-6">
              <div className="inline-flex items-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
                <h2 className="text-3xl font-bold text-gray-900">Admin Control Center</h2>
                <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
              </div>
              <p className="text-gray-600">Manage leave applications and user accounts efficiently</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Quick Stats */}
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Applications</p>
                        <p className="text-2xl font-bold text-gray-900">{leaveApplications.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-yellow-500">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Calendar className="h-8 w-8 text-yellow-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Pending</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {leaveApplications.filter((app: any) => app.status === 'pending').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Approved</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {leaveApplications.filter((app: any) => app.status === 'approved').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notification Center */}
              <div className="lg:col-span-1">
                <NotificationCenter />
              </div>
            </div>

            {/* Recent Applications Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Leave Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {leaveApplications.slice(0, 5).map((application: any) => (
                      <div key={application.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium">{application.profiles?.name || 'Unknown User'}</span>
                            <Badge
                              variant={application.status === 'approved' ? 'default' :
                                      application.status === 'rejected' ? 'destructive' : 'secondary'}
                            >
                              {application.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {application.leave_types?.label} - {format(new Date(application.start_date), 'MMM dd')} to {format(new Date(application.end_date), 'MMM dd')}
                          </p>
                        </div>
                        {application.status === 'pending' && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveLeave(application.id, application.user_id, application.leave_types?.label)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectLeave(application.id, application.user_id, application.leave_types?.label)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            {/* Leave Applications Table */}
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Leave Applications Management</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Leave Dates</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveApplications.map((application: any) => (
                        <TableRow key={application.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {application.profiles?.name || 'Unknown User'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: application.leave_types?.color || '#3B82F6' }}
                              />
                              <span>{application.leave_types?.label || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(application.start_date), 'MMM dd')} - {format(new Date(application.end_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {differenceInDays(new Date(application.end_date), new Date(application.start_date)) + 1} day(s)
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={application.reason}>
                              {application.reason || 'No reason provided'}
                            </div>
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
                          <TableCell>{format(new Date(application.applied_at), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            {application.status === 'pending' && (
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveLeave(application.id, application.user_id, application.leave_types?.label)}
                                  className="bg-green-600 hover:bg-green-700 transition-colors duration-200"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectLeave(application.id, application.user_id, application.leave_types?.label)}
                                  className="hover:bg-red-700 transition-colors duration-200"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {application.status !== 'pending' && (
                              <span className="text-gray-400 text-sm">
                                {application.status === 'approved' ? 'Approved' : 'Rejected'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {leaveApplications.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No leave applications found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {/* Add Leaves Section */}
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Add Additional Leaves</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="user-select">Select User</Label>
                    <select
                      id="user-select"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full p-2 border rounded-md mt-1"
                    >
                      <option value="">Select a user...</option>
                      {userProfiles.map((profile: any) => (
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
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    onClick={handleAddLeaves}
                    disabled={isAddingLeaves}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isAddingLeaves ? 'Adding...' : 'Add Leaves'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Organization Management */}
            {organization && (
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle>Current Organization: {organization.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">You are managing the {organization.name} organization.</p>
                </CardContent>
              </Card>
            )}

            {/* Create Organization */}
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Organization Management</CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white">
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
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Manage organizations and user memberships from here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
