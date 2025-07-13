import React from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';

const TestNotificationButton: React.FC = () => {
  const { user } = useUser();
  const { toast } = useToast();

  const createTestNotification = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          message: `Test notification created at ${new Date().toLocaleTimeString()}`,
          type: 'info'
        });

      if (error) {
        console.error('Error creating test notification:', error);
        toast({
          title: "Error",
          description: "Failed to create test notification",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Test notification created successfully!"
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Button 
      onClick={createTestNotification}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <Bell className="w-4 h-4" />
      Test Notification
    </Button>
  );
};

export default TestNotificationButton;