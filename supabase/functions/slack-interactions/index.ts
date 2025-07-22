import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Add detailed logging
  console.log('=== SLACK INTERACTION REQUEST START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  console.log('Body available:', req.body ? 'Yes' : 'No');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Test endpoint - return simple response for GET requests
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        message: 'Slack Interactions endpoint is working',
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
    
    let formData;
    let body;
    
    if (contentType.includes('application/json')) {
      // Handle JSON payload (URL verification)
      body = await req.text();
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
    
    // Handle form data (normal interactions)
    try {
      formData = await req.formData();
      console.log('✅ Successfully parsed FormData for interactions');
    } catch (parseError) {
      console.error('❌ Failed to parse FormData:', parseError);
      return new Response('Invalid form data', { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    console.log('📋 All FormData entries:', Array.from(formData.entries()));
    
    const payloadString = formData.get('payload') as string;
    if (!payloadString) {
      console.error('❌ No payload found in FormData');
      return new Response('No payload found', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    let payload;
    try {
      payload = JSON.parse(payloadString);
      console.log('✅ Successfully parsed payload');
      console.log('📝 Payload type:', payload.type);
      console.log('📝 Payload data:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse payload JSON:', parseError);
      return new Response('Invalid JSON payload', { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('Received Slack interaction:', payload.type, payload.type === 'block_actions' ? payload.actions?.[0]?.action_id : '');

    // Handle button clicks from the interactive message
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const userId = action.value;
      
      console.log('Processing action:', action.action_id, 'for user:', userId);
      
      switch (action.action_id) {
        case 'apply_leave':
          return await handleApplyLeave(supabaseClient, payload, userId);
        
        case 'check_balance':
          return await handleCheckBalance(supabaseClient, payload, userId);
        
        case 'teammates_leave':
          return await handleTeammatesLeave(supabaseClient, payload, userId);
        
        case 'view_upcoming':
          return await handleViewUpcoming(supabaseClient, payload, userId);
        
        case 'view_holidays':
          return await handleViewHolidays(supabaseClient, payload, userId);
        
        case 'leave_policy':
          return await handleLeavePolicy(supabaseClient, payload, userId);
        
        case 'clear_pending':
          return await handleClearPending(supabaseClient, payload, userId);
        
        case 'view_more':
          return await handleViewMore(supabaseClient, payload, userId);
        
        case 'talk_to_us':
          return await handleTalkToUs(supabaseClient, payload, userId);
        
        case 'admin_review_requests':
          return await handleAdminReviewRequests(supabaseClient, payload, userId);
        
        case 'admin_team_overview':
          return await handleAdminTeamOverview(supabaseClient, payload, userId);
          
        case 'approve_leave':
          return await handleApproveLeave(supabaseClient, payload, userId);
          
        case 'reject_leave':
          return await handleRejectLeave(supabaseClient, payload, userId);
        
        case 'cancel_leave':
          return await handleCancelLeave(supabaseClient, payload, userId);
        
        case 'admin_action_overflow':
          // Handle overflow menu actions for admin approvals/rejections
          const selectedValue = action.selected_option?.value;
          if (selectedValue?.startsWith('approve_')) {
            const leaveId = selectedValue.replace('approve_', '');
            return await handleApproveLeave(supabaseClient, payload, leaveId);
          } else if (selectedValue?.startsWith('reject_')) {
            const leaveId = selectedValue.replace('reject_', '');
            return await handleRejectLeave(supabaseClient, payload, leaveId);
          }
          return new Response('Unknown admin action', { status: 400 });
        
        default:
          console.log('Unknown action received:', action.action_id);
          return new Response(
            JSON.stringify({
              response_type: 'ephemeral',
              text: `❌ Unknown action: ${action.action_id}. Please try again or contact support.`,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
      }
    }

    if (payload.type === 'view_submission' && payload.view.callback_id === 'leave_application_modal') {
      // Extract form data
      const values = payload.view.state.values;
      const userId = payload.view.private_metadata;
      
      const leaveTypeId = values.leave_type.leave_type_select.selected_option?.value;
      
      // Get date values from the new datetime structure
      const actualStartDate = values.start_datetime?.start_date_picker?.selected_date;
      const actualEndDate = values.end_datetime?.end_date_picker?.selected_date;
      
      // Get time selections for future use
      const startTime = values.start_datetime?.start_time_select?.selected_option?.value || 'start_of_day';
      const endTime = values.end_datetime?.end_time_select?.selected_option?.value || 'end_of_day';
      
      const reason = values.reason?.reason_input?.value || '';

      console.log('Form submission data:', {
        leaveTypeId,
        actualStartDate,
        actualEndDate,
        startTime,
        endTime,
        reason,
        fullValues: JSON.stringify(values)
      });

      if (!leaveTypeId || !actualStartDate || !actualEndDate) {
        return new Response(
          JSON.stringify({
            response_action: 'errors',
            errors: {
              leave_type: !leaveTypeId ? 'Please select a leave type' : undefined,
              start_datetime: !actualStartDate ? 'Please select a start date' : undefined,
              end_datetime: !actualEndDate ? 'Please select an end date' : undefined,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate dates
      const start = new Date(actualStartDate);
      const end = new Date(actualEndDate);
      
      if (end < start) {
        return new Response(
          JSON.stringify({
            response_action: 'errors',
            errors: {
              end_date: 'End date must be after start date',
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Create leave application
      const { error: insertError } = await supabaseClient
        .from('leave_applied_users')
        .insert({
          user_id: userId,
          leave_type_id: leaveTypeId,
          start_date: actualStartDate,
          end_date: actualEndDate,
          reason: reason,
          applied_at: new Date().toISOString(),
          status: 'pending',
        });

      if (insertError) {
        console.error('Error creating leave application:', insertError);
        return new Response(
          JSON.stringify({
            response_action: 'errors',
            errors: {
              leave_type: 'Failed to submit leave application. Please try again.',
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Send Slack notification about the new application
      try {
        const { data: leaveApplication } = await supabaseClient
          .from('leave_applied_users')
          .select(`
            *,
            leave_types (label, color),
            profiles (name, email)
          `)
          .eq('user_id', userId)
          .eq('start_date', actualStartDate)
          .eq('end_date', actualEndDate)
          .single();

        if (leaveApplication) {
          console.log('📤 Sending Slack admin channel notification for new leave application');
          
          // Send notification to admin channel (webhook)
          const adminChannelResponse = await supabaseClient.functions.invoke('slack-notify', {
            body: {
              leaveApplication: leaveApplication,
              isTest: false,
              sendToAdminChannel: true
            }
          });

          if (adminChannelResponse.error) {
            console.error('Failed to send admin channel notification:', adminChannelResponse.error);
          } else {
            console.log('✅ Admin channel notification sent successfully');
          }
          
          // Create notification for admin in webapp
          await supabaseClient
            .from('notifications')
            .insert({
              user_id: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV', // Admin user ID
              message: `New leave request from ${leaveApplication.profiles?.name || 'Unknown'} for ${leaveApplication.leave_types?.label || 'leave'} from ${actualStartDate} to ${actualEndDate}`,
              type: 'leave_request'
            });
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
      }

      return new Response(
        JSON.stringify({
          response_action: 'clear'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error in slack-interactions function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Handler functions for button interactions
async function handleApplyLeave(supabaseClient: any, payload: any, userId: string) {
  // Get leave types for the modal
  const { data: leaveTypes } = await supabaseClient
    .from('leave_types')
    .select('id, label, color')
    .eq('is_active', true);

  // Get user's leave balance
  const { data: balanceData } = await supabaseClient
    .rpc('get_total_remaining_leaves', { p_user_id: userId });

  const remainingDays = balanceData?.total_remaining_days || 0;

  const modal = {
    type: 'modal',
    callback_id: 'leave_application_modal',
    title: {
      type: 'plain_text',
      text: '🌿 Apply for Leave',
    },
    submit: {
      type: 'plain_text',
      text: 'Apply',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    private_metadata: userId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🌱 You have *${remainingDays} days* remaining in this cycle`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'input',
        block_id: 'leave_type',
        element: {
          type: 'static_select',
          action_id: 'leave_type_select',
          placeholder: {
            type: 'plain_text',
            text: '🍃 Select a leave type',
          },
          options: (leaveTypes || []).map((type: any) => ({
            text: {
              type: 'plain_text',
              text: `${getLeaveTypeIcon(type.label)} ${type.label}`,
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
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Start Date & Time*'
        }
      },
      {
        type: 'actions',
        block_id: 'start_datetime',
        elements: [
          {
            type: 'datepicker',
            action_id: 'start_date_picker',
            placeholder: {
              type: 'plain_text',
              text: 'Today',
            },
            initial_date: new Date().toISOString().split('T')[0]
          },
          {
            type: 'static_select',
            action_id: 'start_time_select',
            placeholder: {
              type: 'plain_text',
              text: 'Start of day',
            },
            options: [
              {
                text: { type: 'plain_text', text: 'Start of day (10:00 AM)' },
                value: 'start_of_day'
              },
              {
                text: { type: 'plain_text', text: 'After lunch (2:45 PM)' },
                value: 'after_lunch'
              },
              {
                text: { type: 'plain_text', text: 'Custom time' },
                value: 'custom'
              }
            ],
            initial_option: {
              text: { type: 'plain_text', text: 'Start of day (10:00 AM)' },
              value: 'start_of_day'
            }
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*End Date & Time*'
        }
      },
      {
        type: 'actions',
        block_id: 'end_datetime',
        elements: [
          {
            type: 'datepicker',
            action_id: 'end_date_picker',
            placeholder: {
              type: 'plain_text',
              text: 'Today',
            },
            initial_date: new Date().toISOString().split('T')[0]
          },
          {
            type: 'static_select',
            action_id: 'end_time_select',
            placeholder: {
              type: 'plain_text',
              text: 'End of day',
            },
            options: [
              {
                text: { type: 'plain_text', text: 'End of day (6:30 PM)' },
                value: 'end_of_day'
              },
              {
                text: { type: 'plain_text', text: 'Before lunch (2:00 PM)' },
                value: 'before_lunch'
              },
              {
                text: { type: 'plain_text', text: 'Custom time' },
                value: 'custom'
              }
            ],
            initial_option: {
              text: { type: 'plain_text', text: 'End of day (6:30 PM)' },
              value: 'end_of_day'
            }
          }
        ]
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
            text: 'Add a reason (required)',
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

  // Open modal using Slack API
  const botToken = Deno.env.get('SLACK_BOT_TOKEN');
  console.log('Bot token available:', botToken ? 'Yes' : 'No');
  console.log('Bot token preview:', botToken ? `${botToken.substring(0, 10)}...` : 'Not found');
  
  if (!botToken) {
    console.error('SLACK_BOT_TOKEN not found in environment variables');
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Configuration error: Bot token not available. Please contact your administrator.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }

  // Validate that we have a trigger_id
  if (!payload.trigger_id) {
    console.error('No trigger_id provided in payload');
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Invalid interaction. Please try the command again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
  
  try {
    console.log('Opening modal with trigger_id:', payload.trigger_id);
    
    // Test token validity first with a simple API call
    const testResponse = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const testData = await testResponse.json();
    console.log('Token test response:', JSON.stringify(testData, null, 2));
    
    if (!testData.ok) {
      console.error('Bot token validation failed:', testData.error);
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Authentication failed: ${testData.error}. Please contact your administrator.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const modalResponse = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trigger_id: payload.trigger_id,
        view: modal,
      }),
    });

    const responseData = await modalResponse.json();
    console.log('Modal API response:', JSON.stringify(responseData, null, 2));
    
    if (!responseData.ok) {
      console.error('Slack API error:', responseData.error);
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Failed to open leave application form: ${responseData.error}. Please try again or contact support.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    console.log('Modal opened successfully');
  } catch (error) {
    console.error('Error opening modal:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to open leave application form. Please try again or contact support.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }

  return new Response('', { status: 200 });
}

async function handleCheckBalance(supabaseClient: any, payload: any, userId: string) {
  try {
    // Get detailed leave balance information
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();

    const userName = profile?.name || 'User';

    // Get all leave types and their individual balances
    const { data: leaveTypes } = await supabaseClient
      .from('leave_types')
      .select(`
        id, 
        label, 
        color,
        leave_policies (annual_allowance)
      `)
      .eq('is_active', true);

    if (!leaveTypes || leaveTypes.length === 0) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '⚠️ No leave types configured. Please contact HR.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate used leave for each type
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    let totalRemainingDays = 0;
    let deductibleLeaves = [];
    let nonDeductibleLeaves = [];

    for (const leaveType of leaveTypes) {
      const { data: balanceData } = await supabaseClient
        .rpc('get_monthly_leave_balance', { 
          p_user_id: userId, 
          p_leave_type_id: leaveType.id,
          p_month: currentMonth,
          p_year: currentYear
        });

      if (balanceData) {
        const allowance = balanceData.monthly_allowance || 0;
        const used = balanceData.used_this_month || 0;
        const remaining = balanceData.remaining_this_month || 0;
        
        totalRemainingDays += remaining;

        const leaveInfo = {
          label: leaveType.label,
          icon: getLeaveTypeIcon(leaveType.label),
          used: used,
          remaining: remaining,
          allowance: allowance
        };

        // Categorize leaves based on type
        if (leaveType.label.includes('Additional') || leaveType.label.includes('Comp') || leaveType.label.includes('Special')) {
          nonDeductibleLeaves.push(leaveInfo);
        } else {
          deductibleLeaves.push(leaveInfo);
        }
      }
    }

    let balanceBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `You have *${totalRemainingDays.toFixed(2)} days* of leave balance remaining.\n\nHere's a breakdown of your leaves this cycle:`
        }
      },
      {
        type: 'divider'
      }
    ];

    // Add deductible leave types
    if (deductibleLeaves.length > 0) {
      balanceBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Deductible leave-types:*'
        }
      });

      deductibleLeaves.forEach(leave => {
        const leaveText = `${leave.icon} *${leave.label}:* ${leave.used.toFixed(2)} applied, ${leave.remaining.toFixed(2)} remaining`;
        balanceBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• ${leaveText}`
          }
        });
      });
    }

    // Add non-deductible leave types if any
    if (nonDeductibleLeaves.length > 0) {
      balanceBlocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Non-deductible leave-types:*'
          }
        }
      );

      nonDeductibleLeaves.forEach(leave => {
        const leaveText = `${leave.icon} *${leave.label}:* ${leave.used.toFixed(2)} applied`;
        balanceBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• ${leaveText}`
          }
        });
      });
    }

    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        blocks: balanceBlocks,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to fetch leave balance. Please try again or contact support.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
}

function getLeaveTypeIcon(leaveType: string): string {
  const type = leaveType.toLowerCase();
  if (type.includes('paid') || type.includes('annual')) return '🌴';
  if (type.includes('sick') || type.includes('medical')) return '🏥';
  if (type.includes('bereavement')) return '🌸';
  if (type.includes('restricted') || type.includes('holiday')) return '🔔';
  if (type.includes('short')) return '⏰';
  if (type.includes('work from home') || type.includes('wfh')) return '🏠';
  if (type.includes('additional')) return '➕';
  if (type.includes('comp')) return '⚪';
  if (type.includes('special')) return '🔴';
  return '📅';
}

async function handleTeammatesLeave(supabaseClient: any, payload: any, userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: teammatesOnLeave } = await supabaseClient
      .from('leave_applied_users')
      .select(`
        *,
        profiles (name),
        leave_types (label, color)
      `)
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);

    let blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${teammatesOnLeave?.length || 0} people are on leave today* 🌴`
        }
      },
      {
        type: 'divider'
      }
    ];

    if (teammatesOnLeave && teammatesOnLeave.length > 0) {
      // Group by company/team
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '👆 *GROTO*'
        }
      });

      teammatesOnLeave.forEach((leave: any) => {
        // Determine if it's a half day leave
        let leaveType = '';
        if (leave.is_half_day) {
          leaveType = leave.leave_time_start < '12:00' ? 'First Half' : 'Second Half';
        } else {
          leaveType = 'Full Day';
        }

        // Add status indicator if pending
        const statusIndicator = leave.status === 'pending' ? ' - (pending approval)' : '';
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• *${leave.profiles?.name || 'Unknown'}* - ${leaveType}${statusIndicator}`
          }
        });
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No teammates on leave today! 🎉\n\nEveryone is available and ready to work!'
        }
      });
    }

    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        blocks: blocks,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error fetching teammates leave:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to fetch teammates leave information. Please try again or contact support.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
}

async function handleViewUpcoming(supabaseClient: any, payload: any, userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: upcomingLeaves } = await supabaseClient
      .from('leave_applied_users')
      .select(`
        *,
        leave_types (label, color)
      `)
      .eq('user_id', userId)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(10);

    let blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📋 Your Upcoming Leaves*'
        }
      },
      {
        type: 'divider'
      }
    ];
    
    if (upcomingLeaves && upcomingLeaves.length > 0) {
      upcomingLeaves.forEach((leave: any, index: number) => {
        const statusEmoji = leave.status === 'approved' ? '✅' : leave.status === 'rejected' ? '❌' : '⏳';
        const days = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        let blockText = `${statusEmoji} *${leave.leave_types.label}*\n📅 ${leave.start_date} to ${leave.end_date} (${days} day${days > 1 ? 's' : ''})\n🏷️ Status: ${leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}`;
        
        if (leave.reason) {
          blockText += `\n📝 _${leave.reason}_`;
        }

        const block: any = {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: blockText
          }
        };

        // Add cancel option for pending leaves
        if (leave.status === 'pending') {
          block.accessory = {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🗑️ Cancel',
            },
            value: leave.id,
            action_id: 'cancel_leave',
            style: 'danger'
          };
        }

        blocks.push(block);

        if (index < upcomingLeaves.length - 1) {
          blocks.push({
            type: 'divider'
          });
        }
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🎯 No upcoming leaves scheduled.\n\nReady to plan your next break? Use the *Apply Leave* button!'
        }
      });
    }

    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        blocks: blocks,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching upcoming leaves:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to fetch upcoming leaves. Please try again or contact support.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleViewHolidays(supabaseClient: any, payload: any, userId: string) {
  const { data: holidays } = await supabaseClient
    .from('company_holidays')
    .select('*')
    .eq('is_active', true)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(10);

  let holidaysText = '*🎉 Upcoming Company Holidays*\n\n';
  
  if (holidays && holidays.length > 0) {
    holidays.forEach((holiday: any) => {
      holidaysText += `• *${holiday.name}* - ${holiday.date}\n`;
      if (holiday.description) {
        holidaysText += `  ${holiday.description}\n`;
      }
    });
  } else {
    holidaysText += 'No upcoming holidays scheduled.';
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: holidaysText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

async function handleLeavePolicy(supabaseClient: any, payload: any, userId: string) {
  const { data: leaveTypes } = await supabaseClient
    .from('leave_types')
    .select(`
      *,
      leave_policies (annual_allowance, carry_forward_limit)
    `)
    .eq('is_active', true);

  let policyText = '*📖 Leave Policy*\n\n';
  
  if (leaveTypes && leaveTypes.length > 0) {
    leaveTypes.forEach((type: any) => {
      if (type.leave_policies && type.leave_policies.length > 0) {
        const policy = type.leave_policies[0];
        policyText += `• *${type.label}*: ${policy.annual_allowance} days/year`;
        if (policy.carry_forward_limit) {
          policyText += ` (${policy.carry_forward_limit} days carry forward)`;
        }
        policyText += '\n';
      }
    });
  } else {
    policyText += 'No leave policy information available.';
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: policyText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

async function handleClearPending(supabaseClient: any, payload: any, userId: string) {
  try {
    // Check if user is admin
    const isAdmin = userId === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';
    
    if (isAdmin) {
      // Admin can see all pending requests
      const { data: pendingLeaves } = await supabaseClient
        .from('leave_applied_users')
        .select(`
          *,
          profiles (name, email),
          leave_types (label, color)
        `)
        .eq('status', 'pending')
        .order('applied_at', { ascending: false })
        .limit(15);

      if (!pendingLeaves || pendingLeaves.length === 0) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '✅ *No pending leave requests to review!*\n\nAll caught up! 🎉',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      let blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👑 *Admin Review Center*\n\n📋 *${pendingLeaves.length} Pending Request${pendingLeaves.length > 1 ? 's' : ''}*`
          }
        },
        {
          type: 'divider'
        }
      ];

      pendingLeaves.forEach((request: any, index: number) => {
        const days = Math.ceil((new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${request.profiles?.name || 'Unknown User'}*\n📅 ${request.start_date} to ${request.end_date} (${days} day${days > 1 ? 's' : ''})\n🏷️ ${request.leave_types?.label || 'Unknown Type'}${request.reason ? `\n📝 _${request.reason}_` : ''}`
          },
          accessory: {
            type: 'overflow',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: '✅ Approve',
                },
                value: `approve_${request.id}`
              },
              {
                text: {
                  type: 'plain_text',
                  text: '❌ Reject',
                },
                value: `reject_${request.id}`
              }
            ],
            action_id: 'admin_action_overflow'
          }
        });

        if (index < pendingLeaves.length - 1) {
          blocks.push({
            type: 'divider'
          });
        }
      });

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 Use the menu (⋯) to approve or reject requests'
          }
        ]
      });

      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          blocks: blocks,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Regular user can only see their own pending requests
      const { data: pendingLeaves } = await supabaseClient
        .from('leave_applied_users')
        .select(`
          *,
          leave_types (label, color)
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('applied_at', { ascending: false });

      if (!pendingLeaves || pendingLeaves.length === 0) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '✅ You have no pending leave requests!\n\nAll your requests have been processed. 🎉',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      let blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📋 *Your Pending Requests*\n\nYou have ${pendingLeaves.length} pending request${pendingLeaves.length > 1 ? 's' : ''}`
          }
        },
        {
          type: 'divider'
        }
      ];

      pendingLeaves.forEach((request: any, index: number) => {
        const days = Math.ceil((new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏳ *${request.leave_types?.label || 'Leave'}*\n📅 ${request.start_date} to ${request.end_date} (${days} day${days > 1 ? 's' : ''})${request.reason ? `\n📝 _${request.reason}_` : ''}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🗑️ Cancel',
            },
            value: request.id,
            action_id: 'cancel_leave',
            style: 'danger'
          }
        });

        if (index < pendingLeaves.length - 1) {
          blocks.push({
            type: 'divider'
          });
        }
      });

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 You can cancel pending requests using the Cancel button'
          }
        ]
      });

      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          blocks: blocks,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to fetch pending requests. Please try again or contact support.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
}

