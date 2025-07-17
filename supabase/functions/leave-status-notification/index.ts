import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🔔 Leave status notification function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      leave_request_id, 
      old_status, 
      new_status, 
      user_id, 
      approved_by 
    } = await req.json();

    console.log(`📋 Processing status change: ${old_status} → ${new_status} for request ${leave_request_id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the full leave request details
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_applied_users')
      .select(`
        *,
        profiles!leave_applied_users_user_id_fkey (name, email),
        leave_types (label, color)
      `)
      .eq('id', leave_request_id)
      .single();

    if (fetchError || !leaveRequest) {
      console.error('❌ Error fetching leave request:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leave request details' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log(`👤 Processing notification for user: ${leaveRequest.profiles?.name} (${user_id})`);

    // Send in-app notification
    try {
      const notificationMessage = new_status === 'approved' 
        ? `Your ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved! 🎉`
        : `Your ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been rejected.`;

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user_id,
          message: notificationMessage,
          type: `leave_${new_status}`
        });

      if (notificationError) {
        console.error('⚠️ Failed to create in-app notification:', notificationError);
      } else {
        console.log('✅ In-app notification created successfully');
      }
    } catch (error) {
      console.error('⚠️ Error creating in-app notification:', error);
    }

    // Send Slack personal notification
    await sendSlackPersonalNotification(supabase, leaveRequest, new_status);

    // Send Slack channel notifications for approved/rejected leaves
    if (new_status === 'approved' || new_status === 'rejected') {
      try {
        // Send to admin channel for all status changes
        const { error: adminSlackError } = await supabase.functions.invoke('slack-notify', {
          body: {
            leaveApplication: leaveRequest,
            isApprovalUpdate: true,
            sendToUser: false, // Don't send personal DM here, as we handle it above
            sendToAdminChannel: true, // Send to admin channel for all status updates
            sendToAllUsersChannel: false // We'll handle all users channel separately
          }
        });

        if (adminSlackError) {
          console.error('❌ Failed to send Slack admin channel notification:', adminSlackError);
        } else {
          console.log('✅ Slack admin channel notification sent successfully');
        }

        // Send to all users channel only for approved leaves during working hours
        if (new_status === 'approved') {
          const { error: allUsersSlackError } = await supabase.functions.invoke('slack-notify', {
            body: {
              leaveApplication: leaveRequest,
              isApprovalUpdate: true,
              sendToUser: false,
              sendToAdminChannel: false,
              sendToAllUsersChannel: true // Send to all users channel for approved leaves
            }
          });

          if (allUsersSlackError) {
            console.error('❌ Failed to send Slack all users channel notification:', allUsersSlackError);
          } else {
            console.log('✅ Slack all users channel notification sent successfully');
          }
        }
      } catch (error) {
        console.error('❌ Error calling slack-notify function:', error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notifications sent for leave ${new_status}` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error processing leave status notification:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

// Helper function to send personal Slack notifications to users
async function sendSlackPersonalNotification(supabaseClient: any, leaveRequest: any, action: string) {
  try {
    console.log(`📧 Sending Slack personal notification for ${action} leave to user: ${leaveRequest.user_id}`);
    
    // Check if user has Slack integration
    const { data: slackIntegration, error: slackError } = await supabaseClient
      .from('user_slack_integrations')
      .select('slack_user_id, slack_team_id')
      .eq('user_id', leaveRequest.user_id)
      .single();

    if (slackError || !slackIntegration) {
      console.log(`⚠️ No Slack integration found for user ${leaveRequest.user_id}: ${slackError?.message || 'No integration'}`);
      return;
    }

    console.log(`📱 Found Slack integration for user. Slack ID: ${slackIntegration.slack_user_id}`);

    const botToken = Deno.env.get('SLACK_BOT_TOKEN');
    if (!botToken) {
      console.error('❌ SLACK_BOT_TOKEN not found in environment variables');
      return;
    }

    // Format the leave dates nicely
    const startDate = new Date(leaveRequest.start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const endDate = new Date(leaveRequest.end_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const dateRange = leaveRequest.start_date === leaveRequest.end_date ? startDate : `${startDate} to ${endDate}`;
    
    // Calculate leave duration
    const start = new Date(leaveRequest.start_date);
    const end = new Date(leaveRequest.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const duration = diffDays === 1 ? '1 day' : `${diffDays} days`;

    let messageText, messageBlocks;

    if (action === 'approved') {
      messageText = `🎉 Great news! Your leave request has been approved!`;
      messageBlocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 Leave Request Approved!',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Your *${leaveRequest.leave_types?.label || 'leave'}* request has been approved by your manager! 🎊`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📅 Dates:*\n${dateRange}`
            },
            {
              type: 'mrkdwn',
              text: `*⏰ Duration:*\n${duration}`
            },
            {
              type: 'mrkdwn',
              text: `*📝 Type:*\n${leaveRequest.leave_types?.label || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*💬 Reason:*\n${leaveRequest.reason || 'No reason provided'}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🏖️ *Enjoy your time off!* Remember to set up an out-of-office message and hand over any urgent tasks to your colleagues.'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '📱 You can view all your leave applications in the Timeloo dashboard.'
            }
          ]
        }
      ];
    } else if (action === 'rejected') {
      messageText = `❌ Your leave request has been rejected.`;
      messageBlocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '❌ Leave Request Update',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Your *${leaveRequest.leave_types?.label || 'leave'}* request has been rejected.`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📅 Requested Dates:*\n${dateRange}`
            },
            {
              type: 'mrkdwn',
              text: `*⏰ Duration:*\n${duration}`
            },
            {
              type: 'mrkdwn',
              text: `*📝 Type:*\n${leaveRequest.leave_types?.label || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*💬 Reason:*\n${leaveRequest.reason || 'No reason provided'}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '💬 *Need clarification?* Please reach out to your manager to understand the reason for rejection and discuss alternative dates if needed.'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '📱 You can submit a new leave request anytime through the Timeloo dashboard or by using `/leaves` command.'
            }
          ]
        }
      ];
    } else {
      // For other status changes (like cancelled, etc.)
      messageText = `📝 Your leave request status has been updated to: ${action}`;
      messageBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Your *${leaveRequest.leave_types?.label || 'leave'}* request status has been updated to: *${action}*`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📅 Dates:*\n${dateRange}`
            },
            {
              type: 'mrkdwn',
              text: `*⏰ Duration:*\n${duration}`
            }
          ]
        }
      ];
    }

    // Send the Slack message
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: slackIntegration.slack_user_id,
        text: messageText,
        blocks: messageBlocks
      }),
    });

    const slackData = await slackResponse.json();
    
    if (!slackData.ok) {
      console.error(`❌ Slack API error:`, slackData.error);
      console.error('Response details:', slackData);
    } else {
      console.log(`✅ Successfully sent Slack personal notification for ${action} leave`);
      console.log(`Message sent to user ${slackIntegration.slack_user_id} in channel ${slackData.channel}`);
    }

  } catch (error) {
    console.error(`❌ Error sending Slack personal notification for ${action} leave:`, error);
  }
}