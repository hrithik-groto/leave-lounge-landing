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
    console.log('Processing /leaves command for user:', userId);

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

    // Check if user is admin
    const isAdmin = slackIntegration.user_id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

    // Main leave management modal - comprehensive version
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
      private_metadata: slackIntegration.user_id,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hi *${userName}*! ${isAdmin ? '👑 Admin Dashboard -' : ''}`
          }
        }
      ]
    };

    // Add admin actions if user is admin
    if (isAdmin) {
      modal.blocks.push({
        type: 'actions',
        block_id: 'admin_actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 Review Leave Requests'
            },
            action_id: 'review_requests',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '👥 Team Leave Overview'
            },
            action_id: 'team_overview'
          }
        ]
      });
    }

    // Personal Actions section
    modal.blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Personal Actions*'
        }
      },
      {
        type: 'actions',
        block_id: 'personal_actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🏖️ Apply leave'
            },
            action_id: 'apply_leave',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 Check leave balance'
            },
            action_id: 'check_balance'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '👥 See teammates on leave'
            },
            action_id: 'teammates_on_leave'
          }
        ]
      }
    );

    // You can also section
    modal.blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*You can also*'
        }
      },
      {
        type: 'actions',
        block_id: 'additional_actions_1',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📅 View/Cancel upcoming leaves'
            },
            action_id: 'view_cancel'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🎉 See upcoming holidays'
            },
            action_id: 'see_holidays'
          }
        ]
      },
      {
        type: 'actions',
        block_id: 'additional_actions_2',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 See leave policy'
            },
            action_id: 'see_policy'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Clear pending requests'
            },
            action_id: 'clear_pending'
          }
        ]
      }
    );

    // Bottom section
    modal.blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🤔 *Wondering what more you can do with Timeloo?*'
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '⭐ View more'
          },
          action_id: 'view_more'
        }
      },
      {
        type: 'actions',
        block_id: 'bottom_actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '💬 Talk to us'
            },
            action_id: 'talk_to_us'
          }
        ]
      }
    );

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