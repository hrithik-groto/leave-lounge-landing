
import React, { useState, useEffect } from 'react';
import { useUser, useOrganizationList, useOrganization } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Calendar, CheckCircle, XCircle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();
  const { createOrganization } = useOrganizationList();
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isLoaded) {
      fetchAllLeaveApplications();
    }
  }, [isLoaded]);

  const fetchAllLeaveApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          profiles:user_id (
            name,
            email
          )
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

  const handleApproveLeave = async (applicationId: string, userId: string) => {
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

      // Create notification for the user
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message: 'Your leave application has been approved!',
          type: 'success'
        });

      toast({
        title: "Success",
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

  const handleRejectLeave = async (applicationId: string, userId: string) => {
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
          message: 'Your leave application has been rejected.',
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

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access the admin dashboard.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage leave applications and organizations</p>
          </div>
          
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
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
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {leaveApplications.filter((app: any) => app.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-purple-600" />
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

        {/* Current Organization */}
        {organization && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Current Organization: {organization.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">You are managing the {organization.name} organization.</p>
            </CardContent>
          </Card>
        )}

        {/* Leave Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Leave Dates</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveApplications.map((application: any) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium">
                      {application.profiles?.name || 'Unknown User'}
                    </TableCell>
                    <TableCell>{application.profiles?.email || 'No email'}</TableCell>
                    <TableCell>
                      {format(new Date(application.start_date), 'MMM dd')} - {format(new Date(application.end_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{application.reason || 'No reason provided'}</TableCell>
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
                            onClick={() => handleApproveLeave(application.id, application.user_id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectLeave(application.id, application.user_id)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {leaveApplications.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No leave applications found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