async function handleViewMore(supabaseClient: any, payload: any, userId: string) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*⭐ Discover More Timeloo Features*'
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🌐 Visit Our Website:*\n🔗 https://www.letsgroto.com/\n\n*Explore our full suite of workforce management tools!*'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📱 Web App Features:*\n🔔 Real-time notifications for leave approvals\n📊 Team leave analytics and insights\n📈 Generate detailed leave reports\n🎯 Set custom leave reminders\n🔄 Automated balance calculations\n📋 Advanced leave policy management'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*💼 Enterprise Solutions:*\n• Multi-organization management\n• Custom approval workflows\n• Advanced reporting & analytics\n• API integrations\n• White-label solutions'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🌐 Visit Website',
          },
          url: 'https://www.letsgroto.com/',
          action_id: 'visit_website'
        }
      ]
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '✨ Transform your leave management experience with Timeloo!'
        }
      ]
    }
  ];

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      blocks: blocks,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

async function handleTalkToUs(supabaseClient: any, payload: any, userId: string) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*💬 Need Help? Talk to Us!*'
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📧 *Email Support:*\n✉️ hello@letsgroto.com\n\n💼 *For urgent matters or technical support*'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🌐 *Other Ways to Reach Us:*\n• Visit our web app for more features\n• Check the help documentation\n• Contact your HR team for policy questions'
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🎯 We\'re here to make leave management easier for you!'
        }
      ]
    }
  ];

    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        blocks: blocks,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
}

