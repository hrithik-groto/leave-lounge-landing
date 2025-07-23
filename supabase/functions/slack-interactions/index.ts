import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to send ephemeral messages
async function sendEphemeralMessage(responseUrl: string, message: string) {
  try {
    const response = await fetch(responseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        text: message,
        response_type: 'ephemeral'
      })
    });
    
    if (response.ok) {
      return new Response(null, { status: 200, headers: corsHeaders });
    } else {
      console.error('Failed to send ephemeral message:', await response.text());
      return new Response('Failed to send message', { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    console.error('Error sending ephemeral message:', error);
    return new Response('Error sending message', { status: 500, headers: corsHeaders });
  }
}

serve(async (req) => {
  console.log('=== SLACK INTERACTION REQUEST START ===');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const payload = formData.get('payload');
    if (!payload) {
      return new Response('No payload found', { status: 400 });
    }

    const parsedPayload = JSON.parse(payload.toString());
    console.log('📝 Payload type:', parsedPayload.type);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different types of interactions
    if (parsedPayload.type === 'block_actions') {
      const action = parsedPayload.actions?.[0];
      console.log('Processing action:', action?.action_id, 'for user:', parsedPayload.user?.id);

      if (action?.action_id === 'apply_leave') {
        return await handleApplyLeave(parsedPayload, supabaseClient);
      }
      
      // Handle other button interactions that don't require a response
      return new Response(null, { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    if (parsedPayload.type === 'view_submission') {
      console.log('Received Slack interaction:', parsedPayload.type);
      return await handleLeaveSubmission(parsedPayload, supabaseClient);
    }

    // For other interaction types, just acknowledge
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Error processing Slack interaction:', error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});

async function handleApplyLeave(payload: any, supabaseClient: any) {
  const userId = payload.actions[0].value;
  const triggerId = payload.trigger_id;
  const startTime = Date.now();

  console.log('🚀 URGENT: Opening modal immediately for trigger_id:', triggerId);

  try {
    // STEP 1: Open modal IMMEDIATELY with minimal data to avoid expiration
    const basicModal = {
      type: 'modal',
      callback_id: 'leave_application_modal',
      title: { type: 'plain_text', text: '🌿 Apply for Leave' },
      submit: { type: 'plain_text', text: 'Apply' },
      close: { type: 'plain_text', text: 'Cancel' },
      private_metadata: userId,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':seedling: Loading your leave balances...'
          }
        },
        {
          type: 'input',
          block_id: 'leave_type',
          label: { type: 'plain_text', text: 'Leave Type' },
          element: {
            type: 'static_select',
            action_id: 'leave_type_select',
            placeholder: { type: 'plain_text', text: '🍃 Loading leave types...' },
            options: [
              { text: { type: 'plain_text', text: 'Loading...' }, value: 'loading' }
            ]
          }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Start Date & Time*' }
        },
        {
          type: 'actions',
          block_id: 'start_datetime',
          elements: [
            {
              type: 'datepicker',
              action_id: 'start_date_picker',
              initial_date: new Date().toISOString().split('T')[0],
              placeholder: { type: 'plain_text', text: 'Today' }
            },
            {
              type: 'static_select',
              action_id: 'start_time_select',
              placeholder: { type: 'plain_text', text: 'Start of day' },
              initial_option: {
                text: { type: 'plain_text', text: 'Start of day (10:00 AM)' },
                value: 'start_of_day'
              },
              options: [
                { text: { type: 'plain_text', text: 'Start of day (10:00 AM)' }, value: 'start_of_day' },
                { text: { type: 'plain_text', text: 'After lunch (2:45 PM)' }, value: 'after_lunch' },
                { text: { type: 'plain_text', text: 'Custom time' }, value: 'custom' }
              ]
            }
          ]
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*End Date & Time*' }
        },
        {
          type: 'actions',
          block_id: 'end_datetime',
          elements: [
            {
              type: 'datepicker',
              action_id: 'end_date_picker',
              initial_date: new Date().toISOString().split('T')[0],
              placeholder: { type: 'plain_text', text: 'Today' }
            },
            {
              type: 'static_select',
              action_id: 'end_time_select',
              placeholder: { type: 'plain_text', text: 'End of day' },
              initial_option: {
                text: { type: 'plain_text', text: 'End of day (6:30 PM)' },
                value: 'end_of_day'
              },
              options: [
                { text: { type: 'plain_text', text: 'End of day (6:30 PM)' }, value: 'end_of_day' },
                { text: { type: 'plain_text', text: 'Before lunch (2:00 PM)' }, value: 'before_lunch' },
                { text: { type: 'plain_text', text: 'Custom time' }, value: 'custom' }
              ]
            }
          ]
        },
        {
          type: 'input',
          block_id: 'reason',
          label: { type: 'plain_text', text: 'Reason' },
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'reason_input',
            placeholder: { type: 'plain_text', text: 'Add a reason (required)' },
            multiline: true
          }
        }
      ]
    };

    // Open modal with 1-second timeout to ensure it opens before trigger expires
    const modalResponse = await Promise.race([
      fetch('https://slack.com/api/views.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SLACK_BOT_TOKEN')}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          trigger_id: triggerId,
          view: basicModal
        })
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Modal timeout')), 1000)
      )
    ]);

    const modalResult = await modalResponse.json();
    console.log('⚡ Modal opened in:', Date.now() - startTime, 'ms');

    if (!modalResult.ok) {
      console.error('❌ Modal failed:', modalResult.error);
      return await sendEphemeralMessage(payload.response_url, 
        getErrorMessage(modalResult.error));
    }

    console.log('✅ Modal opened successfully!');

    // STEP 2: Update modal with actual data in background (non-blocking)
    updateModalWithData(modalResult.view.id, userId, supabaseClient).catch(error => {
      console.error('Background update failed:', error);
    });

    return new Response(null, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('💥 Critical error:', error);
    
    if (error.message === 'Modal timeout') {
      return await sendEphemeralMessage(payload.response_url, 
        '⏱️ Modal opening timed out. Please try clicking Apply Leave again.');
    }
    
    return await sendEphemeralMessage(payload.response_url, 
      '🚨 An error occurred. Please try clicking Apply Leave again.');
  }
}

