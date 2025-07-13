import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@3.0.0';
import { format } from 'https://esm.sh/date-fns@3.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
if (Deno.args[0] === 'OPTIONS') {
  Deno.serve(() => new Response(null, { headers: corsHeaders }));
}

Deno.serve(async (req) => {
  console.log('🌅 Daily notification function started');

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
    const allUsersChannelId = Deno.env.get('SLACK_ALL_USERS_CHANNEL_ID');

    if (!botToken) {
      console.error('❌ SLACK_BOT_TOKEN not found');
      return new Response(
        JSON.stringify({ error: 'Bot token not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!allUsersChannelId) {
      console.error('❌ SLACK_ALL_USERS_CHANNEL_ID not found');
      return new Response(
        JSON.stringify({ error: 'All users channel ID not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get current date in IST
    const istTimezone = 'Asia/Kolkata';
    const today = formatInTimeZone(new Date(), istTimezone, 'yyyy-MM-dd');
    const todayFormatted = formatInTimeZone(new Date(), istTimezone, 'EEEE, MMMM do, yyyy');
    const dayOfWeek = formatInTimeZone(new Date(), istTimezone, 'EEEE');

    console.log(`📅 Processing for ${todayFormatted} (${dayOfWeek})`);

    // Skip Sundays
    if (dayOfWeek === 'Sunday') {
      console.log('📴 Skipping Sunday - no notifications sent');
      return new Response(
        JSON.stringify({ message: 'Skipped Sunday' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch approved leaves for today
    const { data: leaves, error: leavesError } = await supabaseClient
      .from('leave_applied_users')
      .select(`
        *,
        profiles!leave_applied_users_user_id_fkey(name),
        leave_types(label, color)
      `)
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);

    if (leavesError) {
      console.error('❌ Error fetching leaves:', leavesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leaves' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`📋 Found ${leaves?.length || 0} approved leaves for today`);

    // Create Slack message
    let message;
    
    if (!leaves || leaves.length === 0) {
      message = {
        channel: allUsersChannelId,
        text: `🏢 Daily Leave Status - ${todayFormatted}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🏢 Daily Leave Status - ${todayFormatted}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Great news!* Everyone is in the office today! 🎉\n\n_Have a productive day ahead!_ 💪`
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
                text: `📱 Powered by Timeloo • ${formatInTimeZone(new Date(), istTimezone, 'h:mm a')} IST`
              }
            ]
          }
        ]
      };
    } else {
      // Group leaves by type
      const leavesByType = leaves.reduce((acc, leave) => {
        const type = leave.leave_types?.label || 'Other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(leave);
        return acc;
      }, {});

      const leaveBlocks = [];
      
      // Add header
      leaveBlocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🏢 Daily Leave Status - ${todayFormatted}`
        }
      });

      leaveBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *${leaves.length} team member${leaves.length > 1 ? 's' : ''} on leave today:*`
        }
      });

      // Add leave details by type
      Object.entries(leavesByType).forEach(([type, typeLeaves]) => {
        const names = typeLeaves.map(leave => leave.profiles?.name || 'Unknown').join(', ');
        const emoji = getLeaveTypeEmoji(type);
        
        leaveBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${type}*: ${names} (${typeLeaves.length})`
          }
        });
      });

      leaveBlocks.push({ type: 'divider' });
      
      leaveBlocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📱 Powered by Timeloo • ${formatInTimeZone(new Date(), istTimezone, 'h:mm a')} IST`
          }
        ]
      });

      message = {
        channel: allUsersChannelId,
        text: `🏢 Daily Leave Status - ${todayFormatted}`,
        blocks: leaveBlocks
      };
    }

    // Send message to Slack
    console.log('📤 Sending daily notification to Slack');
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const slackResult = await slackResponse.json();
    console.log('📬 Slack response:', JSON.stringify(slackResult, null, 2));

    if (!slackResult.ok) {
      console.error('❌ Failed to send Slack message:', slackResult.error);
      return new Response(
        JSON.stringify({ error: `Slack error: ${slackResult.error}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Daily notification sent successfully');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        date: today,
        leaveCount: leaves?.length || 0,
        message: 'Daily notification sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Error in daily notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function getLeaveTypeEmoji(leaveType: string): string {
  switch (leaveType.toLowerCase()) {
    case 'paid leave':
    case 'annual leave':
      return '🏖️';
    case 'sick leave':
      return '🤒';
    case 'work from home':
    case 'remote work':
      return '🏠';
    case 'personal leave':
      return '👤';
    case 'emergency leave':
      return '🚨';
    case 'short leave':
      return '⏰';
    case 'maternity leave':
    case 'paternity leave':
      return '👶';
    case 'bereavement leave':
      return '🖤';
    case 'study leave':
      return '📚';
    default:
      return '📅';
  }
}