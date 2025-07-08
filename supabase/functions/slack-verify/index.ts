import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SLACK VERIFY REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        message: 'Slack verification endpoint working',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }

  // Handle Slack URL verification challenge
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log('Raw body:', body);
      
      const data = JSON.parse(body);
      console.log('Parsed data:', data);
      
      if (data.type === 'url_verification') {
        console.log('URL verification challenge received:', data.challenge);
        return new Response(data.challenge, {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          status: 200
        });
      }
      
      return new Response('OK', { 
        headers: corsHeaders, 
        status: 200 
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response('Error', { 
        headers: corsHeaders, 
        status: 500 
      });
    }
  }

  return new Response('Method not allowed', { 
    headers: corsHeaders, 
    status: 405 
  });
});