// Background function to update modal with real data
async function updateModalWithData(viewId: string, userId: string, supabaseClient: any) {
  try {
    console.log('🔄 Updating modal with real data...');
    
    // Check if user exists
    const { data: slackIntegration, error: integrationError } = await supabaseClient
      .from('user_slack_integrations')
      .select('*')
      .eq('user_id', userId)
      .single();

      if (integrationError || !slackIntegration) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '❌ You need to connect your Timeloo account first. Please visit the web app to link your Slack account.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (actionId === 'apply_leave') {
        // Get all leave types for the modal
        const { data: leaveTypes, error: leaveTypesError } = await supabaseClient
          .from('leave_types')
          .select('*')
          .eq('is_active', true)
          .order('label');

    if (leaveTypesError) {
      console.error('❌ Error fetching leave types:', leaveTypesError);
      return;
    }

    // Filter leave types based on WFH exhaustion logic
    const availableLeaveTypes = await filterLeaveTypes(leaveTypes, balances, userId, supabaseClient);

    const leaveOptions = availableLeaveTypes.map(type => {
      const balance = balances.find(b => b.leave_type === type.label);
      let displayText = '';
      
      if (type.label === 'Paid Leave') {
        const remaining = balance?.remaining_this_month || 0;
        displayText = remaining > 0 ? `🌴 ${type.label} (${remaining} days left)` : `🌴 ${type.label} (Exhausted)`;
      } else if (type.label === 'Work From Home') {
        const remaining = balance?.remaining_this_month || 0;
        displayText = remaining > 0 ? `🏠 ${type.label} (${remaining} days left)` : `🏠 ${type.label} (Exhausted)`;
      } else if (type.label === 'Short Leave') {
        const remaining = balance?.remaining_this_month || 0;
        displayText = remaining > 0 ? `⏰ ${type.label} (${remaining} hours left)` : `⏰ ${type.label} (Exhausted)`;
      } else if (type.label === 'Additional work from home') {
        displayText = `🏠 ${type.label}`;
      }
      
      return {
        text: { type: 'plain_text', text: displayText },
        value: type.id
      };
    });

    // Calculate total remaining for display
    const totalRemaining = balances.reduce((total, balance) => {
      if (balance.leave_type === 'Paid Leave') return total + (balance.remaining_this_month || 0);
      if (balance.leave_type === 'Work From Home') return total + (balance.remaining_this_month || 0);
      if (balance.leave_type === 'Short Leave') return total + ((balance.remaining_this_month || 0) / 8);
      return total;
    }, 0);

    // Create balance display text
    const balanceText = balances.map(balance => {
      if (balance.leave_type === 'Additional work from home') {
        return `• *${balance.leave_type}*: Unlimited days remaining`;
      }
      const unit = balance.duration_type === 'hours' ? 'hours' : 'days';
      return `• *${balance.leave_type}*: ${balance.remaining_this_month || 0} ${unit} remaining`;
    }).join('\n');

    // Update the modal with real data
    const updatedModal = {
      type: 'modal',
      callback_id: 'leave_application_modal',
      title: { type: 'plain_text', text: '🌿 Apply for Leave' },
      submit: { type: 'plain_text', text: 'Apply' },
      close: { type: 'plain_text', text: 'Cancel' },
      private_metadata: userId,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:seedling: You have *${totalRemaining.toFixed(1)} days* remaining in this cycle`
          }
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📊 Your Current Balances:*\n${balanceText}`
          }
        },
        {
          type: 'input',
          block_id: 'leave_type',
          label: { type: 'plain_text', text: 'Leave Type' },
          element: {
            type: 'static_select',
            action_id: 'leave_type_select',
            placeholder: { type: 'plain_text', text: '🍃 Select a leave type' },
            options: leaveOptions
          }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Start Date & Time*' }
        },
        {
          type: 'actions',
          block_id: 'start_datetime',
          elements: [
            {
              type: 'datepicker',
              action_id: 'start_date_picker',
              initial_date: new Date().toISOString().split('T')[0],
              placeholder: { type: 'plain_text', text: 'Today' }
            },
            {
              type: 'static_select',
              action_id: 'start_time_select',
              placeholder: { type: 'plain_text', text: 'Start of day' },
              initial_option: {
                text: { type: 'plain_text', text: 'Start of day (10:00 AM)' },
                value: 'start_of_day'
              },
              options: [
                { text: { type: 'plain_text', text: 'Start of day (10:00 AM)' }, value: 'start_of_day' },
                { text: { type: 'plain_text', text: 'After lunch (2:45 PM)' }, value: 'after_lunch' },
                { text: { type: 'plain_text', text: 'Custom time' }, value: 'custom' }
              ]
            }
          ]
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*End Date & Time*' }
        },
        {
          type: 'actions',
          block_id: 'end_datetime',
          elements: [
            {
              type: 'datepicker',
              action_id: 'end_date_picker',
              initial_date: new Date().toISOString().split('T')[0],
              placeholder: { type: 'plain_text', text: 'Today' }
            },
            {
              type: 'static_select',
              action_id: 'end_time_select',
              placeholder: { type: 'plain_text', text: 'End of day' },
              initial_option: {
                text: { type: 'plain_text', text: 'End of day (6:30 PM)' },
                value: 'end_of_day'
              },
              options: [
                { text: { type: 'plain_text', text: 'End of day (6:30 PM)' }, value: 'end_of_day' },
                { text: { type: 'plain_text', text: 'Before lunch (2:00 PM)' }, value: 'before_lunch' },
                { text: { type: 'plain_text', text: 'Custom time' }, value: 'custom' }
              ]
            }
          ]
        },
        {
          type: 'input',
          block_id: 'reason',
          label: { type: 'plain_text', text: 'Reason' },
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'reason_input',
            placeholder: { type: 'plain_text', text: 'Add a reason (required)' },
            multiline: true
          }
        }
      ]
    };

    // Update the modal
    await fetch('https://slack.com/api/views.update', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SLACK_BOT_TOKEN')}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        view_id: viewId,
        view: updatedModal
      })
    });

    console.log('✅ Modal updated with real data');

  } catch (error) {
    console.error('❌ Failed to update modal:', error);
  }
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'expired_trigger_id':
      return '⏱️ That action has expired. Please click Apply Leave again.';
    case 'invalid_trigger_id':
      return '🔄 Invalid action. Please click Apply Leave again.';
    case 'trigger_exchanged':
      return '🔄 This action was already used. Please click Apply Leave again.';
    default:
      return '❌ Failed to open the leave form. Please try again.';
  }
}

