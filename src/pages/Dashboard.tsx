
import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ComprehensiveLeaveBalance } from '@/components/ComprehensiveLeaveBalance';
import QuickActions from '@/components/QuickActions';
import EnhancedCalendar from '@/components/EnhancedCalendar';
import { TabbedLeaveApplications } from '@/components/TabbedLeaveApplications';
import NotificationBell from '@/components/NotificationBell';
import { toast } from "@/components/ui/use-toast"

const Dashboard = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const approveApplicationMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from('leave_applied_users')
        .update({ status: 'approved' })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      setRefreshTrigger(prev => prev + 1);
      toast({
        title: "Application approved",
        description: "The leave application has been approved.",
      });
    },
    onError: (error) => {
      console.error('Error approving application:', error);
      toast({
        title: "Error",
        description: "Failed to approve the application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from('leave_applied_users')
        .update({ status: 'rejected' })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      setRefreshTrigger(prev => prev + 1);
      toast({
        title: "Application rejected",
        description: "The leave application has been rejected.",
      });
    },
    onError: (error) => {
      console.error('Error rejecting application:', error);
      toast({
        title: "Error",
        description: "Failed to reject the application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const revertApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase
        .from('leave_applied_users')
        .delete()
        .eq('id', applicationId)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate and refetch leave applications
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      
      // Trigger balance refresh
      setRefreshTrigger(prev => prev + 1);
      
      toast({
        title: "Application cancelled",
        description: "Your leave application has been cancelled and your balance has been restored.",
      });
    },
    onError: (error) => {
      console.error('Error cancelling application:', error);
      toast({
        title: "Error",
        description: "Failed to cancel the application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRevertApplication = (applicationId: string) => {
    revertApplicationMutation.mutate(applicationId);
  };

  const handleApprove = async (id: string, userId: string) => {
    approveApplicationMutation.mutate({ id, userId });
  };

  const handleReject = async (id: string, userId: string) => {
    rejectApplicationMutation.mutate({ id, userId });
  };

  const handleLeaveSubmitted = () => {
    // Trigger balance refresh
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.firstName || 'User'}!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Leave Balance and Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            <ComprehensiveLeaveBalance refreshTrigger={refreshTrigger} />
            <QuickActions />
            <NotificationBell />
          </div>

          {/* Right Column - Applications and Calendar */}
          <div className="lg:col-span-2 space-y-6">
            <TabbedLeaveApplications 
              onRevert={handleRevertApplication}
              onApprove={handleApprove}
              onReject={handleReject}
              refreshTrigger={refreshTrigger}
            />
            <EnhancedCalendar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
