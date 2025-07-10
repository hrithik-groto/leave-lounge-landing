import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LeaveNotificationHookProps {
  userId?: string;
  onLeaveUpdated?: () => void;
}

export const useLeaveNotifications = ({ userId, onLeaveUpdated }: LeaveNotificationHookProps) => {
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    // Listen for changes to leave applications for the current user
    const channel = supabase
      .channel(`user_leave_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leave_applied_users',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('Leave status update:', payload);
          
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;

          // Check if status changed from pending to approved/rejected
          if (oldRecord.status === 'pending' && newRecord.status !== 'pending') {
            // Get leave type information
            const { data: leaveType } = await supabase
              .from('leave_types')
              .select('label')
              .eq('id', newRecord.leave_type_id)
              .single();

            const leaveTypeName = leaveType?.label || 'Leave';
            const isApproved = newRecord.status === 'approved';
            
            // Show toast notification
            toast({
              title: isApproved ? "✅ Leave Approved!" : "❌ Leave Rejected",
              description: `Your ${leaveTypeName} application from ${new Date(newRecord.start_date).toLocaleDateString()} to ${new Date(newRecord.end_date).toLocaleDateString()} has been ${newRecord.status}.`,
              variant: isApproved ? "default" : "destructive",
              duration: 10000, // Show for 10 seconds
            });

            // Send Slack notification to user
            try {
              await supabase.functions.invoke('slack-notify', {
                body: {
                  leaveApplication: newRecord,
                  isApprovalUpdate: true,
                  sendToUser: true,
                },
              });
            } catch (error) {
              console.error('Failed to send Slack notification:', error);
            }

            // Trigger callback to refresh data
            if (onLeaveUpdated) {
              onLeaveUpdated();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast, onLeaveUpdated]);

  return null;
};