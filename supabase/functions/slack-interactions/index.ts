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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the form data from Slack
    let formData;
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
      
      // Get date values from the actions section
      const startDate = values.start_date?.start_date_picker?.selected_date || 
                       (payload.view.state.values.start_date_actions?.start_date_picker?.selected_date);
      const endDate = values.end_date?.end_date_picker?.selected_date || 
                     (payload.view.state.values.end_date_actions?.end_date_picker?.selected_date);
                     
      // Try alternative paths for the date pickers
      let actualStartDate = startDate;
      let actualEndDate = endDate;
      
      // Check if dates are in actions elements
      if (!actualStartDate || !actualEndDate) {
        const stateValues = payload.view.state.values;
        for (const blockKey in stateValues) {
          const block = stateValues[blockKey];
          if (block.start_date_picker) {
            actualStartDate = block.start_date_picker.selected_date;
          }
          if (block.end_date_picker) {
            actualEndDate = block.end_date_picker.selected_date;
          }
        }
      }
      
      const reason = values.reason?.reason_input?.value || '';

      console.log('Form submission data:', {
        leaveTypeId,
        actualStartDate,
        actualEndDate,
        reason,
        fullValues: JSON.stringify(values)
      });

      if (!leaveTypeId || !actualStartDate || !actualEndDate) {
        return new Response(
          JSON.stringify({
            response_action: 'errors',
            errors: {
              leave_type: !leaveTypeId ? 'Please select a leave type' : undefined,
              start_date: !actualStartDate ? 'Please select a start date' : undefined,
              end_date: !actualEndDate ? 'Please select an end date' : undefined,
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
          await supabaseClient.functions.invoke('slack-notify', {
            body: {
              leaveApplication: leaveApplication,
              isTest: false
            }
          });
          
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

  const modal = {
    type: 'modal',
    callback_id: 'leave_application_modal',
    title: {
      type: 'plain_text',
      text: '🏖️ Apply for Leave',
    },
    submit: {
      type: 'plain_text',
      text: 'Submit Application',
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
          text: '✨ *Submit your leave request instantly!*\nFill out the details below and we\'ll notify your manager.',
        },
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
            text: 'Choose leave type...',
          },
          options: (leaveTypes || []).map((type: any) => ({
            text: {
              type: 'plain_text',
              text: `${type.label}`,
              emoji: true,
            },
            value: type.id,
          })),
        },
        label: {
          type: 'plain_text',
          text: '📋 Leave Type',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📅 Select your leave dates*'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'datepicker',
            action_id: 'start_date_picker',
            placeholder: {
              type: 'plain_text',
              text: 'Start date',
            },
            initial_date: new Date().toISOString().split('T')[0]
          },
          {
            type: 'datepicker', 
            action_id: 'end_date_picker',
            placeholder: {
              type: 'plain_text',
              text: 'End date',
            },
            initial_date: new Date().toISOString().split('T')[0]
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
          max_length: 500,
          placeholder: {
            type: 'plain_text',
            text: 'e.g., Family vacation, medical appointment, personal matter...',
          },
        },
        label: {
          type: 'plain_text',
          text: '📝 Reason for Leave',
          emoji: true,
        },
        optional: true,
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 *Tip:* Your manager will be notified immediately and you\'ll get updates right here in Slack!'
          }
        ]
      }
    ],
  };

  // Open modal using Slack API
  const botToken = Deno.env.get('SLACK_BOT_TOKEN');
  try {
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
    console.log('Modal response:', responseData);
    
    if (!responseData.ok) {
      console.error('Error opening modal:', responseData.error);
    }
  } catch (error) {
    console.error('Error opening modal:', error);
  }

  return new Response('', { status: 200 });
}

