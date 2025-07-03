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

    // Get leave types for the modal
    const { data: leaveTypes, error: leaveTypesError } = await supabaseClient
      .from('leave_types')
      .select('id, label, color')
      .eq('is_active', true);

    if (leaveTypesError) {
      console.error('Error fetching leave types:', leaveTypesError);
    }

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

    const modal = {
      type: 'modal',
      callback_id: 'leave_application_modal',
      title: {
        type: 'plain_text',
        text: '🏖️ Apply for Leave',
      },
      submit: {
        type: 'plain_text',
        text: 'Submit',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      private_metadata: slackIntegration.user_id, // Store user_id for later use
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✨ *Apply for your leave directly from Slack!*',
          },
        },
        {
          type: 'input',
          block_id: 'leave_type',
          element: {
            type: 'static_select',
            action_id: 'leave_type_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select leave type',
            },
            options: (leaveTypes || []).map(type => ({
              text: {
                type: 'plain_text',
                text: type.label,
              },
              value: type.id,
            })),
          },
          label: {
            type: 'plain_text',
            text: 'Leave Type',
          },
        },
        {
          type: 'input',
          block_id: 'start_date',
          element: {
            type: 'datepicker',
            action_id: 'start_date_picker',
            placeholder: {
              type: 'plain_text',
              text: 'Select start date',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Start Date',
          },
        },
        {
          type: 'input',
          block_id: 'end_date',
          element: {
            type: 'datepicker',
            action_id: 'end_date_picker',
            placeholder: {
              type: 'plain_text',
              text: 'Select end date',
            },
          },
          label: {
            type: 'plain_text',
            text: 'End Date',
          },
        },
        {
          type: 'input',
          block_id: 'reason',
          element: {
            type: 'plain_text_input',
            action_id: 'reason_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Enter reason for leave (optional)',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Reason',
          },
          optional: true,
        },
      ],
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