import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@3.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
if (Deno.args[0] === 'OPTIONS') {
  Deno.serve(() => new Response(null, { headers: corsHeaders }));
}

Deno.serve(async (req) => {
  console.log('🌇 Mid-day notification function started');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const botToken = Deno.env.get('SLACK_BOT_TOKEN');
    const channelId = 'C095J2588Q5'; // Second channel for real-time notifications

    console.log('🔑 Checking environment variables...');
    console.log('Bot token exists:', !!botToken);
    console.log('Channel ID:', channelId);

    if (!botToken) {
      console.error('❌ Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing required environment variables' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Validate bot token format
    if (!botToken.startsWith('xoxb-') && !botToken.startsWith('xoxe.xoxb-')) {
      console.error('❌ Invalid bot token format');
      return new Response(
        JSON.stringify({ error: 'Invalid bot token format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get current time in IST
    const istTimezone = 'Asia/Kolkata';
    const now = new Date();
    const currentIST = new Date(now.toLocaleString("en-US", {timeZone: istTimezone}));
    const currentHour = currentIST.getHours();
    const currentMinute = currentIST.getMinutes();
    
    console.log(`🕐 Current IST time: ${formatInTimeZone(now, istTimezone, 'HH:mm')}`);

    // Check if it's between 10:30 AM and 5:30 PM IST
    const isWorkingHours = (currentHour > 10 || (currentHour === 10 && currentMinute >= 30)) && 
                           (currentHour < 17 || (currentHour === 17 && currentMinute <= 30));

    if (!isWorkingHours) {
      console.log('⏰ Outside working hours (10:30 AM - 5:30 PM IST), skipping mid-day notification');
      return new Response(
        JSON.stringify({ message: 'Outside working hours' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Skip weekends
    const dayOfWeek = formatInTimeZone(now, istTimezone, 'EEEE');
    if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
      console.log('📴 Skipping weekend - no notifications sent');
      return new Response(
        JSON.stringify({ message: 'Skipped weekend' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Look for recent leave applications (last 30 minutes)
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const thirtyMinutesAgoISO = thirtyMinutesAgo.toISOString();

    console.log('🔍 Checking for recent leave applications since:', thirtyMinutesAgoISO);

    // Fetch recent leave applications that are pending or approved
    const { data: recentLeaves, error: leavesError } = await supabaseClient
      .from('leave_applied_users')
      .select(`
        *,
        profiles:user_id (name, email),
        leave_types:leave_type_id (label, color)
      `)
      .in('status', ['pending', 'approved'])
      .gte('applied_at', thirtyMinutesAgoISO);

    if (leavesError) {
      console.error('❌ Error fetching recent leaves:', leavesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recent leaves' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`📋 Found ${recentLeaves?.length || 0} recent leave applications`);

    if (!recentLeaves || recentLeaves.length === 0) {
      console.log('✅ No recent leave applications found');
      return new Response(
        JSON.stringify({ message: 'No recent leave applications' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Send notification for each recent leave application
    for (const leave of recentLeaves) {
      const userName = leave.profiles?.name || 'Unknown';
      const leaveType = leave.leave_types?.label || 'Leave';
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const status = leave.status === 'pending' ? '⏳ awaiting approval' : '✅ approved';
      
      const formattedStartDate = formatInTimeZone(startDate, istTimezone, 'MMM dd');
      const formattedEndDate = formatInTimeZone(endDate, istTimezone, 'MMM dd');
      const dateRange = startDate.getTime() === endDate.getTime() ? 
        formattedStartDate : 
        `${formattedStartDate} - ${formattedEndDate}`;

      const message = {
        channel: channelId,
        text: `💫 ${userName} just applied for leave!`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `💫 Hey Groto family!\n\n*${userName}* just applied for *${leaveType}* (${dateRange}) — ${daysDiff} day${daysDiff > 1 ? 's' : ''} ${status}.\n\nLet's make sure they can disconnect peacefully! 🌸✨`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `📱 Powered by Timeloo • ${formatInTimeZone(now, istTimezone, 'h:mm a')} IST`
              }
            ]
          }
        ]
      };

      console.log(`📤 Sending mid-day notification for ${userName}'s leave application`);

      try {
        const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        if (!slackResponse.ok) {
          throw new Error(`HTTP ${slackResponse.status}: ${slackResponse.statusText}`);
        }

        const slackResult = await slackResponse.json();
        console.log('📬 Slack response:', JSON.stringify(slackResult, null, 2));

        if (!slackResult.ok) {
          console.error('❌ Slack API error:', slackResult.error);
        } else {
          console.log(`✅ Mid-day notification sent successfully for ${userName}`);
        }

      } catch (fetchError) {
        console.error(`❌ Error sending mid-day notification for ${userName}:`, fetchError.message);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processedLeaves: recentLeaves.length,
        message: 'Mid-day notifications processed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Error in mid-day notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});