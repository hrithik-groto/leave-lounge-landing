
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to check if user is admin
const isUserAdmin = async (supabaseClient: any, userId: string) => {
  const { data, error } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.log('Error checking admin status:', error);
    return false;
  }
  
  return data?.role === 'admin';
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

    const formData = await req.formData();
    const command = formData.get('command');
    const userId = formData.get('user_id');
    const channelId = formData.get('channel_id');

    console.log('Received command:', command, 'from user:', userId);

    // Use the latest bot token
    const botToken = 'xoxe.xoxb-1-MS0yLTIyMTk5NjM5MTMyNzEtOTA4MTEzMjM2MzY5Ny05MDgxMTMyNjMwNTc3LTkyNDk3NzIxOTA1ODItZmZjZTQyZjAyYzU5ZDIwY2NiMmE3OTNjNzk5ZmM2NmRjNmNmMDVlYTFiMDUyNGEzYjljODE0NDg4ZTY5M2RiOQ';

    if (command === '/timeloo') {
      // Check if user is admin for admin-only features
      const userIsAdmin = await isUserAdmin(supabaseClient, 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');
      
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🌟 *Welcome to Timeloo!* 🌟\n\nYour all-in-one leave management solution. Choose an option below:'
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📝 *Apply for Leave*\nSubmit a new leave request with just a few clicks!'
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Apply for Leave',
              emoji: true
            },
            action_id: 'apply_leave',
            style: 'primary'
          }
        }
      ];

      // Add admin-only features if user is admin
      if (userIsAdmin) {
        blocks.push(
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '👨‍💼 *Admin: Review Requests*\nReview and approve/reject pending leave requests.'
            },
            accessory: {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Review Requests',
                emoji: true
              },
              action_id: 'admin_review_requests',
              style: 'danger'
            }
          }
        );
      }

      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `✨ You are logged in as ${userIsAdmin ? 'Admin' : 'User'} | Need help? Contact your admin team.`
            }
          ]
        }
      );

      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        blocks: blocks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: 'Unknown command'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error processing Slack command:', error);
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: 'Sorry, there was an error processing your request.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
