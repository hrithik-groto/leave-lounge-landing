import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle Slack challenge for URL verification
    const body = await req.json();
    
    if (body.challenge) {
      console.log('Received Slack challenge verification');
      return new Response(body.challenge, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // Handle other event types if needed
    console.log('Received Slack event:', body.type);
    
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in slack-verify function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});