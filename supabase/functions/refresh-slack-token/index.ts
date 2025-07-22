
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

    // Get credentials from environment
    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');
    const refreshToken = Deno.env.get('SLACK_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing required Slack credentials');
    }

    console.log('Attempting to refresh Slack token with refresh token...');

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

    // The new access token from the refresh
    const newAccessToken = refreshData.access_token;
    console.log('New access token received:', newAccessToken.substring(0, 20) + '...');

    // Store the new token in the database
    const { error: insertError } = await supabase
      .from('slack_token_updates')
      .insert({
        old_token: 'Previous token (hidden for security)',
        new_token: newAccessToken,
        refresh_date: new Date().toISOString(),
        status: 'completed'
      });

    if (insertError) {
      console.error('Failed to store token update:', insertError);
    } else {
      console.log('Token update stored in database');
    }

    // Try to update the SLACK_BOT_TOKEN environment variable
    const supabaseProjectRef = Deno.env.get('SUPABASE_PROJECT_REF') || 'ppuyedxxfcijdfeqpwfj';
    const supabaseAccessToken = Deno.env.get('SUPABASE_ACCESS_TOKEN');

    if (supabaseAccessToken) {
      try {
        const managementResponse = await fetch(`https://api.supabase.com/v1/projects/${supabaseProjectRef}/secrets`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              name: 'SLACK_BOT_TOKEN',
              value: newAccessToken,
            },
          ]),
        });

        if (managementResponse.ok) {
          console.log('Successfully updated SLACK_BOT_TOKEN secret automatically');
          
          // Update status to completed
          await supabase
            .from('slack_token_updates')
            .update({ status: 'auto_updated' })
            .eq('new_token', newAccessToken);
        } else {
          console.log('Could not update secret automatically. Manual update required.');
        }
      } catch (managementError) {
        console.log('Management API not available. Token stored for manual update.');
      }
    } else {
      console.log('No Supabase access token available. Token stored for manual update.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Slack token refreshed successfully',
        timestamp: new Date().toISOString(),
        token_preview: newAccessToken.substring(0, 20) + '...',
        auto_updated: !!supabaseAccessToken
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
