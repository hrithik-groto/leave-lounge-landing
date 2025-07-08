import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Add detailed logging
  console.log('=== SLACK COMMAND REQUEST START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Test endpoint - return simple response for GET requests
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        message: 'Slack Commands endpoint is working',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }

  // Only handle POST requests from here
  if (req.method !== 'POST') {
    console.log('Non-POST request received:', req.method);
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the form data from Slack
    let formData;
    try {
      formData = await req.formData();
      console.log('✅ Successfully parsed FormData');
    } catch (parseError) {
      console.error('❌ Failed to parse FormData:', parseError);
      return new Response('Invalid form data', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const command = formData.get('command');
    const userId = formData.get('user_id');
    const teamId = formData.get('team_id');
    const text = formData.get('text');
    const token = formData.get('token');
    
    console.log('📝 Received Slack command data:', { 
      command, 
      userId, 
      teamId, 
      text,
      token: token ? 'present' : 'missing'
    });
    console.log('📋 All FormData entries:', Array.from(formData.entries()));

    if (command !== '/leaves') {
      console.log('❌ Unknown command received:', command);
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Unknown command: ${command}. Expected: /leaves`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
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