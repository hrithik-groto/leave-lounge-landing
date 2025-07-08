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
      const contentType = req.headers.get('content-type') || '';
      console.log('Content-Type:', contentType);
      
      const body = await req.text();
      console.log('Raw body:', body);
      
      if (!body) {
        console.log('No body received');
        return new Response('No body', { 
          headers: corsHeaders, 
          status: 400 
        });
      }
      
      let data;
      try {
        data = JSON.parse(body);
        console.log('Parsed data:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return new Response('Invalid JSON', { 
          headers: corsHeaders, 
          status: 400 
        });
      }
      
      if (data.type === 'url_verification') {
        console.log('URL verification challenge received:', data.challenge);
        
        if (!data.challenge) {
          console.error('No challenge in verification request');
          return new Response('No challenge provided', { 
            headers: corsHeaders, 
            status: 400 
          });
        }
        
        // Return the challenge value as plain text
        return new Response(data.challenge, {
          headers: { 
            'Content-Type': 'text/plain',
            ...corsHeaders 
          },
          status: 200
        });
      }
      
      console.log('Non-verification request received:', data.type);
      return new Response('OK', { 
        headers: corsHeaders, 
        status: 200 
      });
      
    } catch (error) {
      console.error('Error processing request:', error);
      return new Response(`Error: ${error.message}`, { 
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