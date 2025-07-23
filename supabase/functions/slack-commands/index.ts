
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
    // First check if this is a URL verification challenge
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    if (contentType.includes('application/json')) {
      // Handle JSON payload (URL verification)
      const body = await req.text();
      console.log('Raw JSON body:', body);
      
      try {
        const jsonData = JSON.parse(body);
        if (jsonData.type === 'url_verification') {
          console.log('URL verification challenge:', jsonData.challenge);
          return new Response(jsonData.challenge, {
            headers: { 'Content-Type': 'text/plain' },
            status: 200
          });
        }
      } catch (e) {
        console.log('Not JSON verification challenge');
      }
    }

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

    // Get current leave balances
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    // Get all leave types
    const { data: leaveTypes, error: leaveTypesError } = await supabaseClient
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('label');

    if (leaveTypesError) {
      console.error('Error fetching leave types:', leaveTypesError);
    }

    // Calculate balances for each leave type
    let balanceText = '';
    
    if (leaveTypes && leaveTypes.length > 0) {
      const balancePromises = leaveTypes.map(async (leaveType) => {
        if (leaveType.label === 'Paid Leave') {
          const { data: balanceData, error: balanceError } = await supabaseClient
            .rpc('get_monthly_leave_balance', {
              p_user_id: slackIntegration.user_id,
              p_leave_type_id: leaveType.id,
              p_month: currentMonth,
              p_year: currentYear
            });

          if (!balanceError && balanceData) {
            const remaining = balanceData.remaining_this_month || 0;
            const used = balanceData.used_this_month || 0;
            return `🌴 *Paid Leave*: ${remaining} days remaining (${used} used)`;
          }
        } else if (leaveType.label === 'Work From Home') {
          const { data: wfhLeaves, error: wfhError } = await supabaseClient
            .from('leave_applied_users')
            .select('actual_days_used, is_half_day, start_date, end_date')
            .eq('user_id', slackIntegration.user_id)
            .eq('leave_type_id', leaveType.id)
            .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
            .lt('start_date', currentMonth === 12 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
            .in('status', ['approved', 'pending']);

          if (!wfhError) {
            const totalUsed = wfhLeaves?.reduce((total, leave) => {
              if (leave.actual_days_used) {
                return total + leave.actual_days_used;
              }
              if (leave.is_half_day) {
                return total + 0.5;
              }
              const leaveDays = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
              return total + leaveDays;
            }, 0) || 0;

            const remaining = Math.max(0, 2 - totalUsed);
            return `🏠 *Work From Home*: ${remaining} days remaining (${totalUsed} used)`;
          }
        } else if (leaveType.label === 'Short Leave') {
          const { data: shortLeaves, error: shortError } = await supabaseClient
            .from('leave_applied_users')
            .select('hours_requested')
            .eq('user_id', slackIntegration.user_id)
            .eq('leave_type_id', leaveType.id)
            .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
            .lt('start_date', currentMonth === 12 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
            .in('status', ['approved', 'pending']);

          if (!shortError) {
            const totalUsed = shortLeaves?.reduce((total, leave) => total + (leave.hours_requested || 1), 0) || 0;
            const remaining = Math.max(0, 4 - totalUsed);
            return `⏰ *Short Leave*: ${remaining} hours remaining (${totalUsed} used)`;
          }
        } else if (leaveType.label === 'Additional work from home') {
          // Check if regular WFH is exhausted
          const { data: wfhLeaveType } = await supabaseClient
            .from('leave_types')
            .select('id')
            .eq('label', 'Work From Home')
            .single();

          if (wfhLeaveType) {
            const { data: wfhLeaves, error: wfhError } = await supabaseClient
              .from('leave_applied_users')
              .select('actual_days_used, is_half_day, start_date, end_date')
              .eq('user_id', slackIntegration.user_id)
              .eq('leave_type_id', wfhLeaveType.id)
              .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
              .lt('start_date', currentMonth === 12 
                ? `${currentYear + 1}-01-01` 
                : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
              .in('status', ['approved', 'pending']);

            if (!wfhError) {
              const totalWfhUsed = wfhLeaves?.reduce((total, leave) => {
                if (leave.actual_days_used) {
                  return total + leave.actual_days_used;
                }
                if (leave.is_half_day) {
                  return total + 0.5;
                }
                const leaveDays = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                return total + leaveDays;
              }, 0) || 0;

              const wfhRemaining = Math.max(0, 2 - totalWfhUsed);
              
              if (wfhRemaining <= 0) {
                // Get additional WFH usage
                const { data: additionalWfhLeaves, error: additionalWfhError } = await supabaseClient
                  .from('leave_applied_users')
                  .select('actual_days_used, is_half_day, start_date, end_date')
                  .eq('user_id', slackIntegration.user_id)
                  .eq('leave_type_id', leaveType.id)
                  .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
                  .lt('start_date', currentMonth === 12 
                    ? `${currentYear + 1}-01-01` 
                    : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
                  .in('status', ['approved', 'pending']);

                if (!additionalWfhError) {
                  const totalAdditionalUsed = additionalWfhLeaves?.reduce((total, leave) => {
                    if (leave.actual_days_used) {
                      return total + leave.actual_days_used;
                    }
                    if (leave.is_half_day) {
                      return total + 0.5;
                    }
                    const leaveDays = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                    return total + leaveDays;
                  }, 0) || 0;

                  return `🏠 *Additional WFH*: Unlimited available (${totalAdditionalUsed} used)`;
                }
              } else {
                return `🏠 *Additional WFH*: Not available (use regular WFH first)`;
              }
            }
          }
        }
        
        return null;
      });

      const balanceResults = await Promise.all(balancePromises);
      const validBalances = balanceResults.filter(balance => balance !== null);
      
      if (validBalances.length > 0) {
        balanceText = '\n\n*📊 Current Leave Balances:*\n' + validBalances.join('\n');
      }
    }

    // Create different message blocks based on user role
    let messageBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi ${userName}! ${isAdmin ? '👑 *Admin Dashboard* -' : 'Would you like to:'}${balanceText}`
        }
      }
    ];

    console.log('🔧 DEBUG: Creating buttons for user:', userId, 'isAdmin:', isAdmin);

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
              value: slackIntegration.user_id,
              style: 'primary'
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

    console.log('🚀 Sending interactive message with blocks:', JSON.stringify(messageBlocks, null, 2));
    console.log('🔧 DEBUG: Full interactive message:', JSON.stringify(interactiveMessage, null, 2));

    return new Response(
      JSON.stringify(interactiveMessage),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
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
