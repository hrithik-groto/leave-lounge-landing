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
    
    console.log('Received Slack interaction:', payload.type);

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