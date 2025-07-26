
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Define the two admin user IDs
const ADMIN_USER_IDS = [
  'user_2xwywE2Bl76vs7l68dhj6nIcCPV',
  'user_30JDwBWQQyzlqBrhUFRCsvOjuI4'
];

export const useUserRoles = () => {
  const queryClient = useQueryClient();

  // Get current user and determine if they're admin
  const { data: currentUser, isLoading: isLoadingCurrentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current authenticated user:', user);
      return user;
    },
  });

  // Check if current user is admin based on hard-coded admin IDs
  const { data: currentUserRole, isLoading: isLoadingCurrentRole } = useQuery({
    queryKey: ['current-user-role', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) {
        console.log('No authenticated user found');
        return 'user';
      }

      console.log('Checking admin status for user ID:', currentUser.id);
      console.log('Admin user IDs:', ADMIN_USER_IDS);
      
      // Check if user is in the admin list
      const isHardcodedAdmin = ADMIN_USER_IDS.includes(currentUser.id);
      console.log('Is hardcoded admin:', isHardcodedAdmin);

      if (isHardcodedAdmin) {
        // Ensure the user has admin role in the database
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id)
          .single();

        if (!existingRole || existingRole.role !== 'admin') {
          console.log('Setting admin role in database for:', currentUser.id);
          await supabase
            .from('user_roles')
            .upsert({
              user_id: currentUser.id,
              role: 'admin',
              assigned_by: currentUser.id,
              assigned_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });
        }
        
        return 'admin';
      }

      // For non-hardcoded admins, check database
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user role:', error);
        return 'user';
      }

      const role = data?.role || 'user';
      console.log('Database user role:', role);
      return role;
    },
    enabled: !!currentUser,
  });

  // Fetch all users with their roles (only for admins)
  const { data: allUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['all-users-with-roles'],
    queryFn: async () => {
      console.log('Fetching all users with roles...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          created_at,
          user_roles (
            role,
            assigned_by,
            assigned_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      const usersWithRoles = data?.map(user => ({
        ...user,
        role: user.user_roles?.[0]?.role || 'user',
        assigned_by: user.user_roles?.[0]?.assigned_by,
        assigned_at: user.user_roles?.[0]?.assigned_at,
        isHardcodedAdmin: ADMIN_USER_IDS.includes(user.id)
      })) || [];

      console.log('All users with roles:', usersWithRoles);
      return usersWithRoles;
    },
    enabled: currentUserRole === 'admin',
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      if (!currentUser) throw new Error('Not authenticated');

      // Prevent changing hardcoded admin roles
      if (ADMIN_USER_IDS.includes(userId) && newRole === 'user') {
        throw new Error('Cannot change role of hardcoded admin users');
      }

      console.log('Updating user role:', { userId, newRole });

      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole,
          assigned_by: currentUser.id,
          assigned_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return { userId, newRole };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-role'] });
      
      const userName = allUsers?.find(u => u.id === data.userId)?.name || 'User';
      toast.success(`${userName}'s role has been updated to ${data.newRole}`);
    },
    onError: (error: any) => {
      console.error('Error updating user role:', error);
      toast.error(error.message || 'Failed to update user role');
    }
  });

  const isAdmin = currentUserRole === 'admin';
  const isHardcodedAdmin = currentUser ? ADMIN_USER_IDS.includes(currentUser.id) : false;
  
  console.log('useUserRoles computed values:', {
    currentUserRole,
    isAdmin,
    isHardcodedAdmin,
    currentUserId: currentUser?.id
  });

  return {
    currentUser,
    currentUserRole,
    isLoadingCurrentRole: isLoadingCurrentRole || isLoadingCurrentUser,
    allUsers,
    isLoadingUsers,
    updateUserRole,
    isAdmin,
    isHardcodedAdmin
  };
};
