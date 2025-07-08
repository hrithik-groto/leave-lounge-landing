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

    // Get user profile for personalized greeting and check if admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('name')
      .eq('id', slackIntegration.user_id)
      .single();

    const userName = profile?.name || 'there';
    const isAdmin = slackIntegration.user_id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

    // Create different message blocks based on user role
    let messageBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi ${userName}! ${isAdmin ? '👑 *Admin Dashboard* -' : 'Would you like to-'}`
        }
      }
    ];

    if (isAdmin) {
      // Admin-specific options
      messageBlocks = messageBlocks.concat([
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📋 Review Leave Requests',
                emoji: true
              },
              action_id: 'admin_review_requests',
              value: slackIntegration.user_id,
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '👥 Team Leave Overview',
                emoji: true
              },
              action_id: 'admin_team_overview',
              value: slackIntegration.user_id
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Personal Actions*'
          }
        }
      ]);
    }

    // Common user options
    messageBlocks = messageBlocks.concat([
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🏖️ Apply leave',
              emoji: true
            },
            action_id: 'apply_leave',
            value: slackIntegration.user_id
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 Check leave balance',
              emoji: true
            },
            action_id: 'check_balance',
            value: slackIntegration.user_id
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '👥 See teammates on leave',
              emoji: true
            },
            action_id: 'teammates_leave',
            value: slackIntegration.user_id
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*You can also*'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 View/Cancel upcoming leaves',
              emoji: true
            },
            action_id: 'view_upcoming',
            value: slackIntegration.user_id
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🎉 See upcoming holidays',
              emoji: true
            },
            action_id: 'view_holidays',
            value: slackIntegration.user_id
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📖 See leave policy',
              emoji: true
            },
            action_id: 'leave_policy',
            value: slackIntegration.user_id
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Clear pending requests',
              emoji: true
            },
            action_id: 'clear_pending',
            value: slackIntegration.user_id
          }
        ]
      },
      {
        type: 'divider'
      },
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
            text: '⭐ View more',
            emoji: true
          },
          action_id: 'view_more',
          value: slackIntegration.user_id
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '💬 Talk to us',
              emoji: true
            },
            action_id: 'talk_to_us',
            value: slackIntegration.user_id
          }
        ]
      }
    ]);

    // Create interactive message with buttons
    const interactiveMessage = {
      response_type: 'ephemeral',
      blocks: messageBlocks
    };

    return new Response(
      JSON.stringify(interactiveMessage),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

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