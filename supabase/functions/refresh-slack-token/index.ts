
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Slack token refresh initiated');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { source } = await req.json().catch(() => ({ source: 'cron' }));
    console.log(`Token refresh source: ${source}`);

    // Updated tokens from your latest message
    const newAccessToken = 'xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzEtOTA4MTEzMjM2MzY5Ny05MDgxMTMyNjMwNTc3LTkyNDk3NzIxOTA1ODItZmZjZTQyZjAyYzU5ZDIwY2NiMmE3OTNjNzk5ZmM2NmRjNmNmMDVlYTFiMDUyNGEzYjljODE0NDg4ZTY5M2RiOQ';
    const newRefreshToken = 'xoxe-1-My0xLTIyMTk5NjM5MTMyNzEtOTA4MTEzMjYzMDU3Ny05MTc2MjY1MjQ5Mjk5LTM4MzhkOWViZjg0MzE5ZDkzYTQxYjAwYTFiM2RkMjRmYTQ3NzgyMWM3Yjc1NjU3MDhkNmJkMGI2OTQyNGU0OTA';

    // Get Slack client credentials
    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Slack client credentials');
      
      // Store manual token update record
      await supabaseClient
        .from('slack_token_updates')
        .insert({
          old_token: 'unknown',
          new_token: newAccessToken.substring(0, 50) + '...',
          refresh_date: new Date().toISOString(),
          status: 'missing_credentials'
        });

      return new Response(
        JSON.stringify({ error: 'Missing Slack client credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('🔄 Attempting to refresh using Slack OAuth API');

    // Try to refresh the token using Slack's OAuth API
    const refreshResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: newRefreshToken,
      }),
    });

    const refreshData = await refreshResponse.json();
    console.log('Slack refresh response:', { ok: refreshData.ok, error: refreshData.error });

    if (refreshData.ok && refreshData.access_token) {
      console.log('✅ Successfully refreshed Slack tokens via API');
      
      // Store the successful token update
      await supabaseClient
        .from('slack_token_updates')
        .insert({
          old_token: newAccessToken.substring(0, 50) + '...',
          new_token: refreshData.access_token.substring(0, 50) + '...',
          refresh_date: new Date().toISOString(),
          status: 'auto_updated'
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tokens refreshed successfully via Slack API',
          access_token: refreshData.access_token.substring(0, 20) + '...',
          refresh_token: refreshData.refresh_token ? refreshData.refresh_token.substring(0, 20) + '...' : 'unchanged',
          next_refresh: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString() // 10 hours from now
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } else {
      console.log('🔄 API refresh failed, recording manual token update');
      console.log('Refresh error:', refreshData.error);
      
      // Store the manual token update record
      await supabaseClient
        .from('slack_token_updates')
        .insert({
          old_token: 'expired_token',
          new_token: newAccessToken.substring(0, 50) + '...',
          refresh_date: new Date().toISOString(),
          status: 'manual_update_needed'
        });

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Automatic refresh failed. Manual token update required.',
          error: refreshData.error,
          manual_tokens: {
            access_token: newAccessToken.substring(0, 30) + '...',
            refresh_token: newRefreshToken.substring(0, 30) + '...'
          },
          action_required: 'Please update SLACK_BOT_TOKEN in Supabase Functions settings with: ' + newAccessToken
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
      );
    }

  } catch (error) {
    console.error('❌ Error in token refresh function:', error);
    
    // Try to log the error to database
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseClient
        .from('slack_token_updates')
        .insert({
          old_token: 'error_occurred',
          new_token: error.message.substring(0, 50) + '...',
          refresh_date: new Date().toISOString(),
          status: 'error'
        });
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to refresh Slack token',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
