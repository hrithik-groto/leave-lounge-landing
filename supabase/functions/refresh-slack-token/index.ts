
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

    const { source } = await req.json().catch(() => ({ source: 'manual' }));
    console.log(`Token refresh source: ${source}`);

    // Get current refresh token
    let refreshToken = Deno.env.get('SLACK_REFRESH_TOKEN');
    
    // Use the new refresh token you provided
    const newRefreshToken = 'xoxe-1-My0xLTIyMTk5NjM5MTMyNzEtOTA4MTEzMjYzMDU3Ny05MTc2MjY1MjQ5Mjk5LTM4MzhkOWViZjg0MzE5ZDkzYTQxYjAwYTFiM2RkMjRmYTQ3NzgyMWM3Yjc1NjU3MDhkNmJkMGI2OTQyNGU0OTA';
    const newAccessToken = 'xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzEtOTA4MTEzMjM2MzY5Ny05MDgxMTMyNjMwNTc3LTkyMzk4NjczODMyODQtZmFkYTc2NThlMDhkNzExOTg4ZTNhNWQ4NzcwMmMwNGM1MDdkYjUyM2FiMmU2MTcyODRiNmNlMzcxOGMwNTE3Nw';

    console.log('🔄 Using provided updated tokens for refresh');

    // Try to refresh the token using Slack's OAuth API
    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Slack client credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Slack client credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Try to refresh using the Slack API
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

    if (refreshData.ok) {
      console.log('✅ Successfully refreshed Slack tokens via API');
      
      // Store the token update record
      const { error: insertError } = await supabaseClient
        .from('slack_token_updates')
        .insert({
          new_token: refreshData.access_token.substring(0, 50) + '...',
          refresh_date: new Date().toISOString(),
          status: 'auto_updated'
        });

      if (insertError) {
        console.error('Error storing token update:', insertError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tokens refreshed successfully',
          access_token: refreshData.access_token.substring(0, 20) + '...',
          refresh_token: refreshData.refresh_token ? refreshData.refresh_token.substring(0, 20) + '...' : 'unchanged'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } else {
      console.log('🔄 API refresh failed, using manually provided tokens');
      
      // Store the manual token update
      const { error: insertError } = await supabaseClient
        .from('slack_token_updates')
        .insert({
          new_token: newAccessToken.substring(0, 50) + '...',
          refresh_date: new Date().toISOString(),
          status: 'pending_update'
        });

      if (insertError) {
        console.error('Error storing token update:', insertError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Manual token update recorded. Please update SLACK_BOT_TOKEN in Supabase secrets.',
          new_access_token: newAccessToken.substring(0, 30) + '...',
          new_refresh_token: newRefreshToken.substring(0, 30) + '...',
          action_required: 'Update SLACK_BOT_TOKEN and SLACK_REFRESH_TOKEN in Supabase Functions settings'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

  } catch (error) {
    console.error('❌ Error refreshing Slack token:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to refresh Slack token' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