// Admin handler functions
async function handleAdminReviewRequests(supabaseClient: any, payload: any, userId: string) {
  // Get all pending leave requests
  const { data: pendingRequests } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      profiles (name, email),
      leave_types (label, color)
    `)
    .eq('status', 'pending')
    .order('applied_at', { ascending: false })
    .limit(10);

  if (!pendingRequests || pendingRequests.length === 0) {
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '✅ *No pending leave requests!*\n\nAll caught up! 🎉',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }

  // Create blocks for each pending request
  let blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `👑 *Admin Review Center*\n\n📋 *${pendingRequests.length} Pending Request${pendingRequests.length > 1 ? 's' : ''}*`
      }
    },
    {
      type: 'divider'
    }
  ];

  pendingRequests.forEach((request: any, index: number) => {
    const days = Math.ceil((new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${request.profiles?.name || 'Unknown User'}*\n📅 ${request.start_date} to ${request.end_date} (${days} day${days > 1 ? 's' : ''})\n🏷️ ${request.leave_types?.label || 'Unknown Type'}${request.reason ? `\n📝 _${request.reason}_` : ''}`
      },
      accessory: {
        type: 'overflow',
        options: [
          {
            text: {
              type: 'plain_text',
              text: '✅ Approve',
            },
            value: `approve_${request.id}`
          },
          {
            text: {
              type: 'plain_text',
              text: '❌ Reject',
            },
            value: `reject_${request.id}`
          }
        ],
        action_id: 'admin_action_overflow'
      }
    });

    if (index < pendingRequests.length - 1) {
      blocks.push({
        type: 'divider'
      });
    }
  });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '💡 Use the menu (⋯) to approve or reject requests'
      }
    ]
  });

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      blocks: blocks,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

