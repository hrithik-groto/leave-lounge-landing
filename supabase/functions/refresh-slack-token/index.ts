import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackTokenResponse {
  ok: boolean;
  access_token?: string;
  refresh_token?: string;
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Slack token refresh process...');

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current tokens from secrets
    const currentBotToken = Deno.env.get('SLACK_BOT_TOKEN');
    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');

    if (!currentBotToken || !clientId || !clientSecret) {
      throw new Error('Missing required Slack credentials');
    }

    // Extract refresh token from the bot token (format: xoxe.xoxb-...)
    const tokenParts = currentBotToken.split('.');
    if (tokenParts.length !== 2 || !tokenParts[0].startsWith('xoxe')) {
      throw new Error('Invalid bot token format');
    }
    
    const refreshToken = tokenParts[0]; // xoxe part is the refresh token

    console.log('Attempting to refresh Slack token...');

    // Make refresh token request to Slack
    const refreshResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const refreshData: SlackTokenResponse = await refreshResponse.json();

    if (!refreshData.ok || !refreshData.access_token) {
      console.error('Slack token refresh failed:', refreshData.error);
      throw new Error(`Slack token refresh failed: ${refreshData.error}`);
    }

    console.log('Successfully refreshed Slack token');

    // Format the new bot token (combine refresh token with new access token)
    const newBotToken = `${refreshToken}.${refreshData.access_token}`;

    // Update the SLACK_BOT_TOKEN secret in Supabase
    // Note: This would require a management API call or manual update
    // For now, we'll log the new token and return it
    console.log('New bot token generated successfully');
    
    // Here you would typically update the secret via Supabase Management API
    // Since we can't directly update secrets from edge functions,
    // we'll store it in a database table for manual update or use a webhook

    // Store the new token in a secure table for retrieval
    const { error: insertError } = await supabase
      .from('slack_token_updates')
      .insert({
        old_token: currentBotToken.substring(0, 20) + '...',
        new_token: newBotToken,
        refresh_date: new Date().toISOString(),
        status: 'pending_update'
      });

    if (insertError) {
      console.error('Failed to store token update:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Slack token refreshed successfully',
        timestamp: new Date().toISOString(),
        token_preview: newBotToken.substring(0, 20) + '...'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in refresh-slack-token function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);