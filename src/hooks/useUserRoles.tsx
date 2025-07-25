
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useUserRoles = () => {
  const queryClient = useQueryClient();

  const { data: currentUserRole, isLoading: isLoadingCurrentRole } = useQuery({
    queryKey: ['current-user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user role:', error);
        return 'user';
      }

      return data?.role || 'user';
    },
  });

  const { data: allUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['all-users-with-roles'],
    queryFn: async () => {
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

      return data?.map(user => ({
        ...user,
        role: user.user_roles?.[0]?.role || 'user',
        assigned_by: user.user_roles?.[0]?.assigned_by,
        assigned_at: user.user_roles?.[0]?.assigned_at
      })) || [];
    },
    enabled: currentUserRole === 'admin',
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole,
          assigned_by: user.id,
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
    onError: (error) => {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  });

  const isAdmin = currentUserRole === 'admin';

  return {
    currentUserRole,
    isLoadingCurrentRole,
    allUsers,
    isLoadingUsers,
    updateUserRole,
    isAdmin
  };
};
