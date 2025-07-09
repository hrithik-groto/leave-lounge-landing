import React from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/clerk-react';
import { Slack } from 'lucide-react';

const SlackOAuthButton = () => {
  const { user } = useUser();

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

  return (
    <Button 
      onClick={handleSlackOAuth}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
    >
      <Slack className="w-4 h-4 mr-2" />
      Connect Your Slack Account
    </Button>
  );
};

export default SlackOAuthButton;