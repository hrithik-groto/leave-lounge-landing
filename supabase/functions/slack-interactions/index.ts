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
    const payload = JSON.parse(formData.get('payload') as string);
    
    console.log('Received Slack interaction:', payload.type, payload.type === 'block_actions' ? payload.actions?.[0]?.action_id : '');

    // Handle button clicks from the interactive message
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const userId = action.value;
      
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
        
        default:
          return new Response('Unknown action', { status: 400 });
      }
    }

    if (payload.type === 'view_submission' && payload.view.callback_id === 'leave_application_modal') {
      // Extract form data
      const values = payload.view.state.values;
      const userId = payload.view.private_metadata;
      
      const leaveTypeId = values.leave_type.leave_type_select.selected_option?.value;
      const startDate = values.start_date.start_date_picker.selected_date;
      const endDate = values.end_date.end_date_picker.selected_date;
      const reason = values.reason?.reason_input?.value || '';

      if (!leaveTypeId || !startDate || !endDate) {
        return new Response(
          JSON.stringify({
            response_action: 'errors',
            errors: {
              leave_type: !leaveTypeId ? 'Please select a leave type' : undefined,
              start_date: !startDate ? 'Please select a start date' : undefined,
              end_date: !endDate ? 'Please select an end date' : undefined,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
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
          start_date: startDate,
          end_date: endDate,
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
            leave_types (label, color)
          `)
          .eq('user_id', userId)
          .eq('start_date', startDate)
          .eq('end_date', endDate)
          .single();

        if (leaveApplication) {
          await supabaseClient.functions.invoke('slack-notify', {
            body: {
              leaveApplication: leaveApplication,
              isTest: false
            }
          });
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
      }

      return new Response(
        JSON.stringify({
          response_action: 'clear',
          text: '✅ Your leave application has been submitted successfully! You will be notified when it\'s reviewed.',
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
      text: 'Submit',
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
          options: (leaveTypes || []).map((type: any) => ({
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

  // Open modal using Slack API
  const botToken = Deno.env.get('SLACK_BOT_TOKEN');
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

  let balanceText = '*📊 Your Leave Balance*\n\n';
  
  if (balances && balances.length > 0) {
    balances.forEach((balance: any) => {
      const available = (balance.allocated_days || 0) - (balance.used_days || 0);
      balanceText += `• *${balance.leave_types.label}*: ${available}/${balance.allocated_days || 0} days available\n`;
    });
  } else {
    balanceText += 'No leave balance information available.';
  }

  return new Response(
    JSON.stringify({
      response_type: 'ephemeral',
      text: balanceText,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
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