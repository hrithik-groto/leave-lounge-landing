
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SLACK INTERACTION REQUEST START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    console.log('Body available:', req.body !== null);

    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return new Response('Invalid content type', { status: 400, headers: corsHeaders });
    }

    const formData = await req.formData();
    console.log('✅ Successfully parsed FormData for interactions');

    const entries = Array.from(formData.entries());
    console.log('📋 All FormData entries:', entries);

    const payload = formData.get('payload');
    if (!payload) {
      return new Response('No payload found', { status: 400, headers: corsHeaders });
    }

    const data = JSON.parse(payload as string);
    console.log('✅ Successfully parsed payload');
    console.log('📝 Payload type:', data.type);
    console.log('📝 Payload data:', JSON.stringify(data, null, 2));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different interaction types
    if (data.type === 'block_actions') {
      const action = data.actions[0];
      console.log('Processing action:', action.action_id, 'for user:', data.user?.id);
      console.log('Received Slack interaction:', data.type, action.action_id);
      
      if (action.action_id === 'apply_leave') {
        return await handleApplyLeave(data, supabaseClient);
      }
      
      // Handle other actions with acknowledgment
      console.log('Unknown action received:', action.action_id);
      return new Response('', { status: 200, headers: corsHeaders });
    }

    if (data.type === 'view_submission') {
      console.log('Received Slack interaction:', data.type);
      return await handleLeaveSubmission(data, supabaseClient);
    }

    return new Response('Unknown interaction type', { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Error processing Slack interaction:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});

