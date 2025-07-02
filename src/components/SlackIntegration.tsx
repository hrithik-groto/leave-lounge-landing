
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Slack, CheckCircle, XCircle, Settings, Bell, Users } from 'lucide-react';

const SlackIntegration = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkSlackConnection();
  }, []);

  const checkSlackConnection = async () => {
    // Check if webhook URL is stored in Supabase secrets by testing edge function
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

  const handleSaveWebhook = () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid Slack webhook URL",
        variant: "destructive"
      });
      return;
    }

    if (!webhookUrl.includes('hooks.slack.com') && !webhookUrl.includes('webhook')) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Slack webhook URL",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "⚠️ Manual Setup Required",
      description: "Please add this webhook URL as SLACK_WEBHOOK_URL in your Supabase secrets, then refresh this page.",
      variant: "destructive"
    });
  };

  const handleTestNotification = async () => {
    if (!isConnected || !webhookUrl) {
      toast({
        title: "Error",
        description: "Please connect Slack first",
        variant: "destructive"
      });
      return;
    }

    setTestLoading(true);

    try {
      // Create a test leave application object
      const testLeaveApplication = {
        user_id: 'test-user',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reason: 'This is a test notification from your leave management system',
        leave_type_id: null,
        applied_at: new Date().toISOString(),
        status: 'pending'
      };

      // Call the Slack notification function
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
        title: "🚀 Test Notification Sent!",
        description: "Check your Slack channel for the test message!",
        className: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
      });

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Test Failed",
        description: "Failed to send test notification. Please check your webhook URL.",
        variant: "destructive"
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('slack_webhook_url');
    setWebhookUrl('');
    setIsConnected(false);
    
    toast({
      title: "Slack Disconnected",
      description: "Your Slack integration has been removed.",
    });
  };

  return (
    <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center text-purple-700">
          <Slack className="w-6 h-6 mr-3" />
          Slack Integration
          {isConnected && (
            <Badge className="ml-3 bg-green-100 text-green-700 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">Setup Instructions</h4>
                  <ol className="text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                    <li>Go to your Slack workspace</li>
                    <li>Create or select a channel (e.g., #timeloo-leaves)</li>
                    <li>Add a "Webhook" app to your channel</li>
                    <li>Copy the webhook URL</li>
                    <li><strong>Add it as SLACK_WEBHOOK_URL secret in Supabase</strong></li>
                    <li>Refresh this page to verify connection</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">Slack Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <Button 
              onClick={handleSaveWebhook}
              disabled={isLoading || !webhookUrl.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Slack className="w-4 h-4 mr-2" />
                  Connect to Slack
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-semibold text-green-900">Connected Successfully!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    All leave applications will be automatically posted to your Slack channel.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center text-gray-900">
                <Settings className="w-4 h-4 mr-2" />
                Notification Features
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>Employee details</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Bell className="w-4 h-4 text-yellow-500" />
                  <span>Leave dates & duration</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Leave type & reason</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>Real-time status updates</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex space-x-3">
              <Button 
                onClick={handleTestNotification}
                disabled={testLoading}
                variant="outline"
                className="flex-1 border-blue-200 hover:bg-blue-50"
              >
                {testLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Test Notification
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleDisconnect}
                variant="outline"
                className="border-red-200 hover:bg-red-50 text-red-600"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SlackIntegration;
