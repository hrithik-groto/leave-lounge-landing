import React from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/clerk-react';
import { Slack } from 'lucide-react';

const SlackOAuthButton = () => {
  const { user } = useUser();

  const handleSlackOAuth = () => {
    if (!user) return;

    const clientId = 'YOUR_SLACK_CLIENT_ID'; // This should be set in Supabase secrets
    const redirectUri = `${window.location.origin}/api/slack/oauth`;
    const state = user.id; // Pass user ID as state
    
    const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=chat:write,users:read&redirect_uri=${redirectUri}&state=${state}`;
    
    window.location.href = oauthUrl;
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