
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

    console.log('🔑 Checking environment variables...');
    console.log('Bot token exists:', !!botToken);
    console.log('Channel ID exists:', !!allUsersChannelId);

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

    // Validate bot token format - accept both xoxb- and xoxe.xoxb- formats
    if (!botToken.startsWith('xoxb-') && !botToken.startsWith('xoxe.xoxb-')) {
      console.error('❌ Invalid bot token format - should start with xoxb- or xoxe.xoxb-');
      return new Response(
        JSON.stringify({ error: 'Invalid bot token format' }),
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

    // Fetch approved leaves for today with fallback approach
    console.log('🔍 Fetching leaves for date:', today);
    
    // First, get basic leave data including applications from Slack
    const { data: basicLeaves, error: basicLeavesError } = await supabaseClient
      .from('leave_applied_users')
      .select('*')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);

    if (basicLeavesError) {
      console.error('❌ Error fetching basic leaves:', basicLeavesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leaves data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`📋 Found ${basicLeaves?.length || 0} basic leave records`);

    // Enhanced leaves with user and leave type data
    const leaves = [];
    
    if (basicLeaves && basicLeaves.length > 0) {
      for (const leave of basicLeaves) {
        const enhancedLeave = { ...leave };
        
        // Get user profile
        if (leave.user_id) {
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('name')
            .eq('id', leave.user_id)
            .single();
          enhancedLeave.profiles = profile;
        }
        
        // Get leave type
        if (leave.leave_type_id) {
          const { data: leaveType } = await supabaseClient
            .from('leave_types')
            .select('label, color')
            .eq('id', leave.leave_type_id)
            .single();
          enhancedLeave.leave_types = leaveType;
        }
        
        leaves.push(enhancedLeave);
      }
    }

    console.log(`📋 Found ${leaves?.length || 0} approved leaves for today`);

    // Random greeting messages with personalized emojis
    const getRandomGreeting = () => {
      const greetings = [
        "Morning, Groto family…",
        "Good morning, lovely team…",
        "Hello there, wonderful humans…",
        "Rise and shine, Groto stars…",
        "Hey there, amazing crew…",
        "Good morning, fantastic folks…",
        "Morning vibes, dear team…",
        "Sunshine greetings, Groto gang…"
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    };

    const getRandomEmojis = () => {
      const emojiSets = [
        "💌 or a ☀️",
        "💌 or a 🌟",
        "❤️ or a 🌈",
        "💌 or a ✨",
        "🤗 or a 🌻",
        "💌 or a 🎉",
        "💛 or a 🌙",
        "💌 or a 🦋"
      ];
      return emojiSets[Math.floor(Math.random() * emojiSets.length)];
    };

    const randomGreeting = getRandomGreeting();
    const randomEmojis = getRandomEmojis();

    // Create Slack message with personal tone
    let message;
    
    if (!leaves || leaves.length === 0) {
      const noLeavesMessages = [
        "🎉 *All hands on deck today!* Everyone's here and ready to make magic happen. Let's crush those goals together! 💪✨",
        "🚀 *Full squad assembled!* All our amazing team members are here today. Time to make some incredible things happen! 🌟",
        "💯 *Perfect attendance today!* Everyone's in the building and ready to rock. Let's make it an awesome day! 🎯",
        "⭐ *Team complete!* All our wonderful people are here today. Ready to conquer the world together! 🌍",
        "🔥 *All stars present!* Nobody's missing today - time to shine bright and make magic! ✨"
      ];
      const randomMessage = noLeavesMessages[Math.floor(Math.random() * noLeavesMessages.length)];

      message = {
        channel: allUsersChannelId,
        text: `${randomGreeting} - ${todayFormatted}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${randomGreeting}\n\n${randomMessage}`
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
      // Create personalized leave message
      const leaveDetails = leaves.map(leave => {
        const name = leave.profiles?.name || 'Unknown';
        const leaveType = leave.leave_types?.label || 'Leave';
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        return `• *${name}* - ${leaveType}, ${daysDiff} day${daysDiff > 1 ? 's' : ''} on leave`;
      }).join('\n');

      const leaveMessages = [
        "Today our circle's a little quieter and the coffee's a little colder—our dear friends are out recharging their batteries. Let's send warm thoughts their way:",
        "Our workspace feels a bit different today as some of our wonderful teammates are taking well-deserved time off. Let's show them some love:",
        "The office vibes are a little more mellow today with some of our amazing crew recharging. Time to send good energy their way:",
        "Today's a bit more peaceful as some of our fantastic team members are enjoying their time away. Let's brighten their day:",
        "Our amazing family is spread out a bit today with some members taking their much-needed break. Let's send them virtual hugs:"
      ];
      const randomLeaveMessage = leaveMessages[Math.floor(Math.random() * leaveMessages.length)];

      const endingMessages = [
        `Drop a ${randomEmojis} in the thread to let them know we miss them and can't wait to have them back. 🥺✨`,
        `Send a ${randomEmojis} their way to remind them how much they're missed! 💕`,
        `Share a ${randomEmojis} to show them some love and let them know we're thinking of them! 🤗`,
        `Leave a ${randomEmojis} to brighten their day and remind them they're valued! 🌈`,
        `Drop a ${randomEmojis} to send them warm vibes and let them know we care! 💖`
      ];
      const randomEnding = endingMessages[Math.floor(Math.random() * endingMessages.length)];

      message = {
        channel: allUsersChannelId,
        text: `${randomGreeting} - ${todayFormatted}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${randomGreeting}\n\n${randomLeaveMessage}\n\n${leaveDetails}\n\n${randomEnding}`
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
    }

    // Send message to Slack with retry logic
    console.log('📤 Sending daily notification to Slack');
    
    let slackResult;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📡 Attempt ${attempts}/${maxAttempts} to send Slack message`);
      
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

        slackResult = await slackResponse.json();
        console.log('📬 Slack response:', JSON.stringify(slackResult, null, 2));
        
        if (slackResult.ok) {
          break; // Success, exit retry loop
        } else {
          console.warn(`⚠️ Slack API error (attempt ${attempts}):`, slackResult.error);
          if (attempts < maxAttempts && slackResult.error !== 'invalid_auth' && slackResult.error !== 'channel_not_found') {
            // Wait before retry (except for auth/channel errors which won't be fixed by retry)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            continue;
          }
        }
      } catch (fetchError) {
        console.error(`❌ Network error (attempt ${attempts}):`, fetchError.message);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          continue;
        }
        throw fetchError;
      }
    }

    if (!slackResult || !slackResult.ok) {
      const errorMsg = slackResult?.error || 'Unknown error';
      console.error('❌ Failed to send Slack message after all attempts:', errorMsg);
      
      // Provide specific error messages for common issues
      let userFriendlyError = errorMsg;
      switch (errorMsg) {
        case 'invalid_auth':
          userFriendlyError = 'Invalid Slack bot token. Please check your SLACK_BOT_TOKEN secret.';
          break;
        case 'channel_not_found':
          userFriendlyError = 'Slack channel not found. Please check your SLACK_ALL_USERS_CHANNEL_ID secret.';
          break;
        case 'not_in_channel':
          userFriendlyError = 'Bot is not in the specified channel. Please add the bot to the channel.';
          break;
        case 'missing_scope':
          userFriendlyError = 'Bot missing required permissions. Please add chat:write scope to your bot.';
          break;
      }
      
      return new Response(
        JSON.stringify({ error: `Slack error: ${userFriendlyError}` }),
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
