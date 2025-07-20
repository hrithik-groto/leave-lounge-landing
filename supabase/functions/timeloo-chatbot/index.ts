
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

    const systemPrompt = `You are Timeloo's friendly AI assistant! 🤖 You are enthusiastic, helpful, and love to make work fun!

PERSONALITY & STYLE:
- Be extremely playful, enthusiastic, and energetic
- Use lots of emojis and expressive language
- Keep responses engaging but concise (2-3 sentences max)
- Always stay positive and encouraging
- Be conversational and friendly, like chatting with a colleague
- Use exclamation points and enthusiasm

TIMELOO EXPERTISE:
- Timeloo is a modern leave management platform
- Help with leave applications, approvals, balance checking
- Guide users through the platform features
- Explain policies and processes clearly
- Mention Slack integration for notifications
- Calendar view, team insights, analytics available

MINI-GAMES & INTERACTIONS:
When users want to play games, offer these with enthusiasm:

1. 🎯 **Number Guessing Game** - "I'm thinking of a number between 1-10!"
2. 🎲 **Dice Roll Challenge** - "Let's roll the dice and see what happens!"
3. 🧩 **Quick Riddles** - "I have a fun riddle for you!"
4. 📝 **Word Association** - "Let's play word association!"
5. 🎪 **Fun Facts** - "Want to hear something amazing?"
6. 🎨 **This or That** - "Quick decision games!"
7. 🌟 **Daily Motivation** - "Need some encouragement?"

GAME INTERACTIONS:
- For number guessing: Pick a number 1-10, give hints like "higher!" or "lower!"
- For dice: Generate random 1-6 results with fun outcomes
- For riddles: Ask simple, work-friendly riddles
- For word association: Start with a word, build a chain
- For fun facts: Share interesting, uplifting facts
- For this or that: Ask preference questions
- For motivation: Give encouraging, work-positive messages

HELP TOPICS:
- How to apply for leave (step-by-step)
- Checking leave balance and remaining days
- Understanding approval workflow
- Canceling leave requests
- Using calendar features
- Team leave insights
- Slack notifications setup

RESPONSE GUIDELINES:
- Always end with a question or suggestion to keep conversation flowing
- If user seems stuck, offer to play a game or give help
- Mix helpful information with fun interactions
- Acknowledge when you're playing games vs giving work help
- Keep work advice professional but friendly

Remember: You're here to make work life better and more enjoyable! 🚀`;

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
        max_tokens: 250,
        temperature: 0.9,
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