async function handleCheckBalance(supabaseClient: any, payload: any, userId: string) {
  const { data: balances } = await supabaseClient
    .from('user_leave_balances')
    .select(`
      *,
      leave_types (label, color)
    `)
    .eq('user_id', userId)
    .eq('year', new Date().getFullYear());

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single();

  let totalDays = 0;
  let balanceBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `You have *${totalDays} days* remaining in this cycle 🌴`
      }
    },
    {
      type: 'divider'
    }
  ];

  if (balances && balances.length > 0) {
    // Calculate total remaining days
    balances.forEach((balance: any) => {
      const available = (balance.allocated_days || 0) - (balance.used_days || 0);
      totalDays += available;
    });

    // Update the total in the first block
    balanceBlocks[0].text.text = `You have *${totalDays.toFixed(2)} days* remaining in this cycle 🌴`;

    // Add detailed breakdown
    balanceBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "Here's a breakdown of your leaves this cycle:"
      }
    });

    // Group by deductible and non-deductible
    const deductibleLeaves: any[] = [];
    const nonDeductibleLeaves: any[] = [];

    balances.forEach((balance: any) => {
      const applied = balance.used_days || 0;
      const remaining = (balance.allocated_days || 0) - applied;
      const leaveInfo = {
        label: balance.leave_types.label,
        applied: applied,
        remaining: remaining,
        icon: getLeaveTypeIcon(balance.leave_types.label)
      };

      // Simple classification - you can enhance this based on your leave types
      if (balance.leave_types.label.toLowerCase().includes('additional') || 
          balance.leave_types.label.toLowerCase().includes('comp') ||
          balance.leave_types.label.toLowerCase().includes('special')) {
        nonDeductibleLeaves.push(leaveInfo);
      } else {
        deductibleLeaves.push(leaveInfo);
      }
    });

    // Add deductible leaves section
    if (deductibleLeaves.length > 0) {
      balanceBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Deductible leave-types:*'
        }
      });

      deductibleLeaves.forEach(leave => {
        balanceBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${leave.icon} *${leave.label}*: ${leave.applied.toFixed(2)} applied, ${leave.remaining.toFixed(2)} remaining`
          }
        });
      });
    }

    // Add non-deductible leaves section
    if (nonDeductibleLeaves.length > 0) {
      balanceBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Non-deductible leave-types:*'
        }
      });

      nonDeductibleLeaves.forEach(leave => {
        balanceBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${leave.icon} *${leave.label}*: ${leave.applied.toFixed(2)} applied`
          }
        });
      });
    }
  } else {
    balanceBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'No leave balance information available. Please contact HR to set up your leave balances.'
      }
    });
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      blocks: balanceBlocks,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
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

  let leaveText = '*👥 Teammates on Leave Today*\n\n';
  
  if (teammatesOnLeave && teammatesOnLeave.length > 0) {
    teammatesOnLeave.forEach((leave: any) => {
      leaveText += `• *${leave.profiles?.name || 'Unknown'}* - ${leave.leave_types.label} (until ${leave.end_date})\n`;
    });
  } else {
    leaveText += 'No teammates on leave today! 🎉';
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: leaveText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleViewUpcoming(supabaseClient: any, payload: any, userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: upcomingLeaves } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      leave_types (label, color)
    `)
    .eq('user_id', userId)
    .gte('start_date', today)
    .order('start_date', { ascending: true });

  let upcomingText = '*📋 Your Upcoming Leaves*\n\n';
  
  if (upcomingLeaves && upcomingLeaves.length > 0) {
    upcomingLeaves.forEach((leave: any) => {
      const statusEmoji = leave.status === 'approved' ? '✅' : leave.status === 'rejected' ? '❌' : '⏳';
      upcomingText += `${statusEmoji} *${leave.leave_types.label}* - ${leave.start_date} to ${leave.end_date} (${leave.status})\n`;
    });
  } else {
    upcomingText += 'No upcoming leaves scheduled.';
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: upcomingText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
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
    }
  );
}

async function handleClearPending(supabaseClient: any, payload: any, userId: string) {
  const { data: pendingLeaves } = await supabaseClient
    .from('leave_applied_users')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending');

  let responseText = '';
  
  if (pendingLeaves && pendingLeaves.length > 0) {
    responseText = `You have ${pendingLeaves.length} pending leave request(s). To cancel them, please visit the web app or contact your manager.`;
  } else {
    responseText = '✅ You have no pending leave requests to clear!';
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: responseText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleViewMore(supabaseClient: any, payload: any, userId: string) {
  const moreText = `*⭐ More Timeloo Features*

🔔 Get real-time notifications for leave approvals
📊 Track team leave patterns and analytics  
📱 Mobile-friendly web app access
🎯 Set leave reminders and notifications
📈 Generate leave reports for managers
🔄 Automated leave balance calculations
💬 Chat with HR directly from Slack

Visit the web app for full feature access!`;

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: moreText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleTalkToUs(supabaseClient: any, payload: any, userId: string) {
  const supportText = `*💬 Need Help?*

For support and questions:
• Visit our web app
• Contact your HR team
• Check the help documentation

We're here to make leave management easier for you! 🎯`;

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: supportText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    }
  );
}

