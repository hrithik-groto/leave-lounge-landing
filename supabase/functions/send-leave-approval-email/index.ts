
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leave_request_id, user_id, start_date, end_date, leave_type_id, reason } = await req.json();
    
    console.log('Processing leave approval email for:', { leave_request_id, user_id });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user profile information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    // Get leave type information
    const { data: leaveType, error: leaveTypeError } = await supabase
      .from('leave_types')
      .select('label')
      .eq('id', leave_type_id)
      .single();

    if (leaveTypeError) {
      console.error('Error fetching leave type:', leaveTypeError);
      throw new Error('Failed to fetch leave type');
    }

    // Format dates
    const startDateFormatted = new Date(start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const endDateFormatted = new Date(end_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create email content
    const emailSubject = `🎉 Your ${leaveType.label} Application has been Approved!`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🎉 Leave Approved!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your leave application has been successfully approved</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #343a40; margin-top: 0;">Leave Details</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveType.label}</p>
            <p style="margin: 5px 0;"><strong>Start Date:</strong> ${startDateFormatted}</p>
            <p style="margin: 5px 0;"><strong>End Date:</strong> ${endDateFormatted}</p>
            ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; border: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="margin: 0; color: #155724; font-weight: bold;">✅ Status: Approved</p>
          </div>
          
          <h3 style="color: #343a40; margin-top: 25px;">What's Next?</h3>
          <ul style="color: #6c757d; line-height: 1.6;">
            <li>Your leave has been officially approved and recorded in the system</li>
            <li>Please ensure any pending work is completed or handed over before your leave starts</li>
            <li>Set up your out-of-office message and inform your colleagues</li>
            <li>Have a great time off! 🌟</li>
          </ul>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background: #e9ecef; border-radius: 8px;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              Questions? Contact your manager or HR department<br>
              <strong>Timeloo Leave Management System</strong>
            </p>
          </div>
        </div>
      </div>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: 'Timeloo <onboarding@resend.dev>',
      to: [profile.email],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log('Leave approval email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Leave approval email sent successfully',
        emailId: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in send-leave-approval-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);