async function handleAdminTeamOverview(supabaseClient: any, payload: any, userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Get current and upcoming leaves
  const { data: currentLeaves } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      profiles (name),
      leave_types (label, color)
    `)
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today);

  const { data: upcomingLeaves } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      profiles (name),
      leave_types (label, color)
    `)
    .eq('status', 'approved')
    .gt('start_date', today)
    .lte('start_date', nextWeek)
    .order('start_date', { ascending: true });

  let overviewText = '*👥 Team Leave Overview*\n\n';
  
  // Current leaves
  overviewText += '*🏖️ Currently on Leave:*\n';
  if (currentLeaves && currentLeaves.length > 0) {
    currentLeaves.forEach((leave: any) => {
      overviewText += `• *${leave.profiles?.name || 'Unknown'}* - ${leave.leave_types?.label} (until ${leave.end_date})\n`;
    });
  } else {
    overviewText += '• No one is currently on leave\n';
  }

  overviewText += '\n*📅 Upcoming This Week:*\n';
  if (upcomingLeaves && upcomingLeaves.length > 0) {
    upcomingLeaves.forEach((leave: any) => {
      overviewText += `• *${leave.profiles?.name || 'Unknown'}* - ${leave.leave_types?.label} (${leave.start_date} to ${leave.end_date})\n`;
    });
  } else {
    overviewText += '• No upcoming leaves this week\n';
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: overviewText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

async function handleApproveLeave(supabaseClient: any, payload: any, leaveRequestId: string) {
  const adminUserId = payload.user.id;
  
  console.log(`🔄 Processing leave approval for request ID: ${leaveRequestId} by admin: ${adminUserId}`);
  
  // Update leave status to approved
  const { error: updateError } = await supabaseClient
    .from('leave_applied_users')
    .update({
      status: 'approved',
      approved_by: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV',
      approved_at: new Date().toISOString()
    })
    .eq('id', leaveRequestId);

  if (updateError) {
    console.error('❌ Error approving leave:', updateError);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to approve leave request. Please try again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }

  // Get the updated leave request for notifications
  const { data: leaveRequest, error: fetchError } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      profiles (name, email),
      leave_types (label, color)
    `)
    .eq('id', leaveRequestId)
    .single();

  if (fetchError || !leaveRequest) {
    console.error('❌ Error fetching leave request details:', fetchError);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '✅ Leave approved, but failed to send notifications. User will see the approval in the dashboard.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }

  console.log(`📋 Processing notifications for user: ${leaveRequest.user_id} (${leaveRequest.profiles?.name})`);

  // Send in-app notification to the user
  try {
    const { error: notificationError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: leaveRequest.user_id,
        message: `Your ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved! 🎉`,
        type: 'leave_approved'
      });

    if (notificationError) {
      console.error('⚠️ Failed to create in-app notification:', notificationError);
    } else {
      console.log('✅ In-app notification created successfully');
    }
  } catch (error) {
    console.error('⚠️ Error creating in-app notification:', error);
  }

  // Send Slack direct message notification
  await sendSlackPersonalNotification(supabaseClient, leaveRequest, 'approved');

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: `✅ *Leave Request Approved!*\n\nSuccessfully approved ${leaveRequest?.profiles?.name || 'user'}'s leave request. They will be notified immediately via Slack and in-app notification.`,
      replace_original: true
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

async function handleRejectLeave(supabaseClient: any, payload: any, leaveRequestId: string) {
  const adminUserId = payload.user.id;
  
  console.log(`🔄 Processing leave rejection for request ID: ${leaveRequestId} by admin: ${adminUserId}`);
  
  // Update leave status to rejected
  const { error: updateError } = await supabaseClient
    .from('leave_applied_users')
    .update({
      status: 'rejected',
      approved_by: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV',
      approved_at: new Date().toISOString()
    })
    .eq('id', leaveRequestId);

  if (updateError) {
    console.error('❌ Error rejecting leave:', updateError);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to reject leave request. Please try again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }

  // Get the updated leave request for notifications
  const { data: leaveRequest, error: fetchError } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      profiles (name, email),
      leave_types (label, color)
    `)
    .eq('id', leaveRequestId)
    .single();

  if (fetchError || !leaveRequest) {
    console.error('❌ Error fetching leave request details:', fetchError);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '✅ Leave rejected, but failed to send notifications. User will see the rejection in the dashboard.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }

  console.log(`📋 Processing rejection notifications for user: ${leaveRequest.user_id} (${leaveRequest.profiles?.name})`);

  // Send in-app notification to the user
  try {
    const { error: notificationError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: leaveRequest.user_id,
        message: `Your ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been rejected.`,
        type: 'leave_rejected'
      });

    if (notificationError) {
      console.error('⚠️ Failed to create in-app notification:', notificationError);
    } else {
      console.log('✅ In-app notification created successfully');
    }
  } catch (error) {
    console.error('⚠️ Error creating in-app notification:', error);
  }

  // Send Slack direct message notification
  await sendSlackPersonalNotification(supabaseClient, leaveRequest, 'rejected');

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: `❌ *Leave Request Rejected*\n\nSuccessfully rejected ${leaveRequest?.profiles?.name || 'user'}'s leave request. They will be notified via Slack and in-app notification.`,
      replace_original: true
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

// Helper function to send personal Slack notifications to users
async function sendSlackPersonalNotification(supabaseClient: any, leaveRequest: any, action: 'approved' | 'rejected') {
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
    } else {
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

async function handleCancelLeave(supabaseClient: any, payload: any, leaveRequestId: string) {
  try {
    // Get the leave request to check ownership
    const { data: leaveRequest } = await supabaseClient
      .from('leave_applied_users')
      .select(`
        *,
        profiles (name, email),
        leave_types (label, color)
      `)
      .eq('id', leaveRequestId)
      .single();

    if (!leaveRequest) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Leave request not found.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if the user owns this leave request
    const slackUserId = payload.user.id;
    const { data: userSlackIntegration } = await supabaseClient
      .from('user_slack_integrations')
      .select('user_id')
      .eq('slack_user_id', slackUserId)
      .single();

    if (!userSlackIntegration || userSlackIntegration.user_id !== leaveRequest.user_id) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ You can only cancel your own leave requests.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if the leave is still pending
    if (leaveRequest.status !== 'pending') {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Cannot cancel this leave request as it is already ${leaveRequest.status}.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Cancel the leave request by updating status
    const { error: updateError } = await supabaseClient
      .from('leave_applied_users')
      .update({
        status: 'cancelled'
      })
      .eq('id', leaveRequestId);

    if (updateError) {
      console.error('Error cancelling leave:', updateError);
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Failed to cancel leave request. Please try again.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create notification for admin about cancellation
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV', // Admin user ID
        message: `${leaveRequest.profiles?.name || 'User'} cancelled their ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date}`,
        type: 'leave_cancelled'
      });

    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: `✅ *Leave Request Cancelled*\n\nYour ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been successfully cancelled.`,
        replace_original: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in handleCancelLeave:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to cancel leave request. Please try again or contact support.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}