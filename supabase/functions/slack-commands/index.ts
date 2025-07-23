
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SLACK COMMAND REQUEST START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

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

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await req.text();
      try {
        const jsonData = JSON.parse(body);
        if (jsonData.type === 'url_verification') {
          return new Response(jsonData.challenge, {
            headers: { 'Content-Type': 'text/plain' },
            status: 200
          });
        }
      } catch (e) {
        console.log('Not JSON verification challenge');
      }
    }

    // Parse the form data from Slack
    const formData = await req.formData();
    const command = formData.get('command');
    const userId = formData.get('user_id');
    const teamId = formData.get('team_id');
    const text = formData.get('text');
    
    console.log('📝 Received Slack command:', { command, userId, teamId, text });

    if (command !== '/leaves') {
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Quick user lookup first - if not found, return immediately
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

    // Send immediate response to avoid timeout
    const quickResponse = {
      response_type: 'ephemeral',
      text: '⏳ Loading your leave dashboard...',
    };

    // Start background processing for the full response
    const backgroundProcessing = async () => {
      try {
        // Get user profile
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('name')
          .eq('id', slackIntegration.user_id)
          .single();

        const userName = profile?.name || 'there';
        const isAdmin = slackIntegration.user_id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

        // Get current date info
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
        const monthEnd = currentMonth === 12 
          ? `${currentYear + 1}-01-01` 
          : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;

        // Parallel queries for better performance
        const [leaveTypesResult, leavesResult] = await Promise.all([
          supabaseClient
            .from('leave_types')
            .select('*')
            .eq('is_active', true)
            .order('label'),
          supabaseClient
            .from('leave_applied_users')
            .select('leave_type_id, actual_days_used, is_half_day, start_date, end_date, hours_requested, status')
            .eq('user_id', slackIntegration.user_id)
            .gte('start_date', monthStart)
            .lt('start_date', monthEnd)
            .in('status', ['approved', 'pending'])
        ]);

        const leaveTypes = leaveTypesResult.data || [];
        const allLeaves = leavesResult.data || [];

        // Calculate balances efficiently
        const balances = [];
        
        if (leaveTypes.length > 0) {
          // Group leaves by type
          const leavesByType = {};
          allLeaves.forEach(leave => {
            if (!leavesByType[leave.leave_type_id]) {
              leavesByType[leave.leave_type_id] = [];
            }
            leavesByType[leave.leave_type_id].push(leave);
          });

          // Process each leave type
          for (const leaveType of leaveTypes) {
            const typeLeaves = leavesByType[leaveType.id] || [];
            
            if (leaveType.label === 'Paid Leave') {
              const totalUsed = typeLeaves.reduce((total, leave) => {
                if (leave.actual_days_used) return total + leave.actual_days_used;
                if (leave.is_half_day) return total + 0.5;
                const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                return total + daysDiff;
              }, 0);
              
              const remaining = Math.max(0, 1.5 - totalUsed);
              balances.push(`🌴 *Paid Leave*: ${remaining} days remaining (${totalUsed} used)`);
              
            } else if (leaveType.label === 'Work From Home') {
              const totalUsed = typeLeaves.reduce((total, leave) => {
                if (leave.actual_days_used) return total + leave.actual_days_used;
                if (leave.is_half_day) return total + 0.5;
                const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                return total + daysDiff;
              }, 0);
              
              const remaining = Math.max(0, 2 - totalUsed);
              balances.push(`🏠 *Work From Home*: ${remaining} days remaining (${totalUsed} used)`);
              
            } else if (leaveType.label === 'Short Leave') {
              const totalUsed = typeLeaves.reduce((total, leave) => {
                return total + (leave.hours_requested || 1);
              }, 0);
              
              const remaining = Math.max(0, 4 - totalUsed);
              balances.push(`⏰ *Short Leave*: ${remaining} hours remaining (${totalUsed} used)`);
              
            } else if (leaveType.label === 'Additional work from home') {
              // Check if regular WFH is exhausted
              const wfhLeaveType = leaveTypes.find(lt => lt.label === 'Work From Home');
              if (wfhLeaveType) {
                const wfhLeaves = leavesByType[wfhLeaveType.id] || [];
                const wfhUsed = wfhLeaves.reduce((total, leave) => {
                  if (leave.actual_days_used) return total + leave.actual_days_used;
                  if (leave.is_half_day) return total + 0.5;
                  const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                  return total + daysDiff;
                }, 0);
                
                const wfhRemaining = Math.max(0, 2 - wfhUsed);
                
                if (wfhRemaining <= 0) {
                  const additionalUsed = typeLeaves.reduce((total, leave) => {
                    if (leave.actual_days_used) return total + leave.actual_days_used;
                    if (leave.is_half_day) return total + 0.5;
                    const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                    return total + daysDiff;
                  }, 0);
                  
                  balances.push(`🏠 *Additional WFH*: Unlimited available (${additionalUsed} used)`);
                } else {
                  balances.push(`🏠 *Additional WFH*: Not available (use regular WFH first)`);
                }
              }
            }
          }
        }

        // Create the full response
        const balanceText = balances.length > 0 ? '\n\n*📊 Current Leave Balances:*\n' + balances.join('\n') : '';
        
        let messageBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hi ${userName}! ${isAdmin ? '👑 *Admin Dashboard* -' : 'Would you like to:'}${balanceText}`
            }
          }
        ];

        if (isAdmin) {
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

        // Add common user options
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

        // Send the full response via webhook (delayed response)
        const responseUrl = formData.get('response_url');
        if (responseUrl) {
          await fetch(responseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              response_type: 'ephemeral',
              replace_original: true,
              blocks: messageBlocks
            }),
          });
        }

        console.log('✅ Sent full response via webhook');
      } catch (error) {
        console.error('Error in background processing:', error);
        
        // Send error response via webhook
        const responseUrl = formData.get('response_url');
        if (responseUrl) {
          await fetch(responseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              response_type: 'ephemeral',
              replace_original: true,
              text: '❌ An error occurred while loading your leave dashboard. Please try again.',
            }),
          });
        }
      }
    };

    // Start background processing without waiting for it
    backgroundProcessing().catch(console.error);

    // Return immediate response
    return new Response(
      JSON.stringify(quickResponse),
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
