
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = "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";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, gameMode = false } = await req.json();
    console.log('Received chatbot request:', { message, gameMode });

    const systemPrompt = `You are Timeloo's friendly AI assistant! 🤖 You help users with their leave management needs and provide fun mini-games.

PERSONALITY:
- Be playful, enthusiastic, and helpful
- Use emojis frequently 
- Keep responses concise but engaging
- Always stay positive and encouraging

TIMELOO KNOWLEDGE:
- Timeloo is a leave management platform
- Users can apply for leaves, view their leave balance, get approvals
- Admins can approve/reject leave requests
- Integration with Slack for notifications
- Features include calendar view, leave history, team insights

AVAILABLE MINI-GAMES:
1. 🎯 Number Guessing Game - "Let's play guess the number!"
2. 🎲 Dice Roll - "Want to roll some dice?"
3. 🧩 Riddles - "I have a riddle for you!"
4. 📝 Word Association - "Let's play word association!"
5. 🎪 Fun Facts - "Want to hear a fun fact?"

When users ask about games, offer these options. For game interactions, be interactive and maintain game state through conversation.

HELP TOPICS:
- How to apply for leave
- How to cancel leave requests  
- Checking leave balance
- Understanding approval process
- Using the calendar feature
- Getting help from admins

Always end responses with a helpful suggestion or question to keep the conversation going!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const botResponse = data.choices[0].message.content;

    console.log('Generated bot response:', botResponse);

    return new Response(JSON.stringify({ 
      response: botResponse,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in timeloo-chatbot function:', error);
    return new Response(JSON.stringify({ 
      error: 'Sorry, I encountered an error. Please try again! 🤖',
      response: "Oops! Something went wrong on my end. Let me know how I can help you with Timeloo! 😊"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