async function filterLeaveTypes(leaveTypes: any[], balances: any[], userId: string, supabaseClient: any) {
  const availableTypes = [];
  
  for (const leaveType of leaveTypes) {
    if (leaveType.label === 'Additional work from home') {
      // Only include Additional WFH if regular WFH is exhausted
      const wfhBalance = balances.find(b => b.leave_type === 'Work From Home');
      const wfhRemaining = wfhBalance?.remaining_this_month || 0;
      
      if (wfhRemaining <= 0) {
        availableTypes.push(leaveType);
      }
    } else {
      // Include all other leave types
      availableTypes.push(leaveType);
    }
  }
  
  return availableTypes;
}

async function getLeaveBalances(userId: string, supabaseClient: any) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  // Get all leave types
  const { data: leaveTypes } = await supabaseClient
    .from('leave_types')
    .select('*')
    .eq('is_active', true);

  if (!leaveTypes) return [];

  const balances = [];
  
  for (const leaveType of leaveTypes) {
    if (leaveType.label === 'Paid Leave') {
      // Get paid leave usage
      const { data: paidLeaves } = await supabaseClient
        .from('leave_applied_users')
        .select('actual_days_used, is_half_day, start_date, end_date')
        .eq('user_id', userId)
        .eq('leave_type_id', leaveType.id)
        .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('start_date', currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
        .in('status', ['approved', 'pending']);

      const totalUsed = paidLeaves?.reduce((total, leave) => {
        if (leave.actual_days_used) return total + leave.actual_days_used;
        if (leave.is_half_day) return total + 0.5;
        const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        return total + daysDiff;
      }, 0) || 0;

      balances.push({
        leave_type: 'Paid Leave',
        duration_type: 'days',
        monthly_allowance: 1.5,
        used_this_month: totalUsed,
        remaining_this_month: Math.max(0, 1.5 - totalUsed)
      });
    } else if (leaveType.label === 'Work From Home') {
      // Get WFH usage
      const { data: wfhLeaves } = await supabaseClient
        .from('leave_applied_users')
        .select('actual_days_used, is_half_day, start_date, end_date')
        .eq('user_id', userId)
        .eq('leave_type_id', leaveType.id)
        .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('start_date', currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
        .in('status', ['approved', 'pending']);

      const totalUsed = wfhLeaves?.reduce((total, leave) => {
        if (leave.actual_days_used) return total + leave.actual_days_used;
        if (leave.is_half_day) return total + 0.5;
        const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        return total + daysDiff;
      }, 0) || 0;

      balances.push({
        leave_type: 'Work From Home',
        duration_type: 'days',
        monthly_allowance: 2,
        used_this_month: totalUsed,
        remaining_this_month: Math.max(0, 2 - totalUsed)
      });
    } else if (leaveType.label === 'Short Leave') {
      // Get short leave usage
      const { data: shortLeaves } = await supabaseClient
        .from('leave_applied_users')
        .select('hours_requested')
        .eq('user_id', userId)
        .eq('leave_type_id', leaveType.id)
        .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('start_date', currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
        .in('status', ['approved', 'pending']);

      const totalUsed = shortLeaves?.reduce((total, leave) => {
        return total + (leave.hours_requested || 1);
      }, 0) || 0;

      balances.push({
        leave_type: 'Short Leave',
        duration_type: 'hours',
        monthly_allowance: 4,
        used_this_month: totalUsed,
        remaining_this_month: Math.max(0, 4 - totalUsed)
      });
    } else if (leaveType.label === 'Additional work from home') {
      // Check if regular WFH is exhausted first
      const wfhBalance = balances.find(b => b.leave_type === 'Work From Home');
      const wfhRemaining = wfhBalance?.remaining_this_month || 0;
      
      if (wfhRemaining <= 0) {
        // Get additional WFH usage
        const { data: additionalWfhLeaves } = await supabaseClient
          .from('leave_applied_users')
          .select('actual_days_used, is_half_day, start_date, end_date')
          .eq('user_id', userId)
          .eq('leave_type_id', leaveType.id)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        const totalUsed = additionalWfhLeaves?.reduce((total, leave) => {
          if (leave.actual_days_used) return total + leave.actual_days_used;
          if (leave.is_half_day) return total + 0.5;
          const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
          return total + daysDiff;
        }, 0) || 0;

        balances.push({
          leave_type: 'Additional work from home',
          duration_type: 'days',
          monthly_allowance: 999, // Unlimited
          used_this_month: totalUsed,
          remaining_this_month: 999 // Unlimited
        });
      }
    }
  }

  return balances;
}

async function handleLeaveSubmission(payload: any, supabaseClient: any) {
  const userId = payload.view.private_metadata;
  const values = payload.view.state.values;
  
  console.log('Form submission data:', {
    leaveTypeId: values.leave_type?.leave_type_select?.selected_option?.value,
    actualStartDate: values.start_datetime?.start_date_picker?.selected_date,
    actualEndDate: values.end_datetime?.end_date_picker?.selected_date,
    startTime: values.start_datetime?.start_time_select?.selected_option?.value,
    endTime: values.end_datetime?.end_time_select?.selected_option?.value,
    reason: values.reason?.reason_input?.value,
    fullValues: JSON.stringify(values)
  });

  // Extract form data
  const formData = {
    leaveTypeId: values.leave_type?.leave_type_select?.selected_option?.value,
    actualStartDate: values.start_datetime?.start_date_picker?.selected_date,
    actualEndDate: values.end_datetime?.end_date_picker?.selected_date,
    startTime: values.start_datetime?.start_time_select?.selected_option?.value,
    endTime: values.end_datetime?.end_time_select?.selected_option?.value,
    reason: values.reason?.reason_input?.value
  };

  // Validate required fields
  if (!formData.leaveTypeId || !formData.actualStartDate || !formData.actualEndDate) {
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          leave_type: !formData.leaveTypeId ? 'Please select a leave type' : undefined,
          start_datetime: !formData.actualStartDate ? 'Please select a start date' : undefined,
          end_datetime: !formData.actualEndDate ? 'Please select an end date' : undefined
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Parse dates
  const startDate = new Date(formData.actualStartDate);
  const endDate = new Date(formData.actualEndDate);

  // Validate date logic
  if (startDate > endDate) {
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          end_datetime: 'End date cannot be before start date'
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Determine if it's a half day
  const isHalfDay = (formData.startTime === 'after_lunch' && formData.endTime === 'end_of_day') ||
                   (formData.startTime === 'start_of_day' && formData.endTime === 'before_lunch');

  // Calculate days - this is crucial for the fix
  let daysDiff;
  if (isHalfDay) {
    daysDiff = 0.5;
  } else {
    daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
  }
  
  // Validate leave balance
  const { data: leaveTypes } = await supabaseClient
    .from('leave_types')
    .select('*')
    .eq('id', formData.leaveTypeId)
    .single();

  if (!leaveTypes) {
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          leave_type: 'Invalid leave type selected'
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Check balance limits with proper half-day handling
  const balanceCheck = await validateLeaveBalance(userId, formData.leaveTypeId, daysDiff, leaveTypes.label, supabaseClient);
  
  if (!balanceCheck.valid) {
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          leave_type: balanceCheck.message
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Set leave times for half day
  let leaveTimeStart = null;
  let leaveTimeEnd = null;
  
  if (isHalfDay) {
    if (formData.startTime === 'start_of_day' && formData.endTime === 'before_lunch') {
      leaveTimeStart = '10:00:00';
      leaveTimeEnd = '14:00:00';
    } else if (formData.startTime === 'after_lunch' && formData.endTime === 'end_of_day') {
      leaveTimeStart = '14:45:00';
      leaveTimeEnd = '18:30:00';
    }
  }

  // Insert leave application
  const { data: leaveApplication, error: insertError } = await supabaseClient
    .from('leave_applied_users')
    .insert({
      user_id: userId,
      leave_type_id: formData.leaveTypeId,
      start_date: formData.actualStartDate,
      end_date: formData.actualEndDate,
      reason: formData.reason || 'Applied via Slack for ' + leaveTypes.label,
      status: 'pending',
      is_half_day: isHalfDay,
      actual_days_used: daysDiff,
      hours_requested: leaveTypes.label === 'Short Leave' ? (isHalfDay ? 4 : 8) : 0,
      leave_time_start: leaveTimeStart,
      leave_time_end: leaveTimeEnd
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error inserting leave application:', insertError);
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          leave_type: 'Failed to submit leave application. Please try again.'
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Success response
  return new Response(
    JSON.stringify({
      response_action: 'update',
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: '✅ Leave Applied!' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎉 *Your leave application has been submitted successfully!*\n\n*Details:*\n• **Type:** ${leaveTypes.label}\n• **Dates:** ${formData.actualStartDate} to ${formData.actualEndDate}${isHalfDay ? ' (Half Day)' : ''}\n• **Status:** Pending Approval\n\nYou'll receive a notification once your leave is reviewed.`
            }
          }
        ]
      }
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

async function validateLeaveBalance(userId: string, leaveTypeId: string, requestedDays: number, leaveTypeLabel: string, supabaseClient: any) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  let monthlyLimit = 0;
  let unit = 'days';
  
  // Set monthly limits based on leave type
  switch (leaveTypeLabel) {
    case 'Paid Leave':
      monthlyLimit = 1.5;
      unit = 'days';
      break;
    case 'Work From Home':
      monthlyLimit = 2;
      unit = 'days';
      break;
    case 'Short Leave':
      monthlyLimit = 4;
      unit = 'hours';
      break;
    case 'Additional work from home':
      // For Additional WFH, first check if regular WFH is exhausted
      const { data: wfhLeaveType } = await supabaseClient
        .from('leave_types')
        .select('id')
        .eq('label', 'Work From Home')
        .single();
      
      if (wfhLeaveType) {
        const { data: wfhLeaves } = await supabaseClient
          .from('leave_applied_users')
          .select('actual_days_used, is_half_day, start_date, end_date')
          .eq('user_id', userId)
          .eq('leave_type_id', wfhLeaveType.id)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);
        
        const wfhUsed = wfhLeaves?.reduce((total, leave) => {
          if (leave.actual_days_used) return total + leave.actual_days_used;
          if (leave.is_half_day) return total + 0.5;
          const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
          return total + daysDiff;
        }, 0) || 0;
        
        const wfhRemaining = Math.max(0, 2 - wfhUsed);
        
        if (wfhRemaining > 0) {
          return { 
            valid: false, 
            message: `You must exhaust your regular Work From Home quota first. You have ${wfhRemaining} days remaining.` 
          };
        }
      }
      
      // If WFH is exhausted, Additional WFH is unlimited
      return { valid: true, message: '' };
    default:
      return { valid: false, message: 'Invalid leave type' };
  }
  
  // Get current usage for this month
  const { data: currentLeaves } = await supabaseClient
    .from('leave_applied_users')
    .select('actual_days_used, is_half_day, start_date, end_date, hours_requested')
    .eq('user_id', userId)
    .eq('leave_type_id', leaveTypeId)
    .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
    .lt('start_date', currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
    .in('status', ['approved', 'pending']);

  let totalUsed = 0;
  
  if (leaveTypeLabel === 'Short Leave') {
    // For short leave, sum hours
    totalUsed = currentLeaves?.reduce((total, leave) => {
      return total + (leave.hours_requested || 1);
    }, 0) || 0;
  } else {
    // For other leave types, sum days
    totalUsed = currentLeaves?.reduce((total, leave) => {
      if (leave.actual_days_used) return total + leave.actual_days_used;
      if (leave.is_half_day) return total + 0.5;
      const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
      return total + daysDiff;
    }, 0) || 0;
  }

  const remaining = monthlyLimit - totalUsed;
  
  // This is the key fix - allow proper decimal validation for half-day leaves
  if (requestedDays > remaining) {
    return { 
      valid: false, 
      message: `${leaveTypeLabel} limit exceeded. You have ${remaining} ${unit} remaining this month (requested: ${requestedDays} ${unit}).` 
    };
  }

  return { valid: true, message: '' };
}
