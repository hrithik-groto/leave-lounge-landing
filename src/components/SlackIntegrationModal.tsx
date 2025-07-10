import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Slack, CheckCircle, Bell, X } from 'lucide-react';
import SlackOAuthButton from './SlackOAuthButton';

const SlackIntegrationModal = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkSlackConnection();
  }, []);

  const checkSlackConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('slack-notify', {
        body: { isTest: true, checkConfig: true }
      });
      
      if (!error && data && !data.error) {
        setIsConnected(true);
      }
    } catch (error) {
      console.log('Slack not configured:', error);
      setIsConnected(false);
    }
  };

  const handleTestNotification = async () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Please connect Slack first",
        variant: "destructive"
      });
      return;
    }

    setTestLoading(true);

    try {
      const testLeaveApplication = {
        user_id: 'test-user',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reason: 'This is a test notification from your leave management system',
        leave_type_id: null,
        applied_at: new Date().toISOString(),
        status: 'pending'
      };

      const { error } = await supabase.functions.invoke('slack-notify', {
        body: {
          leaveApplication: testLeaveApplication,
          isTest: true
        }
      });

      if (error) {
        console.error('Error sending test notification:', error);
        throw error;
      }

      toast({
        title: "🚀 Test Sent!",
        description: "Check your Slack channel!",
        className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
      });

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Test Failed",
        description: "Failed to send test notification.",
        variant: "destructive"
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-purple-50">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center space-x-3 text-purple-700">
          <Slack className="w-8 h-8" />
          <span className="text-2xl font-bold">Slack Integration</span>
          {isConnected && (
            <Badge className="bg-green-100 text-green-700 border-green-200 animate-pulse">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected ? (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-green-900 text-lg mb-2">All Set!</h3>
              <p className="text-green-700">
                Your leave notifications will be sent to Slack automatically.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <Bell className="w-4 h-4 mr-2 text-purple-600" />
                Personal Notifications
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Connect your personal Slack account for direct messages.
              </p>
              <SlackOAuthButton />
            </div>

            <div className="flex space-x-3 pt-4">
              <Button 
                onClick={handleTestNotification}
                disabled={testLoading}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
              >
                {testLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Bell className="w-4 h-4 mr-2" />
                )}
                Test Notification
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 py-8">
            <div className="bg-blue-50 rounded-xl p-6">
              <Slack className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-blue-900 text-lg mb-2">Connect Slack</h3>
              <p className="text-blue-700 text-sm">
                Get instant notifications for all leave activities
              </p>
            </div>
            <p className="text-gray-600 text-sm">
              Please contact your admin to set up Slack integration.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SlackIntegrationModal;