
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
        
        // First check if user is connected to the system
        const { data: slackIntegration, error: integrationError } = await supabase
          .from('user_slack_integrations')
          .select('user_id')
          .eq('slack_user_id', user.id)
          .eq('slack_team_id', payload.team.id)
          .single();

        if (integrationError || !slackIntegration) {
          console.error('❌ User not connected to system:', integrationError);
          
          const errorModal = {
            type: 'modal',
            callback_id: 'connection_error_modal',
            title: {
              type: 'plain_text',
              text: 'Connection Required',
              emoji: true
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '❌ *Account Not Connected*\n\nYour Slack account is not connected to Timeloo. Please visit the web application to link your account first.'
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '🔗 *How to Connect:*\n1. Visit the Timeloo web application\n2. Go to Settings > Integrations\n3. Connect your Slack account\n4. Return here and try again'
                }
              }
            ]
          };

          const botToken = Deno.env.get('SLACK_BOT_TOKEN');
          await fetch('https://slack.com/api/views.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${botToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              trigger_id: payload.trigger_id,
              view: errorModal
            })
          });

          return new Response('OK', { status: 200, headers: corsHeaders });
        }

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
                text: '⏳ Loading your profile and leave balances...'
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
        
        // Get user profile with comprehensive error handling
        let profile;
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', slackIntegration.user_id)
          .single();

        if (profileError || !existingProfile) {
          console.log(`👤 Creating new profile for user: ${slackIntegration.user_id}`);
          
          // Extract user info from Slack payload
          const userEmail = user.profile?.email || `${user.name}@slack.user`;
          const userName = user.real_name || user.profile?.real_name || user.name || 'Slack User';
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: slackIntegration.user_id,
              email: userEmail,
              name: userName
            })
            .select()
            .single();

          if (createError) {
            console.error('❌ Error creating user profile:', createError);
            return new Response('Failed to create user profile', { status: 500 });
          }
          
          profile = newProfile;
          console.log(`✅ Created new profile for user: ${slackIntegration.user_id}`);
        } else {
          profile = existingProfile;
          console.log(`✅ Found existing profile for user: ${slackIntegration.user_id}`);
        }

        // Get all leave types
        const { data: leaveTypes } = await supabase
          .from('leave_types')
          .select('*')
          .eq('is_active', true)
          .order('label');

        // Build comprehensive leave balance summary and available options
        const leaveTypeOptions = [];
        const balanceSummaryItems = [];
        let hasAvailableLeave = false;
        
        for (const leaveType of leaveTypes || []) {
          // Get balance for each leave type
          const { data: balanceData } = await supabase
            .rpc('get_monthly_leave_balance', {
              p_user_id: slackIntegration.user_id,
              p_leave_type_id: leaveType.id,
              p_month: new Date().getMonth() + 1,
              p_year: new Date().getFullYear()
            });

          let balanceText = '';
          let isExhausted = false;
          let summaryText = '';
          let statusEmoji = '';

          if (balanceData) {
            if (leaveType.label === 'Additional work from home') {
              // For Additional WFH, show annual balance and check if applicable
              const canApply = balanceData.can_apply || false;
              const remainingThisYear = balanceData.remaining_this_year || 0;
              const wfhRemaining = balanceData.wfh_remaining || 0;
              
              if (!canApply) {
                if (wfhRemaining > 0) {
                  balanceText = ` (Use regular WFH first: ${wfhRemaining} days left)`;
                  isExhausted = true;
                  statusEmoji = '⚠️';
                  summaryText = `⚠️ *Additional WFH:* Use regular WFH first (${wfhRemaining} days left)`;
                } else if (remainingThisYear <= 0) {
                  balanceText = ` (Annual quota exhausted: 0/24 days left)`;
                  isExhausted = true;
                  statusEmoji = '❌';
                  summaryText = `❌ *Additional WFH:* Annual quota exhausted (0/24 days left)`;
                }
              } else {
                balanceText = ` (${remainingThisYear}/24 days left this year)`;
                statusEmoji = remainingThisYear > 0 ? '✅' : '❌';
                summaryText = `${statusEmoji} *Additional WFH:* ${remainingThisYear}/24 days left this year`;
                isExhausted = remainingThisYear <= 0;
              }
            } else if (leaveType.label === 'Short Leave') {
              const remaining = balanceData.remaining_this_month || 0;
              balanceText = ` (${remaining}/4 hours left this month)`;
              isExhausted = remaining <= 0;
              statusEmoji = remaining > 0 ? '✅' : '❌';
              summaryText = `${statusEmoji} *Short Leave:* ${remaining}/4 hours left this month`;
            } else if (leaveType.label === 'Work From Home') {
              const remaining = balanceData.remaining_this_month || 0;
              balanceText = ` (${remaining}/2 days left this month)`;
              isExhausted = remaining <= 0;
              statusEmoji = remaining > 0 ? '✅' : '❌';
              summaryText = `${statusEmoji} *Work From Home:* ${remaining}/2 days left this month`;
            } else if (leaveType.label === 'Paid Leave') {
              const remaining = balanceData.remaining_this_month || 0;
              const monthly = balanceData.monthly_allowance || 1.5;
              balanceText = ` (${remaining}/${monthly} days left this month)`;
              isExhausted = remaining <= 0;
              statusEmoji = remaining > 0 ? '✅' : '❌';
              summaryText = `${statusEmoji} *Paid Leave:* ${remaining}/${monthly} days left this month`;
            } else if (leaveType.label === 'Annual Leave') {
              const remaining = balanceData.remaining_this_month || 0;
              const annual = balanceData.annual_allowance || 18;
              balanceText = ` (${remaining}/${annual} days left this year)`;
              isExhausted = remaining <= 0;
              statusEmoji = remaining > 0 ? '✅' : '❌';
              summaryText = `${statusEmoji} *Annual Leave:* ${remaining}/${annual} days left this year`;
            } else {
              const remaining = balanceData.remaining_this_month || 0;
              const unit = balanceData.duration_type === 'hours' ? 'hours' : 'days';
              const allowance = balanceData.monthly_allowance || balanceData.annual_allowance || 0;
              balanceText = ` (${remaining}/${allowance} ${unit} left)`;
              isExhausted = remaining <= 0;
              statusEmoji = remaining > 0 ? '✅' : '❌';
              summaryText = `${statusEmoji} *${leaveType.label}:* ${remaining}/${allowance} ${unit} left`;
            }
          } else {
            // No balance data available
            isExhausted = true;
            statusEmoji = '❓';
            summaryText = `❓ *${leaveType.label}:* Balance unavailable`;
          }

          // Add to balance summary
          balanceSummaryItems.push(summaryText);

          // Only add to options if not exhausted
          if (!isExhausted) {
            leaveTypeOptions.push({
              text: {
                type: 'plain_text',
                text: `${leaveType.label}${balanceText}`,
                emoji: true
              },
              value: leaveType.id
            });
            hasAvailableLeave = true;
          }
        }

        // Create the comprehensive balance summary text
        const balanceSummaryText = balanceSummaryItems.length > 0 
          ? balanceSummaryItems.join('\n') 
          : '❓ No leave balance information available';

        // If no leave types are available, show a special message
        if (!hasAvailableLeave) {
          leaveTypeOptions.push({
            text: {
              type: 'plain_text',
              text: '❌ All leave quotas exhausted - No applications allowed',
              emoji: true
            },
            value: 'exhausted'
          });
        }

        // Create modal blocks
        const modalBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `👤 *Employee:* ${profile.name || 'Unknown'}\n📧 *Email:* ${profile.email || 'Unknown'}`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📊 *Your Current Leave Balances:*\n\n${balanceSummaryText}`
            }
          },
          {
            type: 'divider'
          }
        ];

        // Add form fields only if there are available leave types
        if (hasAvailableLeave) {
          modalBlocks.push(
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
          );
        } else {
          // Show message when all quotas are exhausted
          modalBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ *All Leave Quotas Exhausted*\n\nYou cannot apply for any leave at this time as all your leave quotas have been exhausted. Please wait for the next month/year for quota refresh or contact your HR for additional leave allocation.'
            }
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
          blocks: modalBlocks
        };

        // Only add submit button if there are available leave types
        if (hasAvailableLeave) {
          fullModal.submit = {
            type: 'plain_text',
            text: 'Submit',
            emoji: true
          };
        }

        fullModal.close = {
          type: 'plain_text',
          text: hasAvailableLeave ? 'Cancel' : 'Close',
          emoji: true
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
          console.log(`✅ Modal updated with comprehensive leave balance information`);
        } else {
          const errorText = await updateResponse.text();
          console.error('❌ Failed to update modal:', errorText);
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
      
      // Get the actual user ID from Slack integration
      const { data: slackIntegration } = await supabase
        .from('user_slack_integrations')
        .select('user_id')
        .eq('slack_user_id', userId)
        .eq('slack_team_id', payload.team.id)
        .single();

      if (!slackIntegration) {
        console.error('❌ User not found in integrations');
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: {
            leave_type_block: 'Your account is not connected. Please connect your Slack account in the web app first.'
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const actualUserId = slackIntegration.user_id;
      
      // Extract form values
      const leaveTypeId = values.leave_type_block?.leave_type_select?.selected_option?.value;
      const startDate = values.start_date_block?.start_date_pick?.selected_date;
      const endDate = values.end_date_block?.end_date_pick?.selected_date;
      const reason = values.reason_block?.reason_input?.value || '';

      // Check if user selected the "exhausted" option
      if (!leaveTypeId || leaveTypeId === 'exhausted') {
        console.error('❌ Invalid leave type selected - all quotas exhausted');
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: {
            leave_type_block: 'All your leave quotas are exhausted. You cannot apply for any leave at this time.'
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

      // Calculate requested days
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24)) + 1;

      // Validate balance before submission with comprehensive checks
      const { data: currentBalance } = await supabase
        .rpc('get_monthly_leave_balance', {
          p_user_id: actualUserId,
          p_leave_type_id: leaveTypeId,
          p_month: new Date().getMonth() + 1,
          p_year: new Date().getFullYear()
        });

      if (currentBalance) {
        let remainingBalance = 0;
        let errorMessage = '';

        if (leaveType.label === 'Additional work from home') {
          if (!currentBalance.can_apply) {
            const wfhRemaining = currentBalance.wfh_remaining || 0;
            if (wfhRemaining > 0) {
              errorMessage = `❌ Please use your regular Work From Home quota first. You have ${wfhRemaining} days remaining this month.`;
            } else {
              errorMessage = '❌ Your annual Additional Work From Home quota (24 days) has been exhausted.';
            }
          } else {
            remainingBalance = currentBalance.remaining_this_year || 0;
            if (daysDiff > remainingBalance) {
              errorMessage = `❌ Insufficient balance. You can only apply for ${remainingBalance} more days this year. Requested: ${daysDiff} days.`;
            }
          }
        } else {
          remainingBalance = currentBalance.remaining_this_month || 0;
          if (remainingBalance <= 0) {
            const unit = currentBalance.duration_type === 'hours' ? 'hours' : 'days';
            const period = leaveType.label === 'Annual Leave' ? 'year' : 'month';
            errorMessage = `❌ Your ${leaveType.label} quota is exhausted for this ${period}. No ${unit} remaining.`;
          } else if (leaveType.label !== 'Short Leave' && daysDiff > remainingBalance) {
            errorMessage = `❌ Insufficient balance. You have ${remainingBalance} days remaining. Requested: ${daysDiff} days.`;
          }
        }

        if (errorMessage) {
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
      }

      // Insert leave application
      const { data: leaveApplication, error: insertError } = await supabase
        .from('leave_applied_users')
        .insert({
          user_id: actualUserId,
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
