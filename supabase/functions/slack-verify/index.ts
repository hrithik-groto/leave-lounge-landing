import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    console.log('=== SLACK VERIFY REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));

    if (req.method === 'GET') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Slack verification endpoint working',
        timestamp: new Date().toISOString()
      }), { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      });
    }

    if (req.method === 'POST') {
      const body = await req.text();
      console.log('Raw body received:', body);
      
      if (!body) {
        console.error('Empty body received');
        return new Response('Empty body', { status: 400 });
      }
      
      let data;
      try {
        data = JSON.parse(body);
        console.log('Parsed JSON data:', JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('JSON parse error:', error.message);
        return new Response('Invalid JSON', { status: 400 });
      }
      
      if (data.type === 'url_verification') {
        const challenge = data.challenge;
        console.log('URL verification challenge:', challenge);
        
        if (!challenge) {
          console.error('No challenge in verification request');
          return new Response('No challenge provided', { status: 400 });
        }
        
        console.log('Returning challenge:', challenge);
        return new Response(challenge, {
          headers: { 'Content-Type': 'text/plain' },
          status: 200
        });
      }
      
      console.log('Other POST request type:', data.type);
      return new Response('OK', { status: 200 });
    }
    
    return new Response('Method not allowed', { status: 405 });
    
  } catch (error) {
    console.error('Unexpected error:', error.message, error.stack);
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
});