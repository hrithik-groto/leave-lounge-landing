import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, applicationId, adminUserId, decision } = body;

      console.log('Admin action received:', { action, applicationId, adminUserId, decision });

      // Verify admin privileges
      if (adminUserId !== 'user_2xwywE2Bl76vs7l68dhj6nIcCPV') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'approve_leave' || action === 'reject_leave') {
        // Get the leave application details
        const { data: leaveApp, error: fetchError } = await supabaseClient
          .from('leave_applied_users')
          .select(`
            *,
            profiles:user_id (name, email),
            leave_types:leave_type_id (label, color)
          `)
          .eq('id', applicationId)
          .single();

        if (fetchError || !leaveApp) {
          console.error('Leave application not found:', fetchError);
          return new Response(JSON.stringify({ error: 'Leave application not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const newStatus = action === 'approve_leave' ? 'approved' : 'rejected';
        
        // Update leave application status
        const { error: updateError } = await supabaseClient
          .from('leave_applied_users')
          .update({
            status: newStatus,
            approved_at: new Date().toISOString(),
            approved_by: adminUserId
          })
          .eq('id', applicationId);

        if (updateError) {
          console.error('Error updating leave status:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update leave status' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Send notification to user via Slack if they have integration
        const { data: userSlackIntegration } = await supabaseClient
          .from('user_slack_integrations')
          .select('slack_user_id, access_token')
          .eq('user_id', leaveApp.user_id)
          .single();

        if (userSlackIntegration?.slack_user_id) {
          const message = {
            channel: userSlackIntegration.slack_user_id,
            text: action === 'approve_leave' 
              ? `🎉 *Great news!* Your leave application has been approved!\n\n📅 **Dates:** ${leaveApp.start_date} to ${leaveApp.end_date}\n🏷️ **Type:** ${leaveApp.leave_types?.label}\n📝 **Reason:** ${leaveApp.reason || 'No reason provided'}`
              : `❌ Your leave application has been rejected.\n\n📅 **Dates:** ${leaveApp.start_date} to ${leaveApp.end_date}\n🏷️ **Type:** ${leaveApp.leave_types?.label}\n📝 **Reason:** ${leaveApp.reason || 'No reason provided'}\n\nPlease contact your manager for more details.`
          };

          try {
            const botToken = Deno.env.get('SLACK_BOT_TOKEN');
            if (botToken) {
              const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${botToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
              });

              const slackResult = await slackResponse.json();
              console.log('Slack notification sent:', slackResult);
            }
          } catch (slackError) {
            console.error('Error sending Slack notification:', slackError);
          }
        }

        // Also notify admin channel about the decision
        const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
        if (webhookUrl) {
          const adminMessage = {
            text: `${action === 'approve_leave' ? '✅' : '❌'} *Leave ${action === 'approve_leave' ? 'Approved' : 'Rejected'}*`,
            attachments: [
              {
                color: action === 'approve_leave' ? 'good' : 'danger',
                fields: [
                  {
                    title: 'Employee',
                    value: leaveApp.profiles?.name || leaveApp.profiles?.email || 'Unknown',
                    short: true
                  },
                  {
                    title: 'Leave Type',
                    value: leaveApp.leave_types?.label || 'Unknown',
                    short: true
                  },
                  {
                    title: 'Dates',
                    value: `${leaveApp.start_date} to ${leaveApp.end_date}`,
                    short: false
                  },
                  {
                    title: 'Reason',
                    value: leaveApp.reason || 'No reason provided',
                    short: false
                  }
                ]
              }
            ]
          };

          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(adminMessage)
            });
          } catch (webhookError) {
            console.error('Error sending webhook notification:', webhookError);
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Leave application ${newStatus} successfully`,
          status: newStatus
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in slack-admin-actions function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});