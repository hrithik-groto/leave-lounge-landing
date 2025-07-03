import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    // Use service role key to bypass RLS for system operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This should contain the user_id
    const getClientId = url.searchParams.get('get_client_id');
    
    // Handle client ID request
    if (getClientId === 'true') {
      const clientId = Deno.env.get('SLACK_CLIENT_ID');
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'Client ID not configured' }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ clientId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!code) {
      return new Response('Missing authorization code', { status: 400 });
    }

    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      return new Response('Slack app credentials not configured', { status: 500 });
    }

    const redirectUri = `https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-oauth`;
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    console.log('Slack OAuth response:', { ok: tokenData.ok, team: tokenData.team?.id, user: tokenData.authed_user?.id });
    
    if (!tokenData.ok) {
      console.error('Slack OAuth error:', tokenData);
      return new Response(`Failed to exchange code for token: ${tokenData.error}`, { status: 400 });
    }

    // Validate required data
    if (!tokenData.authed_user?.id || !tokenData.team?.id || !tokenData.access_token) {
      console.error('Missing required data from Slack:', { 
        hasUser: !!tokenData.authed_user?.id, 
        hasTeam: !!tokenData.team?.id, 
        hasToken: !!tokenData.access_token 
      });
      return new Response('Invalid response from Slack', { status: 400 });
    }

    console.log('Attempting to save integration for user:', state);

    // Store the integration in the database using upsert with proper conflict resolution
    const { error } = await supabaseClient
      .from('user_slack_integrations')
      .upsert({
        user_id: state, // The user_id passed in state
        slack_user_id: tokenData.authed_user.id,
        slack_team_id: tokenData.team.id,
        access_token: tokenData.access_token,
      }, {
        onConflict: 'user_id,slack_team_id'
      });

    if (error) {
      console.error('Database error:', error);
      return new Response(`Failed to save integration: ${error.message}`, { status: 500 });
    }

    console.log('Successfully saved Slack integration for user:', state);

    // Redirect to success page
    const redirectUrl = `https://ba137aef-b49a-47cd-aa27-50903c1d7b84.lovableproject.com/dashboard?slack_connected=true`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    });

  } catch (error) {
    console.error('Error in slack-oauth function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});