async function handleApplyLeave(data: any, supabaseClient: any) {
  try {
    // Get user from Slack integration
    const { data: integration, error: integrationError } = await supabaseClient
      .from('user_slack_integrations')
      .select('user_id')
      .eq('slack_user_id', data.user.id)
      .eq('slack_team_id', data.team.id)
      .single();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ User not found. Please link your Slack account first.'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get leave types
    const { data: leaveTypes, error: leaveTypesError } = await supabaseClient
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('label');

    if (leaveTypesError) {
      console.error('Error fetching leave types:', leaveTypesError);
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Error loading leave types. Please try again.'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate balances for each leave type
    const balances = await calculateLeaveBalances(integration.user_id, leaveTypes, supabaseClient);

    // Create modal with balance information
    const modal = {
      type: 'modal',
      callback_id: 'leave_application_modal',
      title: {
        type: 'plain_text',
        text: '🌿 Apply for Leave',
        emoji: true
      },
      submit: {
        type: 'plain_text',
        text: 'Apply',
        emoji: true
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true
      },
      private_metadata: integration.user_id,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🌱 You have *${balances.totalRemaining} days* remaining in this cycle`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'input',
          block_id: 'leave_type',
          label: {
            type: 'plain_text',
            text: 'Leave Type',
            emoji: true
          },
          element: {
            type: 'static_select',
            action_id: 'leave_type_select',
            placeholder: {
              type: 'plain_text',
              text: '🍃 Select a leave type',
              emoji: true
            },
            options: await createLeaveTypeOptions(leaveTypes, balances, supabaseClient)
          }
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
              initial_date: new Date().toISOString().split('T')[0],
              placeholder: {
                type: 'plain_text',
                text: 'Today',
                emoji: true
              }
            },
            {
              type: 'static_select',
              action_id: 'start_time_select',
              placeholder: {
                type: 'plain_text',
                text: 'Start of day',
                emoji: true
              },
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: 'Start of day (10:00 AM)',
                  emoji: true
                },
                value: 'start_of_day'
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'Start of day (10:00 AM)',
                    emoji: true
                  },
                  value: 'start_of_day'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'After lunch (2:45 PM)',
                    emoji: true
                  },
                  value: 'after_lunch'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Custom time',
                    emoji: true
                  },
                  value: 'custom'
                }
              ]
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
              initial_date: new Date().toISOString().split('T')[0],
              placeholder: {
                type: 'plain_text',
                text: 'Today',
                emoji: true
              }
            },
            {
              type: 'static_select',
              action_id: 'end_time_select',
              placeholder: {
                type: 'plain_text',
                text: 'End of day',
                emoji: true
              },
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: 'End of day (6:30 PM)',
                  emoji: true
                },
                value: 'end_of_day'
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'End of day (6:30 PM)',
                    emoji: true
                  },
                  value: 'end_of_day'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Before lunch (2:00 PM)',
                    emoji: true
                  },
                  value: 'before_lunch'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Custom time',
                    emoji: true
                  },
                  value: 'custom'
                }
              ]
            }
          ]
        },
        {
          type: 'input',
          block_id: 'reason',
          label: {
            type: 'plain_text',
            text: 'Reason',
            emoji: true
          },
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'reason_input',
            placeholder: {
              type: 'plain_text',
              text: 'Add a reason (required)',
              emoji: true
            },
            multiline: true,
            dispatch_action_config: {
              trigger_actions_on: ['on_enter_pressed']
            }
          }
        }
      ]
    };

    // Add balance information to modal
    if (balances.details && balances.details.length > 0) {
      const balanceText = balances.details.map((detail: any) => 
        `• *${detail.leave_type}*: ${detail.remaining} ${detail.unit} remaining`
      ).join('\n');
      
      modal.blocks.splice(2, 0, {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📊 Your Current Balances:*\n${balanceText}`
        }
      });
    }

    // Open modal
    const slackResponse = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SLACK_BOT_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger_id: data.trigger_id,
        view: modal
      })
    });

    const slackResult = await slackResponse.json();
    console.log('Modal API response:', JSON.stringify(slackResult, null, 2));

    if (!slackResult.ok) {
      console.error('Error opening modal:', slackResult.error);
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Error opening leave application form. Please try again.'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error in handleApplyLeave:', error);
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: '❌ Error processing leave application. Please try again.'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function calculateLeaveBalances(userId: string, leaveTypes: any[], supabaseClient: any) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const monthEnd = currentMonth === 12 
    ? `${currentYear + 1}-01-01` 
    : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;

  const balances = {
    totalRemaining: 0,
    details: []
  };

  // Get all leave applications for this month
  const { data: leaves, error: leavesError } = await supabaseClient
    .from('leave_applied_users')
    .select('leave_type_id, actual_days_used, is_half_day, start_date, end_date, hours_requested, status')
    .eq('user_id', userId)
    .gte('start_date', monthStart)
    .lt('start_date', monthEnd)
    .in('status', ['approved', 'pending']);

  if (leavesError) {
    console.error('Error fetching leaves:', leavesError);
    return balances;
  }

  // Group leaves by type
  const leavesByType = {};
  leaves?.forEach(leave => {
    if (!leavesByType[leave.leave_type_id]) {
      leavesByType[leave.leave_type_id] = [];
    }
    leavesByType[leave.leave_type_id].push(leave);
  });

  // Calculate balances for each leave type
  for (const leaveType of leaveTypes) {
    const typeLeaves = leavesByType[leaveType.id] || [];
    let used = 0;
    let allowance = 0;
    let unit = 'days';

    if (leaveType.label === 'Paid Leave') {
      allowance = 1.5;
      used = typeLeaves.reduce((total, leave) => {
        if (leave.actual_days_used) return total + leave.actual_days_used;
        if (leave.is_half_day) return total + 0.5;
        const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        return total + daysDiff;
      }, 0);
    } else if (leaveType.label === 'Work From Home') {
      allowance = 2;
      used = typeLeaves.reduce((total, leave) => {
        if (leave.actual_days_used) return total + leave.actual_days_used;
        if (leave.is_half_day) return total + 0.5;
        const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        return total + daysDiff;
      }, 0);
    } else if (leaveType.label === 'Short Leave') {
      allowance = 4;
      unit = 'hours';
      used = typeLeaves.reduce((total, leave) => {
        return total + (leave.hours_requested || 1);
      }, 0);
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
        if (wfhRemaining > 0) {
          // Don't include Additional WFH if regular WFH is still available
          continue;
        }
      }
      allowance = 999; // Unlimited
      used = typeLeaves.reduce((total, leave) => {
        if (leave.actual_days_used) return total + leave.actual_days_used;
        if (leave.is_half_day) return total + 0.5;
        const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        return total + daysDiff;
      }, 0);
    }

    const remaining = Math.max(0, allowance - used);
    
    if (leaveType.label !== 'Additional work from home' || allowance === 999) {
      balances.details.push({
        leave_type: leaveType.label,
        remaining: remaining === 999 ? 'Unlimited' : remaining,
        used: used,
        allowance: allowance,
        unit: unit,
        id: leaveType.id
      });

      if (unit === 'days' && remaining !== 999) {
        balances.totalRemaining += remaining;
      }
    }
  }

  return balances;
}

