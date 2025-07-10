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
    
    console.log('Received Slack interaction:', payload.type, payload.type === 'block_actions' ? payload.actions[0]?.action_id : payload.view?.callback_id);

    // Handle button actions from the main modal
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const botToken = Deno.env.get('SLACK_BOT_TOKEN');
      
      if (action.action_id === 'apply_leave') {
        // Get leave types for the application modal
        const { data: leaveTypes } = await supabaseClient
          .from('leave_types')
          .select('id, label, color')
          .eq('is_active', true);

        // Create the leave application modal
        const leaveModal = {
          type: 'modal',
          callback_id: 'leave_application_modal',
          title: {
            type: 'plain_text',
            text: '🏖️ Apply for Leave'
          },
          submit: {
            type: 'plain_text',
            text: 'Submit'
          },
          close: {
            type: 'plain_text',
            text: 'Cancel'
          },
          private_metadata: JSON.stringify({
            user_id: payload.user.id,
            team_id: payload.team.id
          }),
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '✨ *Fill out your leave details below*'
              }
            },
            {
              type: 'input',
              block_id: 'leave_type',
              element: {
                type: 'static_select',
                action_id: 'leave_type_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select leave type'
                },
                options: (leaveTypes || []).map(type => ({
                  text: {
                    type: 'plain_text',
                    text: type.label
                  },
                  value: type.id
                }))
              },
              label: {
                type: 'plain_text',
                text: 'Leave Type'
              }
            },
            {
              type: 'input',
              block_id: 'start_date',
              element: {
                type: 'datepicker',
                action_id: 'start_date_picker',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select start date'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Start Date'
              }
            },
            {
              type: 'input',
              block_id: 'end_date',
              element: {
                type: 'datepicker',
                action_id: 'end_date_picker',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select end date'
                }
              },
              label: {
                type: 'plain_text',
                text: 'End Date'
              }
            },
            {
              type: 'input',
              block_id: 'time_of_day',
              element: {
                type: 'radio_buttons',
                action_id: 'time_radio',
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: 'Full day'
                    },
                    value: 'full_day'
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: 'Half day (Morning)'
                    },
                    value: 'half_morning'
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: 'Half day (Afternoon)'
                    },
                    value: 'half_afternoon'
                  }
                ],
                initial_option: {
                  text: {
                    type: 'plain_text',
                    text: 'Full day'
                  },
                  value: 'full_day'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Time of day'
              }
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
                  text: 'Enter reason for leave (optional)'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Reason'
              },
              optional: true
            }
          ]
        };

        // Push the new modal
        const modalResponse = await fetch('https://slack.com/api/views.push', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trigger_id: payload.trigger_id,
            view: leaveModal
          })
        });

        if (!modalResponse.ok) {
          console.error('Error pushing modal:', await modalResponse.text());
        }

        return new Response('', { status: 200 });
      }

      // Handle other button actions with more comprehensive responses
      const actionResponses = {
        'review_requests': '📋 Admin: You can review all pending leave requests here.',
        'team_overview': '👥 Admin: Team leave overview will be displayed here.',
        'view_cancel': '📅 Your upcoming leaves and cancellation options will be shown here.',
        'check_balance': '📊 Your current leave balance and usage will be displayed here.',
        'teammates_on_leave': '👥 Your teammates currently on leave will be listed here.',
        'see_policy': '📋 Complete leave policy information will be shown here.',
        'see_holidays': '🎉 Upcoming company holidays will be displayed here.',
        'clear_pending': '✅ Clear all your pending leave requests feature coming soon.',
        'view_more': '⭐ More Timeloo features and options will be available here.',
        'talk_to_us': '💬 Contact support and feedback options coming soon.'
      };

      const responseText = actionResponses[action.action_id] || 'Feature coming soon! 🚀';
      
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: responseText
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle leave application form submission
    if (payload.type === 'view_submission' && payload.view.callback_id === 'leave_application_modal') {
      // Extract form data
      const values = payload.view.state.values;
      const metadata = JSON.parse(payload.view.private_metadata);
      
      // Find the user in our database based on Slack user ID
      const { data: slackIntegration, error: integrationError } = await supabaseClient
        .from('user_slack_integrations')
        .select('user_id')
        .eq('slack_user_id', metadata.user_id)
        .eq('slack_team_id', metadata.team_id)
        .single();

      if (integrationError || !slackIntegration) {
        return new Response(
          JSON.stringify({
            response_action: 'errors',
            errors: {
              leave_type: 'User not found. Please ensure your Slack account is connected to Timeloo.',
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const userId = slackIntegration.user_id;
      const leaveTypeId = values.leave_type.leave_type_select.selected_option?.value;
      const startDate = values.start_date.start_date_picker.selected_date;
      const endDate = values.end_date.end_date_picker.selected_date;
      const timeOfDay = values.time_of_day.time_radio.selected_option?.value || 'full_day';
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

      // Create leave application with half-day support
      const isHalfDay = timeOfDay !== 'full_day';
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
          is_half_day: isHalfDay,
          leave_time_start: timeOfDay === 'half_morning' ? '09:00' : timeOfDay === 'half_afternoon' ? '13:00' : null,
          leave_time_end: timeOfDay === 'half_morning' ? '13:00' : timeOfDay === 'half_afternoon' ? '17:00' : null,
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