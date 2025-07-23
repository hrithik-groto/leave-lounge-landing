
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);

    let formData;
    try {
      console.log('Body available:', req.body ? 'Yes' : 'No');
      formData = await req.formData();
      console.log('✅ Successfully parsed FormData for interactions');
    } catch (parseError) {
      console.error('❌ Failed to parse FormData:', parseError);
      return new Response('Invalid form data', { status: 400, headers: corsHeaders });
    }

    const payloadString = formData.get('payload') as string;
    console.log('📋 All FormData entries:', Array.from(formData.entries()));

    if (!payloadString) {
      console.error('❌ No payload found in FormData');
      return new Response('No payload found', { status: 400, headers: corsHeaders });
    }

    let payload;
    try {
      payload = JSON.parse(payloadString);
      console.log('✅ Successfully parsed payload');
      console.log('📝 Payload type:', payload.type);
    } catch (parseError) {
      console.error('❌ Failed to parse payload JSON:', parseError);
      return new Response('Invalid payload JSON', { status: 400, headers: corsHeaders });
    }

    console.log('📝 Payload data:', JSON.stringify(payload, null, 2));

    // Handle block actions (button clicks)
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const actionId = action.action_id;
      const userId = action.value;

      console.log('Received Slack interaction:', payload.type, actionId);
      console.log('Processing action:', actionId, 'for user:', userId);

      // Find the user in our database
      const { data: slackIntegration, error: integrationError } = await supabaseClient
        .from('user_slack_integrations')
        .select('user_id')
        .eq('slack_user_id', payload.user.id)
        .eq('slack_team_id', payload.team.id)
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
          console.error('Error fetching leave types:', leaveTypesError);
          return new Response(
            JSON.stringify({
              response_type: 'ephemeral',
              text: '❌ Error loading leave types. Please try again.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check current leave balances for display
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        // Get Paid Leave balance for the header
        const { data: paidLeaveType } = await supabaseClient
          .from('leave_types')
          .select('id')
          .eq('label', 'Paid Leave')
          .single();

        let remainingBalance = 0;
        if (paidLeaveType) {
          const { data: balanceData, error: balanceError } = await supabaseClient
            .rpc('get_monthly_leave_balance', {
              p_user_id: slackIntegration.user_id,
              p_leave_type_id: paidLeaveType.id,
              p_month: currentMonth,
              p_year: currentYear
            });

          if (!balanceError && balanceData) {
            remainingBalance = balanceData.remaining_this_month || 0;
          }
        }

        // Create modal with leave balance info
        const modal = {
          type: 'modal',
          callback_id: 'leave_application_modal',
          title: {
            type: 'plain_text',
            text: ':herb: Apply for Leave',
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
          private_metadata: slackIntegration.user_id,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:seedling: You have *${remainingBalance} days* remaining in this cycle`
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
                  text: ':leaves: Select a leave type',
                  emoji: true
                },
                options: leaveTypes?.map(type => ({
                  text: {
                    type: 'plain_text',
                    text: `${getEmojiForLeaveType(type.label)} ${type.label}`,
                    emoji: true
                  },
                  value: type.id
                })) || []
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
              element: {
                type: 'plain_text_input',
                action_id: 'reason_input',
                placeholder: {
                  type: 'plain_text',
                  text: 'Add a reason (required)',
                  emoji: true
                },
                multiline: true
              },
              optional: true
            }
          ]
        };

        // Open the modal
        const botToken = Deno.env.get('SLACK_BOT_TOKEN');
        console.log('Bot token available:', botToken ? 'Yes' : 'No');
        console.log('Bot token preview:', botToken ? `${botToken.substring(0, 10)}...` : 'N/A');
        console.log('Opening modal with trigger_id:', payload.trigger_id);

        // Test the token first
        const testResponse = await fetch('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json'
          }
        });

        const testResult = await testResponse.json();
        console.log('Token test response:', JSON.stringify(testResult, null, 2));

        const modalResponse = await fetch('https://slack.com/api/views.open', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trigger_id: payload.trigger_id,
            view: modal
          })
        });

        const modalResult = await modalResponse.json();
        console.log('Modal opened successfully');
        console.log('Modal API response:', JSON.stringify(modalResult, null, 2));

        return new Response('', { status: 200, headers: corsHeaders });
      }

      // Handle other actions
      console.log('Unknown action received:', actionId);
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Unknown action. Please try again.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle modal submissions
    if (payload.type === 'view_submission') {
      console.log('Received Slack interaction:', payload.type, '');
      
      const values = payload.view.state.values;
      const userId = payload.view.private_metadata;

      // Extract form data
      const leaveTypeId = values.leave_type?.leave_type_select?.selected_option?.value;
      const startDate = values.start_datetime?.start_date_picker?.selected_date;
      const endDate = values.end_datetime?.end_date_picker?.selected_date;
      const startTime = values.start_datetime?.start_time_select?.selected_option?.value || 'start_of_day';
      const endTime = values.end_datetime?.end_time_select?.selected_option?.value || 'end_of_day';
      const reason = values.reason?.reason_input?.value || '';

      const formData = {
        leaveTypeId,
        actualStartDate: startDate,
        actualEndDate: endDate,
        startTime,
        endTime,
        reason,
        fullValues: JSON.stringify(values)
      };

      console.log('Form submission data:', JSON.stringify(formData, null, 2));

      // Validate required fields
      if (!leaveTypeId || !startDate || !endDate) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '❌ Please fill in all required fields (Leave Type, Start Date, End Date).',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get leave type details
      const { data: leaveType, error: leaveTypeError } = await supabaseClient
        .from('leave_types')
        .select('*')
        .eq('id', leaveTypeId)
        .single();

      if (leaveTypeError || !leaveType) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '❌ Invalid leave type selected.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate days for the request
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24)) + 1;

      // Check leave balance based on leave type
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      let hasEnoughBalance = false;
      let balanceMessage = '';

      if (leaveType.label === 'Paid Leave') {
        const { data: balanceData, error: balanceError } = await supabaseClient
          .rpc('get_monthly_leave_balance', {
            p_user_id: userId,
            p_leave_type_id: leaveTypeId,
            p_month: currentMonth,
            p_year: currentYear
          });

        if (balanceError) {
          console.error('Error checking Paid Leave balance:', balanceError);
          balanceMessage = '❌ Error checking leave balance. Please try again.';
        } else {
          const remainingBalance = balanceData?.remaining_this_month || 0;
          hasEnoughBalance = remainingBalance >= daysDiff;
          
          if (!hasEnoughBalance) {
            balanceMessage = `❌ Insufficient Paid Leave balance. You have ${remainingBalance} days remaining this month, but requested ${daysDiff} days.`;
          }
        }
      } else if (leaveType.label === 'Work From Home') {
        // Check WFH balance (2 days per month)
        const { data: wfhLeaves, error: wfhError } = await supabaseClient
          .from('leave_applied_users')
          .select('actual_days_used, is_half_day, start_date, end_date')
          .eq('user_id', userId)
          .eq('leave_type_id', leaveTypeId)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        if (wfhError) {
          console.error('Error checking WFH balance:', wfhError);
          balanceMessage = '❌ Error checking Work From Home balance. Please try again.';
        } else {
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

          const remainingBalance = Math.max(0, 2 - totalUsed);
          hasEnoughBalance = remainingBalance >= daysDiff;
          
          if (!hasEnoughBalance) {
            balanceMessage = `❌ Insufficient Work From Home balance. You have ${remainingBalance} days remaining this month, but requested ${daysDiff} days.`;
          }
        }
      } else if (leaveType.label === 'Short Leave') {
        // Check Short Leave balance (4 hours per month)
        const { data: shortLeaves, error: shortError } = await supabaseClient
          .from('leave_applied_users')
          .select('hours_requested')
          .eq('user_id', userId)
          .eq('leave_type_id', leaveTypeId)
          .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('start_date', currentMonth === 12 
            ? `${currentYear + 1}-01-01` 
            : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
          .in('status', ['approved', 'pending']);

        if (shortError) {
          console.error('Error checking Short Leave balance:', shortError);
          balanceMessage = '❌ Error checking Short Leave balance. Please try again.';
        } else {
          const totalUsed = shortLeaves?.reduce((total, leave) => total + (leave.hours_requested || 1), 0) || 0;
          const remainingBalance = Math.max(0, 4 - totalUsed);
          
          // For short leave, assume 1 day = 8 hours
          const hoursRequested = daysDiff * 8;
          hasEnoughBalance = remainingBalance >= hoursRequested;
          
          if (!hasEnoughBalance) {
            balanceMessage = `❌ Insufficient Short Leave balance. You have ${remainingBalance} hours remaining this month, but requested ${hoursRequested} hours.`;
          }
        }
      } else if (leaveType.label === 'Additional work from home') {
        // Check if regular WFH is exhausted first
        const { data: wfhLeaveType } = await supabaseClient
          .from('leave_types')
          .select('id')
          .eq('label', 'Work From Home')
          .single();

        if (wfhLeaveType) {
          const { data: wfhLeaves, error: wfhError } = await supabaseClient
            .from('leave_applied_users')
            .select('actual_days_used, is_half_day, start_date, end_date')
            .eq('user_id', userId)
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
            hasEnoughBalance = wfhRemaining <= 0; // Can only use additional WFH if regular WFH is exhausted
            
            if (!hasEnoughBalance) {
              balanceMessage = `❌ Additional Work From Home is only available when your regular Work From Home quota is exhausted. You still have ${wfhRemaining} days of regular WFH remaining.`;
            }
          }
        }
      } else {
        // For other leave types, allow application (assuming they have balance)
        hasEnoughBalance = true;
      }

      // If balance check failed, return error message
      if (!hasEnoughBalance && balanceMessage) {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: balanceMessage,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If balance is sufficient, proceed with leave application
      const submissionData = {
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        leave_type_id: leaveTypeId,
        reason: reason || `Applied via Slack for ${leaveType.label}`,
        status: 'pending',
        is_half_day: (startTime === 'after_lunch' || endTime === 'before_lunch') && startDate === endDate,
        actual_days_used: daysDiff,
        hours_requested: leaveType.label === 'Short Leave' ? daysDiff * 8 : 0
      };

      console.log('Submitting leave application:', submissionData);

      const { data: leaveApplication, error: submitError } = await supabaseClient
        .from('leave_applied_users')
        .insert(submissionData)
        .select()
        .single();

      if (submitError) {
        console.error('Error submitting leave application:', submitError);
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '❌ Failed to submit leave application. Please try again or contact support.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success response
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `✅ Leave application submitted successfully!\n\n*Leave Type:* ${leaveType.label}\n*Duration:* ${startDate} to ${endDate}\n*Days:* ${daysDiff}\n*Status:* Pending approval\n\nYou'll receive a notification once it's reviewed.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle other interaction types
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Unknown interaction type.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in slack-interactions function:', error);
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

function getEmojiForLeaveType(label: string): string {
  switch (label) {
    case 'Paid Leave':
      return '🌴';
    case 'Work From Home':
      return '🏠';
    case 'Short Leave':
      return '⏰';
    case 'Additional work from home':
      return '🏠';
    default:
      return '📅';
  }
}
