
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@clerk/clerk-react';
import { Slack, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SlackOAuthButton = () => {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      checkSlackConnection();
    }
    
    // Listen for URL changes to detect OAuth callback
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('slack_connected') === 'true') {
        setIsConnected(true);
        toast({
          title: "🎉 Slack Connected!",
          description: "Your Slack account has been successfully connected!",
          className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
        });
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    handleUrlChange();
    
    // Also listen for browser navigation events
    const handlePopState = () => {
      handleUrlChange();
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user, toast]);

  const checkSlackConnection = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_slack_integrations')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      setIsConnected(!!data && !error);
    } catch (error) {
      console.error('Error checking Slack connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSlackOAuth = async () => {
    if (!user) return;

    try {
      // Get the client ID from Supabase secrets via edge function
      const response = await fetch(`https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-oauth?get_client_id=true`);
      const { clientId } = await response.json();
      
      const redirectUri = `https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-oauth`;
      const state = user.id;
      
      const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=chat:write,users:read&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      
      window.location.href = oauthUrl;
    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      toast({
        title: "Error",
        description: "Failed to start Slack connection. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_slack_integrations')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setIsConnected(false);
      toast({
        title: "Disconnected",
        description: "Your Slack account has been disconnected.",
      });
    } catch (error) {
      console.error('Error disconnecting Slack:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Slack account.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <Button disabled className="bg-gray-200">
        <Slack className="w-4 h-4 mr-2" />
        Checking Connection...
      </Button>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center space-x-3">
        <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center space-x-1 animate-pulse px-3 py-1.5">
          <CheckCircle className="w-4 h-4" />
          <span className="font-medium">Connected</span>
        </Badge>
        <Button 
          onClick={handleDisconnect}
          variant="outline"
          size="sm"
          className="border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 transition-all duration-300"
        >
          <X className="w-4 h-4 mr-2" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleSlackOAuth}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:scale-105 transition-all duration-300 shadow-lg"
    >
      <Slack className="w-4 h-4 mr-2" />
      Connect Your Slack Account
    </Button>
  );
};

export default SlackOAuthButton;
