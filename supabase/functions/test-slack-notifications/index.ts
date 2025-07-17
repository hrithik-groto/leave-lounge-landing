import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('🧪 Testing Slack notifications...');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const botToken = Deno.env.get('SLACK_BOT_TOKEN');
    const adminChannelId = 'C0920F0V7PW';
    const allUsersChannelId = 'C095J2588Q5';

    if (!botToken) {
      console.error('❌ Missing SLACK_BOT_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Missing SLACK_BOT_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('🔑 Bot token format valid:', botToken.startsWith('xoxb-') || botToken.startsWith('xoxe.xoxb-'));

    const results = [];

    // Test 1: Admin Channel Notification for Leave Approval
    console.log('🧪 Test 1: Admin channel notification for leave approval');
    try {
      const adminTestMessage = {
        channel: adminChannelId,
        text: "✅ Test: Leave Application Approved",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Test: Leave Application Approved"
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Employee:*\nTest User"
              },
              {
                type: "mrkdwn",
                text: "*Email:*\ntest@example.com"
              },
              {
                type: "mrkdwn",
                text: "*Leave Type:*\nPaid Leave"
              },
              {
                type: "mrkdwn",
                text: "*Duration:*\n1 day"
              }
            ]
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*From:*\nToday"
              },
              {
                type: "mrkdwn",
                text: "*To:*\nToday"
              }
            ]
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Status:* ✅ Approved | *Decision Made:* " + new Date().toLocaleString()
              }
            ]
          }
        ]
      };

      const adminResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminTestMessage),
      });

      const adminData = await adminResponse.json();
      
      if (adminData.ok) {
        console.log('✅ Admin channel test PASSED');
        results.push({ test: 'admin_channel', status: 'PASSED', message: 'Admin channel notification sent successfully' });
      } else {
        console.error('❌ Admin channel test FAILED:', adminData.error);
        results.push({ test: 'admin_channel', status: 'FAILED', error: adminData.error });
      }
    } catch (error) {
      console.error('❌ Admin channel test ERROR:', error);
      results.push({ test: 'admin_channel', status: 'ERROR', error: error.message });
    }

    // Test 2: All Users Channel Notification for Approved Leave
    console.log('🧪 Test 2: All users channel notification for approved leave');
    try {
      const allUsersTestMessage = {
        channel: allUsersChannelId,
        text: "🎉 Test: Team member on approved leave",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "🎉 Hey Groto family!\n\n*Test User* has been approved for *Paid Leave* today — 1 day ✅ approved.\n\nLet's make sure they can disconnect peacefully! 🌸✨"
            }
          },
          {
            type: "divider"
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "📱 Powered by Timeloo • Test notification"
              }
            ]
          }
        ]
      };

      const allUsersResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allUsersTestMessage),
      });

      const allUsersData = await allUsersResponse.json();
      
      if (allUsersData.ok) {
        console.log('✅ All users channel test PASSED');
        results.push({ test: 'all_users_channel', status: 'PASSED', message: 'All users channel notification sent successfully' });
      } else {
        console.error('❌ All users channel test FAILED:', allUsersData.error);
        results.push({ test: 'all_users_channel', status: 'FAILED', error: allUsersData.error });
      }
    } catch (error) {
      console.error('❌ All users channel test ERROR:', error);
      results.push({ test: 'all_users_channel', status: 'ERROR', error: error.message });
    }

    // Test 3: Personal DM to Admin (simulating user notification)
    console.log('🧪 Test 3: Personal DM notification test');
    try {
      // For this test, we'll try to send a DM to the admin (you) to test personal notifications
      // In a real scenario, this would go to the user who had their leave approved/rejected
      const { data: adminSlackIntegration } = await supabase
        .from('user_slack_integrations')
        .select('slack_user_id')
        .eq('user_id', 'user_2xwywE2Bl76vs7l68dhj6nIcCPV')
        .single();

      if (adminSlackIntegration?.slack_user_id) {
        const personalTestMessage = {
          channel: adminSlackIntegration.slack_user_id,
          text: "🧪 Test: Personal leave notification",
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🧪 Test: Leave Request Approved!',
                emoji: true
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Your *Test Leave* request has been approved by your manager! 🎊\n\nThis is a test notification to verify personal DMs are working.`
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '📱 Test notification from Timeloo'
                }
              ]
            }
          ]
        };

        const personalResponse = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(personalTestMessage),
        });

        const personalData = await personalResponse.json();
        
        if (personalData.ok) {
          console.log('✅ Personal DM test PASSED');
          results.push({ test: 'personal_dm', status: 'PASSED', message: 'Personal DM notification sent successfully' });
        } else {
          console.error('❌ Personal DM test FAILED:', personalData.error);
          results.push({ test: 'personal_dm', status: 'FAILED', error: personalData.error });
        }
      } else {
        console.log('⚠️ No Slack integration found for admin user - skipping personal DM test');
        results.push({ test: 'personal_dm', status: 'SKIPPED', message: 'No Slack integration found for test user' });
      }
    } catch (error) {
      console.error('❌ Personal DM test ERROR:', error);
      results.push({ test: 'personal_dm', status: 'ERROR', error: error.message });
    }

    // Test 4: Mid-day notification simulation
    console.log('🧪 Test 4: Mid-day notification simulation');
    try {
      const { error: middayError } = await supabase.functions.invoke('slack-midday-notifications');
      
      if (middayError) {
        console.error('❌ Mid-day notification test FAILED:', middayError);
        results.push({ test: 'midday_notifications', status: 'FAILED', error: middayError.message });
      } else {
        console.log('✅ Mid-day notification test PASSED');
        results.push({ test: 'midday_notifications', status: 'PASSED', message: 'Mid-day notifications function called successfully' });
      }
    } catch (error) {
      console.error('❌ Mid-day notification test ERROR:', error);
      results.push({ test: 'midday_notifications', status: 'ERROR', error: error.message });
    }

    const summary = {
      total_tests: results.length,
      passed: results.filter(r => r.status === 'PASSED').length,
      failed: results.filter(r => r.status === 'FAILED').length,
      errors: results.filter(r => r.status === 'ERROR').length,
      skipped: results.filter(r => r.status === 'SKIPPED').length,
      results: results
    };

    console.log('🧪 Test Summary:', summary);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Slack notification tests completed',
        summary: summary
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error running Slack notification tests:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});