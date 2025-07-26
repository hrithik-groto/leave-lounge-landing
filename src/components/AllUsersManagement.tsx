
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Shield, User, Crown, Settings, AlertTriangle } from 'lucide-react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { format } from 'date-fns';

export const AllUsersManagement = () => {
  const { allUsers, isLoadingUsers, updateUserRole, isAdmin, isHardcodedAdmin } = useUserRoles();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  console.log('AllUsersManagement render:', { isAdmin, isHardcodedAdmin, allUsers });

  // Only hardcoded admins can access this page
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-12">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-red-800">Access Denied</h2>
                <p className="text-red-600 max-w-md mx-auto">
                  You don't have permission to access this page. Only system administrators can manage user roles.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoadingUsers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="p-12">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                <h3 className="text-lg font-medium text-gray-700">Loading Users</h3>
                <p className="text-gray-500">Please wait while we fetch all user data...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleRoleChange = (userId: string, newRole: 'admin' | 'user') => {
    setSelectedUserId(userId);
    setSelectedRole(newRole);
    setShowConfirmDialog(true);
  };

  const confirmRoleChange = () => {
    if (selectedUserId && selectedRole) {
      updateUserRole.mutate({ userId: selectedUserId, newRole: selectedRole });
      setShowConfirmDialog(false);
      setSelectedUserId(null);
    }
  };

  const selectedUser = allUsers?.find(u => u.id === selectedUserId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-gray-600">Manage user roles and permissions across the platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <Crown className="h-3 w-3 mr-1" />
                Admin Access
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-blue-900">{allUsers?.length || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 font-medium">Admin Users</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {allUsers?.filter(user => user.role === 'admin').length || 0}
                  </p>
                </div>
                <Crown className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 font-medium">Regular Users</p>
                  <p className="text-3xl font-bold text-green-900">
                    {allUsers?.filter(user => user.role === 'user').length || 0}
                  </p>
                </div>
                <User className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-xl border-b">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Settings className="h-5 w-5" />
              All Users & Role Management
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Manage user roles and permissions. System administrators have full access to both webapp and Slack integration features.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-700">User</TableHead>
                    <TableHead className="font-semibold text-gray-700">Email</TableHead>
                    <TableHead className="font-semibold text-gray-700">Current Role</TableHead>
                    <TableHead className="font-semibold text-gray-700">Member Since</TableHead>
                    <TableHead className="font-semibold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers?.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            user.role === 'admin' ? 'bg-purple-100' : 'bg-gray-100'
                          }`}>
                            {user.role === 'admin' ? (
                              <Crown className="h-5 w-5 text-purple-600" />
                            ) : (
                              <User className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.name || 'Anonymous User'}
                            </p>
                            {user.isHardcodedAdmin && (
                              <p className="text-xs text-purple-600 font-medium">System Admin</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-gray-600">{user.email}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' 
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }>
                            {user.role === 'admin' ? 'Administrator' : 'User'}
                          </Badge>
                          {user.isHardcodedAdmin && (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Protected
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-gray-600">
                        {format(new Date(user.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="py-4">
                        {user.isHardcodedAdmin ? (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Shield className="h-4 w-4" />
                            System Protected
                          </div>
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={(value: 'admin' | 'user') => handleRoleChange(user.id, value)}
                            disabled={updateUserRole.isPending}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {allUsers?.length === 0 && (
              <div className="text-center py-16">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
                <p className="text-gray-500">There are no users in the system yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Change Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirm Role Change
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Are you sure you want to change <strong>{selectedUser?.name || 'this user'}</strong>'s role to{' '}
                  <strong className={selectedRole === 'admin' ? 'text-purple-600' : 'text-gray-600'}>
                    {selectedRole === 'admin' ? 'Administrator' : 'User'}
                  </strong>?
                </p>
                
                {selectedRole === 'admin' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-purple-800 text-sm font-medium">
                      ⚡ Admin privileges include:
                    </p>
                    <ul className="text-purple-700 text-sm mt-2 space-y-1">
                      <li>• Full access to webapp admin features</li>
                      <li>• Slack app management capabilities</li>
                      <li>• User role management permissions</li>
                    </ul>
                  </div>
                )}
                
                {selectedRole === 'user' && selectedUser?.role === 'admin' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-amber-800 text-sm font-medium">
                      ⚠️ This will revoke all admin privileges:
                    </p>
                    <ul className="text-amber-700 text-sm mt-2 space-y-1">
                      <li>• No access to admin dashboard</li>
                      <li>• Limited to normal user features</li>
                      <li>• Cannot manage other users</li>
                    </ul>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmRoleChange}
                className={selectedRole === 'admin' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'}
              >
                Confirm Change
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
