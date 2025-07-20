
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminInviteRequest {
  email: string;
  invitedBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, invitedBy }: AdminInviteRequest = await req.json();

    if (!email || !invitedBy) {
      throw new Error("Email and invitedBy are required");
    }

    console.log(`Processing admin invite for ${email} by ${invitedBy}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate unique invite token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Store invite in database
    const { error: insertError } = await supabase
      .from('admin_invites')
      .insert({
        email,
        invited_by: invitedBy,
        invite_token: inviteToken,
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to create invite: ${insertError.message}`);
    }

    // Get inviter details
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', invitedBy)
      .single();

    const inviterName = inviterProfile?.name || 'Timeloo Admin';
    const inviteUrl = `${Deno.env.get('PROJECT_URL')}/admin/accept-invite?token=${inviteToken}`;

    // Send invitation email with verified domain (using onboarding@resend.dev)
    const emailResponse = await resend.emails.send({
      from: "Timeloo <onboarding@resend.dev>",
      to: [email],
      subject: "🎉 You're Invited to Join Timeloo as an Admin!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Timeloo Admin Invitation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0;">
            
            <!-- Header with Mascot -->
            <div style="text-align: center; padding: 40px 20px; color: white;">
              <div style="font-size: 60px; margin-bottom: 10px;">🤖</div>
              <h1 style="margin: 0; font-size: 32px; font-weight: bold;">Timeloo</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Leave Management Made Simple</p>
            </div>

            <!-- Main Content -->
            <div style="background: white; margin: 0 20px; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              
              <!-- Invitation Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 24px; border-radius: 25px; font-weight: bold; margin-bottom: 20px;">
                  🎉 Admin Invitation
                </div>
                <h2 style="margin: 0; color: #2d3748; font-size: 28px;">You're Invited!</h2>
              </div>

              <!-- Personal Message -->
              <div style="background: #f7fafc; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <p style="margin: 0; font-size: 16px; color: #4a5568;">
                  <strong>${inviterName}</strong> has invited you to become an admin on Timeloo! 
                  You'll have access to manage leave applications, view analytics, and help your team stay organized.
                </p>
              </div>

              <!-- Features List -->
              <div style="margin-bottom: 30px;">
                <h3 style="color: #2d3748; margin-bottom: 15px; font-size: 20px;">As an admin, you'll be able to:</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                  <li style="padding: 8px 0; color: #4a5568; font-size: 16px;">
                    ✅ Approve and reject leave applications
                  </li>
                  <li style="padding: 8px 0; color: #4a5568; font-size: 16px;">
                    📊 View detailed leave analytics and reports  
                  </li>
                  <li style="padding: 8px 0; color: #4a5568; font-size: 16px;">
                    👥 Manage team leave balances
                  </li>
                  <li style="padding: 8px 0; color: #4a5568; font-size: 16px;">
                    🔔 Receive instant Slack notifications
                  </li>
                  <li style="padding: 8px 0; color: #4a5568; font-size: 16px;">
                    ⚙️ Configure system settings
                  </li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${inviteUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; padding: 16px 32px; border-radius: 30px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                  🚀 Accept Admin Invitation
                </a>
              </div>

              <!-- Mascot Encouragement -->
              <div style="background: linear-gradient(135deg, #e6fffa, #f0fff4); border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
                <div style="font-size: 40px; margin-bottom: 10px;">🤖💜</div>
                <p style="margin: 0; color: #2d5a27; font-style: italic; font-size: 16px;">
                  "Welcome to the Timeloo family! I'm excited to have you help manage our amazing team!" 
                  <br><strong>- Timeloo Bot</strong>
                </p>
              </div>

              <!-- Expiry Notice -->
              <div style="border: 2px dashed #fed7d7; background: #fff5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #c53030; font-size: 14px; text-align: center;">
                  ⏰ This invitation expires in 7 days. Please accept it soon!
                </p>
              </div>

              <!-- Help Section -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
                <p style="margin: 0; color: #718096; font-size: 14px; text-align: center;">
                  Need help? Contact our support team or reach out to ${inviterName} directly.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 30px 20px; color: white;">
              <p style="margin: 0; font-size: 14px; opacity: 0.8;">
                Timeloo - Making leave management delightful since 2024
              </p>
              <div style="margin-top: 10px; font-size: 20px;">🤖💙🎉</div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Admin invitation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin invitation sent successfully",
        inviteToken,
        expiresAt: expiresAt.toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-admin-invite function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
