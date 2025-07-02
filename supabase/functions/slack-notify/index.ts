
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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const requestBody = await req.json();
    const { leaveApplication, isTest, checkConfig } = requestBody;

    // Handle configuration check
    if (checkConfig) {
      const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
      if (!slackWebhookUrl) {
        return new Response(
          JSON.stringify({ error: 'SLACK_WEBHOOK_URL not configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Slack webhook configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    console.log('Processing Slack notification for leave application:', leaveApplication);

    // Get user profile information
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('name, email')
      .eq('id', leaveApplication.user_id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Continue with minimal user info if profile not found
    }

    // Get leave type information
    const { data: leaveType, error: leaveTypeError } = await supabaseClient
      .from('leave_types')
      .select('label, color')
      .eq('id', leaveApplication.leave_type_id)
      .single();

    if (leaveTypeError) {
      console.error('Error fetching leave type:', leaveTypeError);
    }

    // Calculate duration
    const startDate = new Date(leaveApplication.start_date);
    const endDate = new Date(leaveApplication.end_date);
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Format dates
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };

    // Create rich Slack message
    const slackMessage = {
      text: `🏖️ New Leave Application Submitted`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🏖️ New Leave Application"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Employee:*\n${profile?.name || 'Unknown User'}`
            },
            {
              type: "mrkdwn",
              text: `*Email:*\n${profile?.email || 'Unknown Email'}`
            },
            {
              type: "mrkdwn",
              text: `*Leave Type:*\n${leaveType?.label || 'Standard Leave'}`
            },
            {
              type: "mrkdwn",
              text: `*Duration:*\n${duration} day${duration > 1 ? 's' : ''}`
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*From:*\n${formatDate(startDate)}`
            },
            {
              type: "mrkdwn",
              text: `*To:*\n${formatDate(endDate)}`
            }
          ]
        }
      ]
    };

    // Add reason if provided
    if (leaveApplication.reason && leaveApplication.reason.trim()) {
      slackMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Reason:*\n${leaveApplication.reason}`
        }
      });
    }

    // Add status and timestamp
    slackMessage.blocks.push(
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Status:* 🟡 Pending Approval | *Applied:* ${new Date(leaveApplication.applied_at).toLocaleString()}`
          }
        ]
      },
      {
        type: "divider"
      }
    );

    // Get Slack webhook URL from environment
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    if (!slackWebhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL not configured');
    }

    console.log('Sending message to Slack...');

    // Send to Slack
    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error('Slack API error:', errorText);
      throw new Error(`Slack API error: ${slackResponse.status} - ${errorText}`);
    }

    console.log('Successfully sent Slack notification');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Slack notification sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in slack-notify function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send Slack notification' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
