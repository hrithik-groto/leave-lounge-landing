
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
    const { leaveApplication, isTest, checkConfig, isApprovalUpdate, sendToUser, sendToAdminChannel, sendToAllUsersChannel } = requestBody;

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
    const isApproved = leaveApplication.status === 'approved';
    const isRejected = leaveApplication.status === 'rejected';
    
    let headerText = "🏖️ New Leave Application";
    let messageText = `🏖️ New Leave Application Submitted`;
    
    if (isApprovalUpdate) {
      if (isApproved) {
        headerText = "✅ Leave Application Approved";
        messageText = `✅ Leave Application Approved`;
      } else if (isRejected) {
        headerText = "❌ Leave Application Rejected";
        messageText = `❌ Leave Application Rejected`;
      }
    }
    
    const slackMessage = {
      text: messageText,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: headerText
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
    let statusText = `*Status:* 🟡 Pending Approval`;
    if (isApproved) {
      statusText = `*Status:* ✅ Approved`;
    } else if (isRejected) {
      statusText = `*Status:* ❌ Rejected`;
    }
    
    const timestampText = isApprovalUpdate && leaveApplication.approved_at 
      ? `*Decision Made:* ${new Date(leaveApplication.approved_at).toLocaleString()}`
      : `*Applied:* ${new Date(leaveApplication.applied_at).toLocaleString()}`;
    
    slackMessage.blocks.push(
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${statusText} | ${timestampText}`
          }
        ]
      },
      {
        type: "divider"
      }
    );

    // Send to appropriate Slack channels
    let channelResults = [];

    // Always send to admin channel for ALL leave applications (pending, approved, rejected)
    const adminChannelId = 'C0920F0V7PW'; // Admin channel ID
    const botToken = Deno.env.get('SLACK_BOT_TOKEN');
    
    if (adminChannelId && botToken) {
      console.log('Sending message to admin Slack channel...');
      
      const adminResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: adminChannelId,
          ...slackMessage,
        }),
      });

      const adminData = await adminResponse.json();
      
      if (!adminData.ok) {
        console.error('Admin Slack API error:', adminData.error);
        channelResults.push({ channel: 'admin', success: false, error: adminData.error });
      } else {
        console.log('✅ Successfully sent Slack admin channel notification');
        channelResults.push({ channel: 'admin', success: true });
      }
    } else {
      console.error('❌ Missing admin channel ID or bot token');
      channelResults.push({ channel: 'admin', success: false, error: 'Missing admin channel ID or bot token' });
    }

    // Send to all users channel only if explicitly requested (not on immediate approval)
    if (sendToAllUsersChannel) {
      const allUsersChannelId = 'C095J2588Q5'; // All users channel ID
      const botToken = Deno.env.get('SLACK_BOT_TOKEN');
      
      if (allUsersChannelId && botToken) {
        console.log('Sending message to all users Slack channel...');
        
        const allUsersResponse = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: allUsersChannelId,
            ...slackMessage,
          }),
        });

        const allUsersData = await allUsersResponse.json();
        
        if (!allUsersData.ok) {
          console.error('All users channel Slack API error:', allUsersData.error);
          channelResults.push({ channel: 'all_users', success: false, error: allUsersData.error });
        } else {
          console.log('✅ Successfully sent Slack all users channel notification');
          channelResults.push({ channel: 'all_users', success: true });
        }
      } else {
        console.error('❌ Missing all users channel ID or bot token');
        channelResults.push({ channel: 'all_users', success: false, error: 'Missing all users channel ID or bot token' });
      }
    }

    console.log('Channel notification results:', channelResults);

    // Send individual DM if requested and user has Slack integration
    if (sendToUser) {
      try {
        const { data: slackIntegration } = await supabaseClient
          .from('user_slack_integrations')
          .select('slack_user_id, access_token')
          .eq('user_id', leaveApplication.user_id)
          .single();

        if (slackIntegration?.access_token) {
          const botToken = Deno.env.get('SLACK_BOT_TOKEN');
          if (botToken) {
            // Send DM to user
            const dmResponse = await fetch('https://slack.com/api/chat.postMessage', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${botToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                channel: slackIntegration.slack_user_id,
                ...slackMessage,
              }),
            });

            if (dmResponse.ok) {
              console.log('Successfully sent individual Slack DM');
            } else {
              const dmError = await dmResponse.text();
              console.error('Failed to send individual DM:', dmError);
            }
          }
        }
      } catch (dmError) {
        console.error('Error sending individual DM:', dmError);
        // Don't fail the main request if DM fails
      }
    }

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