async function createLeaveTypeOptions(leaveTypes: any[], balances: any, supabaseClient: any) {
  const options = [];
  
  for (const leaveType of leaveTypes) {
    const balance = balances.details.find(b => b.id === leaveType.id);
    
    if (!balance) {
      // Skip if no balance info (like Additional WFH when regular WFH is available)
      continue;
    }

    let emoji = '🌿';
    if (leaveType.label.includes('Work From Home') || leaveType.label.includes('work from home')) {
      emoji = '🏠';
    } else if (leaveType.label.includes('Short')) {
      emoji = '⏰';
    } else if (leaveType.label.includes('Paid')) {
      emoji = '🌴';
    }

    let optionText = `${emoji} ${leaveType.label}`;
    if (balance.remaining === 0) {
      optionText += ' (Exhausted)';
    } else if (balance.remaining !== 'Unlimited') {
      optionText += ` (${balance.remaining} ${balance.unit} left)`;
    }

    options.push({
      text: {
        type: 'plain_text',
        text: optionText,
        emoji: true
      },
      value: leaveType.id
    });
  }

  return options;
}

async function handleLeaveSubmission(data: any, supabaseClient: any) {
  try {
    const userId = data.view.private_metadata;
    const values = data.view.state.values;
    
    // Extract form data
    const formData = {
      leaveTypeId: values.leave_type?.leave_type_select?.selected_option?.value,
      actualStartDate: values.start_datetime?.start_date_picker?.selected_date,
      actualEndDate: values.end_datetime?.end_date_picker?.selected_date,
      startTime: values.start_datetime?.start_time_select?.selected_option?.value || 'start_of_day',
      endTime: values.end_datetime?.end_time_select?.selected_option?.value || 'end_of_day',
      reason: values.reason?.reason_input?.value || '',
      fullValues: JSON.stringify(values)
    };

    console.log('Form submission data:', formData);

    if (!formData.leaveTypeId || !formData.actualStartDate || !formData.actualEndDate) {
      return new Response(JSON.stringify({
        response_type: 'errors',
        errors: {
          leave_type: 'Please select a leave type',
          start_datetime: 'Please select start date',
          end_datetime: 'Please select end date'
        }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate dates
    const startDate = new Date(formData.actualStartDate);
    const endDate = new Date(formData.actualEndDate);
    
    if (startDate > endDate) {
      return new Response(JSON.stringify({
        response_type: 'errors',
        errors: {
          end_datetime: 'End date cannot be before start date'
        }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({
        response_type: 'errors',
        errors: {
          leave_type: 'Invalid leave type selected'
        }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check balance limits with proper half-day handling
    const balanceCheck = await validateLeaveBalance(userId, formData.leaveTypeId, daysDiff, leaveTypes.label, supabaseClient);
    
    if (!balanceCheck.valid) {
      return new Response(JSON.stringify({
        response_type: 'errors',
        errors: {
          leave_type: balanceCheck.message
        }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    // Submit leave application
    const leaveApplication = {
      user_id: userId,
      start_date: formData.actualStartDate,
      end_date: formData.actualEndDate,
      leave_type_id: formData.leaveTypeId,
      reason: formData.reason || 'Applied via Slack for ' + leaveTypes.label,
      status: 'pending',
      is_half_day: isHalfDay,
      actual_days_used: daysDiff,
      hours_requested: leaveTypes.label === 'Short Leave' ? (isHalfDay ? 4 : 8) : 0,
      leave_time_start: leaveTimeStart,
      leave_time_end: leaveTimeEnd
    };

    console.log('Submitting leave application:', leaveApplication);

    const { data: submittedLeave, error: submitError } = await supabaseClient
      .from('leave_applied_users')
      .insert(leaveApplication)
      .select()
      .single();

    if (submitError) {
      console.error('Error submitting leave:', submitError);
      return new Response(JSON.stringify({
        response_type: 'errors',
        errors: {
          leave_type: 'Failed to submit leave application. Please try again.'
        }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Success response
    return new Response('', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error in handleLeaveSubmission:', error);
    return new Response(JSON.stringify({
      response_type: 'errors',
      errors: {
        leave_type: 'An error occurred while processing your request. Please try again.'
      }
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function validateLeaveBalance(userId: string, leaveTypeId: string, requestedDays: number, leaveTypeLabel: string, supabaseClient: any) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const monthEnd = currentMonth === 12 
    ? `${currentYear + 1}-01-01` 
    : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;

  // Get current month usage
  const { data: currentUsage, error: usageError } = await supabaseClient
    .from('leave_applied_users')
    .select('actual_days_used, is_half_day, start_date, end_date, hours_requested')
    .eq('user_id', userId)
    .eq('leave_type_id', leaveTypeId)
    .gte('start_date', monthStart)
    .lt('start_date', monthEnd)
    .in('status', ['approved', 'pending']);

  if (usageError) {
    console.error('Error fetching usage:', usageError);
    return { valid: false, message: 'Error checking leave balance' };
  }

  let totalUsed = 0;
  let monthlyLimit = 0;

  if (leaveTypeLabel === 'Paid Leave') {
    monthlyLimit = 1.5;
    totalUsed = currentUsage?.reduce((total, leave) => {
      if (leave.actual_days_used) return total + leave.actual_days_used;
      if (leave.is_half_day) return total + 0.5;
      const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
      return total + daysDiff;
    }, 0) || 0;
  } else if (leaveTypeLabel === 'Work From Home') {
    monthlyLimit = 2;
    totalUsed = currentUsage?.reduce((total, leave) => {
      if (leave.actual_days_used) return total + leave.actual_days_used;
      if (leave.is_half_day) return total + 0.5;
      const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
      return total + daysDiff;
    }, 0) || 0;
  } else if (leaveTypeLabel === 'Short Leave') {
    monthlyLimit = 4; // hours
    totalUsed = currentUsage?.reduce((total, leave) => {
      return total + (leave.hours_requested || 1);
    }, 0) || 0;
    
    if (totalUsed + requestedDays > monthlyLimit) {
      return { 
        valid: false, 
        message: `Short leave limit exceeded. You have ${monthlyLimit - totalUsed} hours remaining this month.` 
      };
    }
    return { valid: true };
  } else if (leaveTypeLabel === 'Additional work from home') {
    // Check if regular WFH is exhausted first
    const { data: wfhLeaveType } = await supabaseClient
      .from('leave_types')
      .select('id')
      .eq('label', 'Work From Home')
      .single();

    if (wfhLeaveType) {
      const { data: wfhUsage } = await supabaseClient
        .from('leave_applied_users')
        .select('actual_days_used, is_half_day, start_date, end_date')
        .eq('user_id', userId)
        .eq('leave_type_id', wfhLeaveType.id)
        .gte('start_date', monthStart)
        .lt('start_date', monthEnd)
        .in('status', ['approved', 'pending']);

      const wfhUsed = wfhUsage?.reduce((total, leave) => {
        if (leave.actual_days_used) return total + leave.actual_days_used;
        if (leave.is_half_day) return total + 0.5;
        const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        return total + daysDiff;
      }, 0) || 0;

      const wfhRemaining = Math.max(0, 2 - wfhUsed);
      
      if (wfhRemaining > 0) {
        return { 
          valid: false, 
          message: `Please use your regular Work From Home quota first. You have ${wfhRemaining} days remaining.` 
        };
      }
    }
    
    // Additional WFH is unlimited once regular WFH is exhausted
    return { valid: true };
  }

  const remaining = monthlyLimit - totalUsed;
  
  // This is the key fix - allow proper decimal validation for half-day leaves
  if (requestedDays > remaining) {
    return { 
      valid: false, 
      message: `${leaveTypeLabel} limit exceeded. You have ${remaining} days remaining this month (requested: ${requestedDays} days).` 
    };
  }

  return { valid: true };
}
