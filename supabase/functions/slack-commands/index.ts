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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the form data from Slack
    const formData = await req.formData();
    const command = formData.get('command');
    const userId = formData.get('user_id');
    const teamId = formData.get('team_id');
    const text = formData.get('text');
    
    console.log('Received Slack command:', { command, userId, teamId, text });

    if (command !== '/leaves') {
      return new Response('Unknown command', { status: 400 });
    }

    // Find the user in our database based on Slack user ID
    const { data: slackIntegration, error: integrationError } = await supabaseClient
      .from('user_slack_integrations')
      .select('user_id')
      .eq('slack_user_id', userId)
      .eq('slack_team_id', teamId)
      .single();

    if (integrationError || !slackIntegration) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ You need to connect your Timeloo account first. Please visit the web app to link your Slack account.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get user's name for personalization
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('name')
      .eq('id', slackIntegration.user_id)
      .single();

    const userName = userProfile?.name || 'there';

    // Create and send the modal to Slack
    const botToken = Deno.env.get('SLACK_BOT_TOKEN');
    if (!botToken) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Slack bot token not configured. Please contact your administrator.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Main leave management modal
    const modal = {
      type: 'modal',
      callback_id: 'leave_home_modal',
      title: {
        type: 'plain_text',
        text: 'Timeloo'
      },
      close: {
        type: 'plain_text',
        text: 'Close'
      },
      private_metadata: slackIntegration.user_id, // Store user_id for later use
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hi *${userName}*! What would you like to do today?`
          }
        },
        {
          type: 'actions',
          block_id: 'leave_actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📝 Apply leave'
              },
              action_id: 'apply_leave',
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '👀 View/Cancel upcoming'
              },
              action_id: 'view_cancel'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '⚖️ Check balance'
              },
              action_id: 'check_balance'
            }
          ]
        },
        {
          type: 'actions',
          block_id: 'secondary_actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '👥 Teammates on leave'
              },
              action_id: 'teammates_on_leave'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📋 See policy'
              },
              action_id: 'see_policy'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🎉 Upcoming holidays'
              },
              action_id: 'see_holidays'
            }
          ]
        }
      ]
    };

    // Open the modal using Slack API
    const modalResponse = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trigger_id: formData.get('trigger_id'),
        view: modal,
      }),
    });

    if (!modalResponse.ok) {
      const modalError = await modalResponse.text();
      console.error('Error opening modal:', modalError);
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Failed to open leave application form. Please try again.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Return empty response since modal was opened
    return new Response('', { status: 200 });

  } catch (error) {
    console.error('Error in slack-commands function:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ An error occurred while processing your request. Please try again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});