import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  {
    global: {
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    },
  }
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();

    if (type === 'block_actions' && payload.actions[0].action_id === 'apply_leave') {
      return handleApplyLeave(payload, supabaseClient);
    } else if (type === 'view_submission' && payload.callback_id === 'leave_application_modal') {
      return handleSubmitLeaveApplication(payload, supabaseClient);
    } else {
      return new Response(JSON.stringify({ message: 'Unknown action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('❌ Error processing request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

const handleApplyLeave = async (payload: any, supabaseClient: any) => {
  const triggerId = payload.trigger_id;
  const userId = payload.user.id;
  
  console.log('🚀 URGENT: Opening modal immediately for trigger_id:', triggerId);
  
  try {
    // Find the user in our database first
    const { data: slackIntegration, error: integrationError } = await supabaseClient
      .from('user_slack_integrations')
      .select('user_id')
      .eq('slack_user_id', userId)
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

    // Get all leave types for the modal
    const { data: leaveTypes, error: leaveTypesError } = await supabaseClient
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('label');

    if (leaveTypesError) {
      console.error('❌ Error fetching leave types:', leaveTypesError);
      throw leaveTypesError;
    }

    // Check WFH status for Additional WFH availability
    const wfhLeaveType = leaveTypes.find(lt => lt.label === 'Work From Home');
    const additionalWfhLeaveType = leaveTypes.find(lt => lt.label === 'Additional work from home');
    
    let wfhRemaining = 2;
    let showAdditionalWFH = false;
    
    if (wfhLeaveType) {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data: wfhLeaves } = await supabaseClient
        .from('leave_applied_users')
        .select('actual_days_used, is_half_day, start_date, end_date')
        .eq('user_id', slackIntegration.user_id)
        .eq('leave_type_id', wfhLeaveType.id)
        .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('start_date', currentMonth === 12 
          ? `${currentYear + 1}-01-01` 
          : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
        .in('status', ['approved', 'pending']);

      const totalWfhDaysUsed = wfhLeaves?.reduce((total: number, leave: any) => {
        if (leave.actual_days_used) {
          return total + leave.actual_days_used;
        }
        if (leave.is_half_day) {
          return total + 0.5;
        }
        const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        return total + daysDiff;
      }, 0) || 0;

      wfhRemaining = Math.max(0, 2 - totalWfhDaysUsed);
      showAdditionalWFH = wfhRemaining <= 0;
    }

    // Filter leave types based on WFH status
    const availableLeaveTypes = leaveTypes.filter(lt => {
      if (lt.label === 'Additional work from home') {
        return showAdditionalWFH;
      }
      return true;
    });

    // Create leave type options
    const leaveTypeOptions = availableLeaveTypes.map(type => ({
      text: {
        type: "plain_text",
        text: type.label
      },
      value: type.id
    }));

    // Add message about Additional WFH if regular WFH is exhausted
    let additionalMessage = '';
    if (showAdditionalWFH) {
      additionalMessage = '\n\n✅ *Additional Work From Home* is now available as your regular WFH quota has been exhausted. You can apply for unlimited additional WFH days.';
    } else if (wfhRemaining > 0) {
      additionalMessage = `\n\n📌 You have ${wfhRemaining} days of regular Work From Home remaining this month.`;
    }

    const modal = {
      type: "modal",
      callback_id: "leave_application_modal",
      title: {
        type: "plain_text",
        text: "Apply for Leave"
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📅 *Apply for Leave*\n\nSelected date: ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}${additionalMessage}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "input",
          block_id: "leave_type_block",
          element: {
            type: "static_select",
            action_id: "leave_type_select",
            placeholder: {
              type: "plain_text",
              text: "Select leave type"
            },
            options: leaveTypeOptions
          },
          label: {
            type: "plain_text",
            text: "Leave Type"
          }
        },
        {
          type: "input",
          block_id: "start_date_block",
          element: {
            type: "datepicker",
            action_id: "start_date_select",
            initial_date: new Date().toISOString().split('T')[0]
          },
          label: {
            type: "plain_text",
            text: "Start Date"
          }
        },
        {
          type: "input",
          block_id: "end_date_block",
          element: {
            type: "datepicker",
            action_id: "end_date_select",
            initial_date: new Date().toISOString().split('T')[0]
          },
          label: {
            type: "plain_text",
            text: "End Date"
          }
        },
        {
          type: "input",
          block_id: "reason_block",
          element: {
            type: "plain_text_input",
            action_id: "reason_input",
            multiline: true,
            placeholder: {
              type: "plain_text",
              text: "Please provide a reason for your leave request..."
            }
          },
          label: {
            type: "plain_text",
            text: "Reason"
          }
        }
      ],
      submit: {
        type: "plain_text",
        text: "Submit Leave Application"
      },
      close: {
        type: "plain_text",
        text: "Cancel"
      }
    };

    const slackResponse = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SLACK_BOT_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trigger_id: triggerId,
        view: modal
      })
    });

    const responseData = await slackResponse.json();
    console.log('⚡ Modal opened in:', Date.now() - performance.now(), 'ms');

    if (!responseData.ok) {
      console.error('❌ Failed to open modal:', responseData.error);
      if (responseData.error === 'expired_trigger_id') {
        return new Response(
          JSON.stringify({
            response_type: 'ephemeral',
            text: '⏰ The request took too long to process. Please try clicking the "Apply Leave" button again.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to open modal: ${responseData.error}`);
    }

    console.log('✅ Modal opened successfully!');
    return new Response('', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error in handleApplyLeave:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Sorry, there was an error opening the leave application form. Please try again or contact support.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

const handleSubmitLeaveApplication = async (payload: any, supabaseClient: any) => {
  try {
    const userId = payload.user.id;
    const view = payload.view;

    // Extract values from the modal
    const leaveTypeId = view.state.values.leave_type_block.leave_type_select.selected_option.value;
    const startDate = view.state.values.start_date_block.start_date_select.selected_date;
    const endDate = view.state.values.end_date_block.end_date_select.selected_date;
    const reason = view.state.values.reason_block.reason_input.value;

    // Find the user in our database
    const { data: slackIntegration, error: integrationError } = await supabaseClient
      .from('user_slack_integrations')
      .select('user_id')
      .eq('slack_user_id', userId)
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

    // Calculate days for the application
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24)) + 1;

    // Prepare the submission data
    const submissionData = {
      user_id: slackIntegration.user_id,
      start_date: startDate,
      end_date: endDate,
      leave_type_id: leaveTypeId,
      reason: reason,
      status: 'pending',
      is_half_day: false,
      actual_days_used: daysDiff,
      hours_requested: 0
    };

    // Insert the leave application into the database
    const { error: insertError } = await supabaseClient
      .from('leave_applied_users')
      .insert(submissionData);

    if (insertError) {
      console.error('❌ Error inserting leave application:', insertError);
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Failed to submit leave application: ${insertError.message}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Acknowledge the submission
    return new Response(null, { status: 200 });

  } catch (error) {
    console.error('❌ Error in handleSubmitLeaveApplication:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Sorry, there was an error submitting the leave application. Please try again or contact support.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
