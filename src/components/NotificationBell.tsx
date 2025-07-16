
import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, XCircle, Calendar, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatToIST } from '@/lib/timezone';

const NotificationBell = () => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [newNotificationId, setNewNotificationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      console.log('Setting up notifications for user:', user.id);
      fetchNotifications();
      
      // Set up real-time subscription for notifications
      const subscription = supabase
        .channel('user_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New notification received:', payload);
            const newNotification = payload.new;
            
            // Add to notifications list with animation trigger
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            setNewNotificationId(newNotification.id);
            
            // Remove animation trigger after animation completes
            setTimeout(() => setNewNotificationId(null), 3000);
            
            // Show toast notification with custom styling based on type
            const getToastConfig = (type) => {
              switch (type) {
                case 'success':
                  return {
                    title: "🎉 Great News!",
                    description: newNotification.message,
                    className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                  };
                case 'error':
                  return {
                    title: "⚠️ Update",
                    description: newNotification.message,
                    variant: "destructive" as const,
                    className: "bg-gradient-to-r from-red-50 to-pink-50 border-red-200"
                  };
                default:
                  return {
                    title: "📢 Notification",
                    description: newNotification.message,
                    className: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                  };
              }
            };

            const toastConfig = getToastConfig(newNotification.type);
            toast(toastConfig);
          }
        )
        .subscribe((status) => {
          console.log('Notification subscription status:', status);
        });

      return () => {
        console.log('Cleaning up notification subscription');
        supabase.removeChannel(subscription);
      };
    }
  }, [user, toast]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('Fetching leave notifications for user:', user.id);
      
      // Fetch all notifications for the current user, focusing on leave-related ones
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        toast({
          title: "Error",
          description: "Failed to load notifications",
          variant: "destructive"
        });
      } else {
        console.log('All notifications fetched successfully:', data);
        // Filter for leave-related notifications on the client side
        const leaveNotifications = data?.filter(notification => {
          const message = notification.message.toLowerCase();
          return message.includes('leave') || 
                 message.includes('approved') || 
                 message.includes('rejected') || 
                 message.includes('pending') ||
                 message.includes('application');
        }) || [];
        
        console.log('Filtered leave notifications:', leaveNotifications);
        setNotifications(leaveNotifications);
        const unread = leaveNotifications.filter(n => !n.is_read).length;
        setUnreadCount(unread);
        console.log('Unread count:', unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      console.log('Marking notification as read:', notificationId);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id); // Additional security check

      if (error) {
        console.error('Error marking notification as read:', error);
      } else {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      console.log('Marking all notifications as read for user:', user?.id);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <Calendar className="h-5 w-5 text-yellow-500" />;
      case 'gift':
        return <Gift className="h-5 w-5 text-purple-500" />;
      default:
        return <Calendar className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationStyles = (notification) => {
    const isNew = newNotificationId === notification.id;
    const baseStyles = `p-4 rounded-xl border cursor-pointer transition-all duration-500 hover:shadow-lg transform ${
      notification.is_read 
        ? 'bg-gray-50 border-gray-200' 
        : 'bg-white border-blue-200 shadow-md'
    }`;

    if (isNew) {
      switch (notification.type) {
        case 'success':
          return `${baseStyles} animate-pulse bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-green-200 shadow-lg scale-105`;
        case 'error':
          return `${baseStyles} animate-pulse bg-gradient-to-r from-red-50 to-pink-50 border-red-300 shadow-red-200 shadow-lg scale-105`;
        default:
          return `${baseStyles} animate-pulse bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-blue-200 shadow-lg scale-105`;
      }
    }

    return baseStyles;
  };


  if (!user) {
    return null; // Don't render if user is not logged in
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-purple-50 transition-all duration-300">
          <Bell className={`h-5 w-5 transition-all duration-300 ${unreadCount > 0 ? 'animate-bounce text-purple-600' : ''}`} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center text-xs animate-pulse bg-gradient-to-r from-red-500 to-pink-500 shadow-lg"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-2xl bg-gradient-to-b from-white to-gray-50">
          <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                Notifications
              </CardTitle>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100 transition-colors duration-200"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto p-0">
            {isLoading ? (
              <div className="text-center py-8 px-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
                <p className="text-gray-500">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No leave notifications yet</p>
                <p className="text-xs text-gray-400 mt-2">You'll see updates when you apply for leave</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={getNotificationStyles(notification)}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${notification.is_read ? 'text-gray-600' : 'text-gray-900 font-semibold'} leading-relaxed`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-2 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatToIST(notification.created_at, 'MMM dd, HH:mm')}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex-shrink-0 mt-2 animate-pulse"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
