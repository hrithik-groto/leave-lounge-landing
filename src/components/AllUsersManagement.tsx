
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, Shield, User, Crown } from 'lucide-react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { format } from 'date-fns';

export const AllUsersManagement = () => {
  const { allUsers, isLoadingUsers, updateUserRole, isAdmin } = useUserRoles();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user');

  console.log('AllUsersManagement - isAdmin:', isAdmin);
  console.log('AllUsersManagement - allUsers:', allUsers);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingUsers) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleRoleChange = (userId: string, newRole: 'admin' | 'user') => {
    setSelectedUserId(userId);
    setSelectedRole(newRole);
  };

  const confirmRoleChange = () => {
    if (selectedUserId && selectedRole) {
      updateUserRole.mutate({ userId: selectedUserId, newRole: selectedRole });
      setSelectedUserId(null);
    }
  };

  const selectedUser = allUsers?.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Manage user roles and permissions. Admins have full access to the system and Slack app features.
            </p>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' ? (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        {user.name || 'Anonymous User'}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value: 'admin' | 'user') => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {allUsers?.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change {selectedUser?.name || 'this user'}'s role to{' '}
              <strong>{selectedRole}</strong>?
              {selectedRole === 'admin' && (
                <span className="block mt-2 text-yellow-600">
                  This will grant them full admin access to both the webapp and Slack app.
                </span>
              )}
              {selectedRole === 'user' && selectedUser?.role === 'admin' && (
                <span className="block mt-2 text-red-600">
                  This will revoke their admin privileges and restrict them to normal user features.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