async function handleApproveLeave(supabaseClient: any, payload: any, leaveRequestId: string) {
  const adminUserId = payload.user.id;
  
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
    console.error('Error approving leave:', updateError);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to approve leave request. Please try again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get the updated leave request for notifications
  const { data: leaveRequest } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      profiles (name, email),
      leave_types (label, color)
    `)
    .eq('id', leaveRequestId)
    .single();

  if (leaveRequest) {
    // Send notification to the user
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: leaveRequest.user_id,
        message: `Your ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved! 🎉`,
        type: 'leave_approved'
      });

    // Send Slack notification if user has Slack integration
    try {
      const { data: slackIntegration } = await supabaseClient
        .from('user_slack_integrations')
        .select('*')
        .eq('user_id', leaveRequest.user_id)
        .single();

      if (slackIntegration) {
        // Send direct message to user
        const botToken = Deno.env.get('SLACK_BOT_TOKEN');
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: slackIntegration.slack_user_id,
            text: `🎉 *Leave Request Approved!*\n\nYour ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved by your manager!\n\nEnjoy your time off! 🏖️`,
          }),
        });
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: `✅ *Leave Request Approved!*\n\nSuccessfully approved ${leaveRequest?.profiles?.name || 'user'}'s leave request. They will be notified immediately.`,
      replace_original: true
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleRejectLeave(supabaseClient: any, payload: any, leaveRequestId: string) {
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
    console.error('Error rejecting leave:', updateError);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Failed to reject leave request. Please try again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get the updated leave request for notifications
  const { data: leaveRequest } = await supabaseClient
    .from('leave_applied_users')
    .select(`
      *,
      profiles (name, email),
      leave_types (label, color)
    `)
    .eq('id', leaveRequestId)
    .single();

  if (leaveRequest) {
    // Send notification to the user
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: leaveRequest.user_id,
        message: `Your ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been rejected.`,
        type: 'leave_rejected'
      });

    // Send Slack notification if user has Slack integration
    try {
      const { data: slackIntegration } = await supabaseClient
        .from('user_slack_integrations')
        .select('*')
        .eq('user_id', leaveRequest.user_id)
        .single();

      if (slackIntegration) {
        // Send direct message to user
        const botToken = Deno.env.get('SLACK_BOT_TOKEN');
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: slackIntegration.slack_user_id,
            text: `❌ *Leave Request Update*\n\nYour ${leaveRequest.leave_types?.label} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been rejected.\n\nPlease contact your manager for more details.`,
          }),
        });
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: `❌ *Leave Request Rejected*\n\nSuccessfully rejected ${leaveRequest?.profiles?.name || 'user'}'s leave request. They will be notified.`,
      replace_original: true
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}