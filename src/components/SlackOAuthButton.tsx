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
    window.addEventListener('popstate', handleUrlChange);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
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
      <Button 
        onClick={handleDisconnect}
        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 hover:scale-105 transition-all duration-300 shadow-lg text-white"
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        Slack Connected
        <X className="w-3 h-3 ml-2 opacity-70" />
      </Button>
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