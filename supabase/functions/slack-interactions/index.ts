
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("=== SLACK INTERACTION REQUEST START ===");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const formData = new URLSearchParams(body);
    const payloadStr = formData.get('payload');
    
    if (!payloadStr) {
      console.error("No payload found in request");
      return new Response('No payload found', { status: 400 });
    }

    const payload = JSON.parse(payloadStr);
    console.log(`📝 Payload type: ${payload.type}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const user = payload.user;
      
      console.log(`Processing action: ${action.action_id} for user: ${user.id}`);

      if (action.action_id === 'apply_leave') {
        console.log(`🚀 URGENT: Opening modal immediately for trigger_id: ${payload.trigger_id}`);
        
        const startTime = Date.now();
        
        // Step 1: Open basic modal immediately to prevent trigger_id expiration
        const basicModal = {
          type: 'modal',
          callback_id: 'leave_application_modal',
          title: {
            type: 'plain_text',
            text: 'Apply for Leave',
            emoji: true
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⏳ Loading leave types and your balance...'
              }
            }
          ]
        };

        const botToken = Deno.env.get('SLACK_BOT_TOKEN');
        const modalResponse = await fetch('https://slack.com/api/views.open', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trigger_id: payload.trigger_id,
            view: basicModal
          })
        });

        if (!modalResponse.ok) {
          const errorText = await modalResponse.text();
          console.error('❌ Failed to open basic modal:', errorText);
          return new Response('Failed to open modal', { status: 500 });
        }

        const modalResult = await modalResponse.json();
        console.log(`✅ Modal opened successfully!`);
        console.log(`⚡ Modal opened in: ${Date.now() - startTime} ms`);

        // Step 2: Asynchronously update modal with real data
        console.log(`🔄 Updating modal with real data...`);
        
        // Get or create user profile
        let profile;
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!existingProfile) {
          console.log(`👤 Creating new profile for user: ${user.id}`);
          // Create the user profile if it doesn't exist
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.profile?.email || `${user.name}@slack.user`,
              name: user.real_name || user.name || 'Slack User'
            })
            .select()
            .single();

          if (createError) {
            console.error('❌ Error creating user profile:', createError);
            return new Response('Failed to create user profile', { status: 500 });
          }
          
          profile = newProfile;
          console.log(`✅ Created new profile for user: ${user.id}`);
        } else {
          profile = existingProfile;
          console.log(`✅ Found existing profile for user: ${user.id}`);
        }

        // Get leave types
        const { data: leaveTypes } = await supabase
          .from('leave_types')
          .select('*')
          .eq('is_active', true)
          .order('label');

        // Build leave type options with balance info
        const leaveTypeOptions = [];
        
        for (const leaveType of leaveTypes || []) {
          // Get balance for each leave type
          const { data: balanceData } = await supabase
            .rpc('get_monthly_leave_balance', {
              p_user_id: user.id,
              p_leave_type_id: leaveType.id,
              p_month: new Date().getMonth() + 1,
              p_year: new Date().getFullYear()
            });

          let balanceText = '';
          let isDisabled = false;

          if (balanceData) {
            if (leaveType.label === 'Additional work from home') {
              // For Additional WFH, show annual balance and check if applicable
              const canApply = balanceData.can_apply || false;
              const remainingThisYear = balanceData.remaining_this_year || 0;
              const wfhRemaining = balanceData.wfh_remaining || 0;
              
              if (!canApply) {
                if (wfhRemaining > 0) {
                  balanceText = ` (Use regular WFH first: ${wfhRemaining} days left)`;
                  isDisabled = true;
                } else if (remainingThisYear <= 0) {
                  balanceText = ` (Annual quota exhausted: 0/24 days left)`;
                  isDisabled = true;
                }
              } else {
                balanceText = ` (${remainingThisYear}/24 days left this year)`;
              }
            } else if (leaveType.label === 'Short Leave') {
              const remaining = balanceData.remaining_this_month || 0;
              balanceText = ` (${remaining}/4 hours left this month)`;
              isDisabled = remaining <= 0;
            } else if (leaveType.label === 'Work From Home') {
              const remaining = balanceData.remaining_this_month || 0;
              balanceText = ` (${remaining}/2 days left this month)`;
              isDisabled = remaining <= 0;
            } else if (leaveType.label === 'Paid Leave') {
              const remaining = balanceData.remaining_this_month || 0;
              const monthly = balanceData.monthly_allowance || 1.5;
              balanceText = ` (${remaining}/${monthly} days left this month)`;
              isDisabled = remaining <= 0;
            } else if (leaveType.label === 'Annual Leave') {
              const remaining = balanceData.remaining_this_month || 0;
              const annual = balanceData.annual_allowance || 18;
              balanceText = ` (${remaining}/${annual} days left this year)`;
              isDisabled = remaining <= 0;
            } else {
              const remaining = balanceData.remaining_this_month || 0;
              const unit = balanceData.duration_type === 'hours' ? 'hours' : 'days';
              const allowance = balanceData.monthly_allowance || balanceData.annual_allowance || 0;
              balanceText = ` (${remaining}/${allowance} ${unit} left)`;
              isDisabled = remaining <= 0;
            }
          }

          if (!isDisabled) {
            leaveTypeOptions.push({
              text: {
                type: 'plain_text',
                text: `${leaveType.label}${balanceText}`,
                emoji: true
              },
              value: leaveType.id
            });
          }
        }

        if (leaveTypeOptions.length === 0) {
          leaveTypeOptions.push({
            text: {
              type: 'plain_text',
              text: 'No leave types available - All quotas exhausted',
              emoji: true
            },
            value: 'none'
          });
        }

        // Update modal with real data
        const fullModal = {
          type: 'modal',
          callback_id: 'leave_application_modal',
          title: {
            type: 'plain_text',
            text: 'Apply for Leave',
            emoji: true
          },
          submit: {
            type: 'plain_text',
            text: 'Submit',
            emoji: true
          },
          close: {
            type: 'plain_text',
            text: 'Cancel',
            emoji: true
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `👋 Hi *${profile.name || user.real_name || user.name}*! Let's apply for your leave.`
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
                  text: 'Select leave type',
                  emoji: true
                },
                options: leaveTypeOptions
              },
              label: {
                type: 'plain_text',
                text: 'Leave Type',
                emoji: true
              }
            },
            {
              type: 'input',
              block_id: 'start_date_block',
              element: {
                type: 'datepicker',
                action_id: 'start_date_pick',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select start date',
                  emoji: true
                }
              },
              label: {
                type: 'plain_text',
                text: 'Start Date',
                emoji: true
              }
            },
            {
              type: 'input',
              block_id: 'end_date_block',
              element: {
                type: 'datepicker',
                action_id: 'end_date_pick',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select end date',
                  emoji: true
                }
              },
              label: {
                type: 'plain_text',
                text: 'End Date',
                emoji: true
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
                  text: 'Enter reason for leave...',
                  emoji: true
                }
              },
              label: {
                type: 'plain_text',
                text: 'Reason',
                emoji: true
              },
              optional: true
            }
          ]
        };

        // Update the modal
        const updateResponse = await fetch('https://slack.com/api/views.update', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            view_id: modalResult.view.id,
            view: fullModal
          })
        });

        if (updateResponse.ok) {
          console.log(`✅ Modal updated with real data`);
        } else {
          console.error('❌ Failed to update modal');
        }

        return new Response('OK', { 
          status: 200,
          headers: corsHeaders 
        });
      }
    }

    // Handle modal submission
    if (payload.type === 'view_submission') {
      console.log('📋 Processing modal submission...');
      
      const values = payload.view.state.values;
      const userId = payload.user.id;
      
      // Extract form values
      const leaveTypeId = values.leave_type_block?.leave_type_select?.selected_option?.value;
      const startDate = values.start_date_block?.start_date_pick?.selected_date;
      const endDate = values.end_date_block?.end_date_pick?.selected_date;
      const reason = values.reason_block?.reason_input?.value || '';

      if (!leaveTypeId || leaveTypeId === 'none') {
        console.error('❌ No valid leave type selected');
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: {
            leave_type_block: 'Please select a valid leave type'
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!startDate || !endDate) {
        console.error('❌ Missing dates');
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: {
            start_date_block: !startDate ? 'Start date is required' : '',
            end_date_block: !endDate ? 'End date is required' : ''
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get leave type details
      const { data: leaveType } = await supabase
        .from('leave_types')
        .select('*')
        .eq('id', leaveTypeId)
        .single();

      if (!leaveType) {
        console.error('❌ Leave type not found');
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: {
            leave_type_block: 'Invalid leave type selected'
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Additional validation for Additional work from home
      if (leaveType.label === 'Additional work from home') {
        // Check if user can apply for Additional WFH
        const { data: balanceData } = await supabase
          .rpc('get_monthly_leave_balance', {
            p_user_id: userId,
            p_leave_type_id: leaveTypeId,
            p_month: new Date().getMonth() + 1,
            p_year: new Date().getFullYear()
          });

        if (!balanceData?.can_apply) {
          const wfhRemaining = balanceData?.wfh_remaining || 0;
          const remainingThisYear = balanceData?.remaining_this_year || 0;
          
          let errorMessage = '';
          if (wfhRemaining > 0) {
            errorMessage = `Please use your regular Work From Home quota first. You have ${wfhRemaining} days remaining this month.`;
          } else if (remainingThisYear <= 0) {
            errorMessage = 'Your annual Additional Work From Home quota (24 days) has been exhausted. Please wait for the next year.';
          } else {
            errorMessage = 'Additional Work From Home is not available at this time.';
          }

          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              leave_type_block: errorMessage
            }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if the requested days would exceed annual limit
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24)) + 1;
        
        if (daysDiff > (balanceData?.remaining_this_year || 0)) {
          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              end_date_block: `You can only apply for ${balanceData?.remaining_this_year || 0} more days this year. Requested: ${daysDiff} days.`
            }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Insert leave application
      const { data: leaveApplication, error: insertError } = await supabase
        .from('leave_applied_users')
        .insert({
          user_id: userId,
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
          status: leaveType.requires_approval ? 'pending' : 'approved'
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error inserting leave application:', insertError);
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: {
            leave_type_block: 'Failed to submit leave application. Please try again.'
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ Leave application submitted successfully');

      // Clear the modal and show success message
      return new Response(JSON.stringify({
        response_action: 'clear'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error processing Slack interaction:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
