
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
    console.log('=== SLACK INTERACTION REQUEST START ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const payload = JSON.parse(formData.get('payload') as string);
    
    console.log('📝 Payload type:', payload.type);
    
    // Use the latest bot token
    const botToken = 'xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzEtOTA4MTEzMjM2MzY5Ny05MDgxMTMyNjMwNTc3LTkyNDk3NzIxOTA1ODItZmZjZTQyZjAyYzU5ZDIwY2NiMmE3OTNjNzk5ZmM2NmRjNmNmMDVlYTFiMDUyNGEzYjljODE0NDg4ZTY5M2RiOQ';

    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const actionId = action.action_id;
      const userId = payload.user?.id;
      const triggerId = payload.trigger_id;
      
      console.log(`Processing action: ${actionId} for user: ${userId}`);
      
      // Handle different actions
      if (actionId === 'apply_leave') {
        console.log(`🚀 URGENT: Opening modal immediately for trigger_id: ${triggerId}`);
        
        // Create basic modal structure first to open it quickly
        const quickModal = {
          type: 'modal',
          callback_id: 'leave_application_modal',
          title: {
            type: 'plain_text',
            text: 'Apply for Leave'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⏳ Loading leave application form...'
              }
            }
          ]
        };

        // Open modal immediately
        const modalStartTime = Date.now();
        
        try {
          const modalResponse = await fetch('https://slack.com/api/views.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${botToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              trigger_id: triggerId,
              view: quickModal
            }),
          });

          const modalResult = await modalResponse.json();
          const modalDuration = Date.now() - modalStartTime;
          console.log(`⚡ Modal opened in: ${modalDuration} ms`);
          
          if (!modalResult.ok) {
            console.error('Failed to open modal:', modalResult.error);
            return new Response(JSON.stringify({ error: 'Failed to open modal' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }

          console.log('✅ Modal opened successfully!');
          
          // Now update the modal with real data
          console.log('🔄 Updating modal with real data...');
          
          // Get or create user profile
          const { data: existingProfile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', 'user_2xwywE2Bl76vs7l68dhj6nIcCPV')
            .single();

          if (existingProfile) {
            console.log('✅ Found existing profile for user:', existingProfile.id);
          } else {
            console.log('❌ No profile found for user');
          }

          // Get leave types
          const { data: leaveTypes } = await supabaseClient
            .from('leave_types')
            .select('*')
            .eq('is_active', true)
            .order('label');

          if (!leaveTypes || leaveTypes.length === 0) {
            console.error('No leave types found');
            return new Response(JSON.stringify({ error: 'No leave types configured' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }

          // Create leave type options
          const leaveTypeOptions = [];
          for (const leaveType of leaveTypes) {
            console.log(`🔍 Processing leave type: ${leaveType.label}`);
            
            // Get balance for this leave type
            const balanceResponse = await supabaseClient.rpc('get_monthly_leave_balance', {
              p_user_id: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV',
              p_leave_type_id: leaveType.id
            });

            let balanceText = '';
            if (balanceResponse.data) {
              const balance = balanceResponse.data;
              if (balance.duration_type === 'hours') {
                balanceText = ` (${balance.remaining_this_month || 0} hours remaining)`;
              } else if (balance.duration_type === 'days') {
                if (balance.remaining_this_month !== undefined) {
                  balanceText = ` (${balance.remaining_this_month} days remaining)`;
                } else if (balance.remaining_this_year !== undefined) {
                  balanceText = ` (${balance.remaining_this_year} days remaining)`;
                }
              }
            }

            leaveTypeOptions.push({
              text: {
                type: 'plain_text',
                text: `${leaveType.label}${balanceText}`
              },
              value: leaveType.id
            });
          }

          // Create full modal with all data
          const fullModal = {
            type: 'modal',
            callback_id: 'leave_application_modal',
            title: {
              type: 'plain_text',
              text: 'Apply for Leave'
            },
            submit: {
              type: 'plain_text',
              text: 'Submit Application'
            },
            close: {
              type: 'plain_text',
              text: 'Cancel'
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `👋 Hi ${existingProfile?.name || 'there'}! Ready to apply for some well-deserved time off?`
                }
              },
              {
                type: 'divider'
              },
              {
                type: 'input',
                block_id: 'leave_type_block',
                element: {
                  type: 'static_select',
                  action_id: 'leave_type_select',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select leave type'
                  },
                  options: leaveTypeOptions
                },
                label: {
                  type: 'plain_text',
                  text: 'Leave Type'
                }
              },
              {
                type: 'input',
                block_id: 'start_date_block',
                element: {
                  type: 'datepicker',
                  action_id: 'start_date_select',
                  initial_date: new Date().toISOString().split('T')[0],
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
                block_id: 'end_date_block',
                element: {
                  type: 'datepicker',
                  action_id: 'end_date_select',
                  initial_date: new Date().toISOString().split('T')[0],
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
                block_id: 'reason_block',
                element: {
                  type: 'plain_text_input',
                  action_id: 'reason_input',
                  multiline: true,
                  placeholder: {
                    type: 'plain_text',
                    text: 'Brief reason for leave (optional)'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Reason'
                },
                optional: true
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '✨ Your application will be reviewed by the admin team. You\'ll receive a notification once it\'s processed!'
                }
              }
            ]
          };

          // Update the modal with complete data
          const updateResponse = await fetch('https://slack.com/api/views.update', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${botToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              view_id: modalResult.view.id,
              view: fullModal
            }),
          });

          const updateResult = await updateResponse.json();
          if (!updateResult.ok) {
            console.error('Failed to update modal:', updateResult.error);
          }

          return new Response('', { status: 200 });
          
        } catch (error) {
          console.error('Error opening modal:', error);
          return new Response(JSON.stringify({ error: 'Failed to open modal' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }

      if (actionId === 'admin_review_requests') {
        console.log(`Processing action: ${actionId} for user: ${userId}`);
        
        // Get pending leave requests
        const { data: pendingRequests } = await supabaseClient
          .from('leave_applied_users')
          .select(`
            *,
            profiles!leave_applied_users_user_id_fkey (name, email),
            leave_types!leave_applied_users_leave_type_id_fkey (label, color)
          `)
          .eq('status', 'pending')
          .order('applied_at', { ascending: false });

        // Create admin review modal
        const adminModal = {
          type: 'modal',
          callback_id: 'admin_review_modal',
          title: {
            type: 'plain_text',
            text: 'Review Leave Requests'
          },
          close: {
            type: 'plain_text',
            text: 'Close'
          },
          blocks: []
        };

        if (!pendingRequests || pendingRequests.length === 0) {
          adminModal.blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎉 No pending leave requests to review!'
            }
          });
        } else {
          adminModal.blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📋 You have ${pendingRequests.length} pending leave request${pendingRequests.length > 1 ? 's' : ''} to review:`
            }
          });

          for (const request of pendingRequests.slice(0, 5)) { // Limit to 5 requests
            const userName = request.profiles?.name || 'Unknown User';
            const leaveType = request.leave_types?.label || 'Leave';
            const startDate = new Date(request.start_date).toLocaleDateString();
            const endDate = new Date(request.end_date).toLocaleDateString();
            const appliedDate = new Date(request.applied_at).toLocaleDateString();
            
            adminModal.blocks.push(
              {
                type: 'divider'
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${userName}* - ${leaveType}\n📅 ${startDate} to ${endDate}\n🕐 Applied: ${appliedDate}${request.reason ? `\n📝 Reason: ${request.reason}` : ''}`
                },
                accessory: {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Review'
                  },
                  action_id: 'review_request',
                  value: request.id
                }
              }
            );
          }
        }

        // Open admin modal
        const adminModalResponse = await fetch('https://slack.com/api/views.open', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trigger_id: triggerId,
            view: adminModal
          }),
        });

        const adminModalResult = await adminModalResponse.json();
        if (!adminModalResult.ok) {
          console.error('Failed to open admin modal:', adminModalResult.error);
        }

        return new Response('', { status: 200 });
      }
    }

    // Handle modal submission
    if (payload.type === 'view_submission') {
      const view = payload.view;
      const callbackId = view.callback_id;
      const userId = payload.user?.id;
      const user = payload.user;
      
      if (callbackId === 'leave_application_modal') {
        console.log('Processing leave application submission');
        
        // Extract form data
        const values = view.state.values;
        const leaveTypeId = values.leave_type_block?.leave_type_select?.selected_option?.value;
        const startDate = values.start_date_block?.start_date_select?.selected_date;
        const endDate = values.end_date_block?.end_date_select?.selected_date;
        const reason = values.reason_block?.reason_input?.value || '';

        if (!leaveTypeId || !startDate || !endDate) {
          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              leave_type_block: !leaveTypeId ? 'Please select a leave type' : undefined,
              start_date_block: !startDate ? 'Please select a start date' : undefined,
              end_date_block: !endDate ? 'Please select an end date' : undefined,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              end_date_block: 'End date must be after start date'
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }

        // Get or create user profile
        let userProfile = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', 'user_2xwywE2Bl76vs7l68dhj6nIcCPV')
          .single();

        if (!userProfile.data) {
          // Create profile from Slack user info
          const { data: newProfile } = await supabaseClient
            .from('profiles')
            .insert({
              id: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV',
              name: user?.real_name || user?.name || 'Unknown User',
              email: user?.profile?.email || 'unknown@example.com'
            })
            .select()
            .single();
          
          userProfile.data = newProfile;
        }

        // Calculate duration
        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Insert leave application
        const { data: leaveApp, error: insertError } = await supabaseClient
          .from('leave_applied_users')
          .insert({
            user_id: 'user_2xwywE2Bl76vs7l68dhj6nIcCPV',
            leave_type_id: leaveTypeId,
            start_date: startDate,
            end_date: endDate,
            reason: reason,
            status: 'pending',
            actual_days_used: duration
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting leave application:', insertError);
          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              reason_block: 'Failed to submit application. Please try again.'
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }

        console.log('✅ Leave application submitted successfully:', leaveApp.id);

        // Return success response
        return new Response('', { status: 200 });
      }
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('❌ Error processing Slack interaction:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
