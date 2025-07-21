
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Game data and logic
const GAMES = {
  funFact: {
    facts: [
      "🐙 Octopuses have three hearts and blue blood!",
      "🌙 A day on Venus is longer than its year!",
      "🐧 Penguins can't taste sweet, sour, or spicy foods!",
      "🍯 Honey never spoils - archaeologists have found edible honey in ancient Egyptian tombs!",
      "🦒 Giraffes only need 5-30 minutes of sleep per day!",
      "🌊 More people have been to space than to the deepest part of the ocean!",
      "🐝 Bees can recognize human faces!",
      "🧠 Your brain uses about 20% of your body's energy!",
      "🐳 Blue whales' hearts are so big that a human could crawl through their arteries!",
      "⚡ Lightning strikes the Earth about 100 times per second!",
      "🌟 The human body contains about 37 trillion cells!",
      "🐢 Sea turtles can live for over 100 years!",
      "🌈 There are more possible games of chess than atoms in the observable universe!",
      "🦆 Ducks have waterproof feathers!",
      "🔥 The hottest place on Earth is in laboratory - over 4 trillion degrees Celsius!"
    ]
  },
  riddle: {
    riddles: [
      { question: "What has keys but no locks, and space but no room?", answer: "keyboard" },
      { question: "What goes up but never comes down?", answer: "age" },
      { question: "What has hands but cannot clap?", answer: "clock" },
      { question: "What can travel around the world while staying in a corner?", answer: "stamp" },
      { question: "What has one eye but cannot see?", answer: "needle" },
      { question: "What gets wetter the more it dries?", answer: "towel" },
      { question: "What has a head and a tail but no body?", answer: "coin" },
      { question: "What can you catch but not throw?", answer: "cold" },
      { question: "What has many teeth but cannot bite?", answer: "zipper" },
      { question: "What runs but never walks?", answer: "water" },
      { question: "What is always in front of you but can't be seen?", answer: "future" },
      { question: "What breaks but never falls?", answer: "dawn" },
      { question: "What falls but never breaks?", answer: "night" },
      { question: "What has a bottom at the top?", answer: "leg" },
      { question: "What gets sharper the more you use it?", answer: "brain" }
    ]
  },
  math: {
    problems: [
      { question: "15 + 27 = ?", answer: "42" },
      { question: "8 × 9 = ?", answer: "72" },
      { question: "144 ÷ 12 = ?", answer: "12" },
      { question: "23 - 15 = ?", answer: "8" },
      { question: "What's 20% of 80?", answer: "16" },
      { question: "7² = ?", answer: "49" },
      { question: "√64 = ?", answer: "8" },
      { question: "25 × 4 = ?", answer: "100" },
      { question: "100 - 37 = ?", answer: "63" },
      { question: "6 × 8 = ?", answer: "48" },
      { question: "12 + 18 = ?", answer: "30" },
      { question: "5³ = ?", answer: "125" },
      { question: "What's 15% of 60?", answer: "9" },
      { question: "45 ÷ 9 = ?", answer: "5" },
      { question: "13 × 3 = ?", answer: "39" }
    ]
  }
};

// Timeloo-specific knowledge base
const TIMELOO_KNOWLEDGE = {
  features: [
    "Leave application and approval system",
    "Calendar integration for tracking time off",
    "Slack integration for notifications",
    "Dashboard for HR management",
    "Automated email notifications",
    "Leave balance tracking",
    "Team leave visibility",
    "Multiple leave types support"
  ],
  leaveTypes: [
    "Paid Leave - 1.5 days per month",
    "Work From Home - 2 days per month", 
    "Short Leave - 4 hours per month",
    "Sick Leave - As needed",
    "Emergency Leave - As needed"
  ],
  helpTopics: [
    "How to apply for leave",
    "Checking leave balance",
    "Leave approval process",
    "Calendar integration",
    "Slack notifications setup",
    "Leave policies and types"
  ]
};

// Game state management
const gameStates = new Map();

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getUserGameState(userId: string, gameType: string) {
  const key = `${userId}_${gameType}`;
  if (!gameStates.has(key)) {
    gameStates.set(key, {
      currentQuestion: null,
      score: 0,
      usedQuestions: new Set(),
      gameType: gameType
    });
  }
  return gameStates.get(key);
}

function generateResponse(message: string, userId: string, category?: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Context-aware responses based on category
  if (category === 'timeloo') {
    return handleTimelooQueries(lowerMessage);
  }
  
  if (category === 'leave') {
    return handleLeaveQueries(lowerMessage);
  }
  
  if (category === 'games') {
    return handleGameQueries(lowerMessage, userId);
  }
  
  // Timeloo-specific queries
  if (lowerMessage.includes('timeloo') || lowerMessage.includes('leave management') || lowerMessage.includes('features')) {
    return handleTimelooQueries(lowerMessage);
  }
  
  // Leave-related queries
  if (lowerMessage.includes('leave') || lowerMessage.includes('vacation') || lowerMessage.includes('time off')) {
    return handleLeaveQueries(lowerMessage);
  }
  
  // Handle fun fact requests
  if (lowerMessage.includes('fun fact') || lowerMessage.includes('fact')) {
    const fact = getRandomElement(GAMES.funFact.facts);
    return `Here's a fun fact for you: ${fact}`;
  }
  
  // Handle riddle requests
  if (lowerMessage.includes('riddle')) {
    const state = getUserGameState(userId, 'riddle');
    const availableRiddles = GAMES.riddle.riddles.filter(r => !state.usedQuestions.has(r.question));
    
    let riddle;
    if (availableRiddles.length === 0) {
      state.usedQuestions.clear();
      riddle = getRandomElement(GAMES.riddle.riddles);
    } else {
      riddle = getRandomElement(availableRiddles);
    }
    
    state.currentQuestion = riddle;
    state.usedQuestions.add(riddle.question);
    
    return `🧩 Here's a riddle for you:\n\n${riddle.question}\n\nThink carefully and give me your answer! 🤔`;
  }
  
  // Handle math problem requests
  if (lowerMessage.includes('math') || lowerMessage.includes('problem')) {
    const state = getUserGameState(userId, 'math');
    const availableProblems = GAMES.math.problems.filter(p => !state.usedQuestions.has(p.question));
    
    let problem;
    if (availableProblems.length === 0) {
      state.usedQuestions.clear();
      problem = getRandomElement(GAMES.math.problems);
    } else {
      problem = getRandomElement(availableProblems);
    }
    
    state.currentQuestion = problem;
    state.usedQuestions.add(problem.question);
    
    return `🔢 Here's a math problem for you:\n\n${problem.question}\n\nSolve it and give me your answer! ⚡`;
  }
  
  // Check game answer validations
  const gameResponse = checkGameAnswers(message, userId);
  if (gameResponse) return gameResponse;
  
  // Handle greetings
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return "Hello there! 👋 I'm Timeloo, your intelligent workplace assistant! I can help you with leave management, play games, share fun facts, or answer questions about Timeloo features. What would you like to explore today?";
  }
  
  // Handle what can you do
  if (lowerMessage.includes('what can you do') || lowerMessage.includes('help') || lowerMessage.includes('capabilities')) {
    return "I'm your smart workplace assistant! Here's what I can help you with:\n\n🏢 **Timeloo Features**: Learn about leave management, calendar integration, and more\n📅 **Leave Help**: Apply for leave, check balances, understand policies\n🎮 **Games**: Play riddles, math problems, or get fun facts\n💡 **Smart Conversations**: Ask me anything and I'll do my best to help!\n\nJust ask me anything or use the menu options to get started!";
  }
  
  // Handle gratitude
  if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
    return "You're very welcome! 😊 I'm always here to help with your workplace needs. Feel free to ask me about Timeloo features, apply for leave, or play some games to brighten your day!";
  }
  
  // Intelligent default responses
  const defaultResponses = [
    "I'm here to help! I can assist you with Timeloo features, leave management, games, or general questions. What would you like to know about? 🤖",
    "Hi there! I'm Timeloo, your workplace assistant. I can help you with leave applications, share fun facts, play games, or answer questions about our platform. How can I assist you today? ✨",
    "Hello! I'm ready to help you with anything related to Timeloo, leave management, or just have a friendly chat. What's on your mind? 😊"
  ];
  
  return getRandomElement(defaultResponses);
}

function handleTimelooQueries(message: string): string {
  if (message.includes('feature')) {
    return `🏢 **Timeloo Features:**\n\n${TIMELOO_KNOWLEDGE.features.map(f => `• ${f}`).join('\n')}\n\nTimeloo is your complete workplace leave management solution! Would you like to know more about any specific feature?`;
  }
  
  if (message.includes('about') || message.includes('what is')) {
    return "🚀 **About Timeloo:**\n\nTimeloo is a comprehensive leave management platform designed to streamline your workplace time-off processes. We offer automated leave applications, approval workflows, calendar integration, Slack notifications, and much more!\n\nOur mission is to make leave management simple, transparent, and efficient for both employees and managers. What would you like to know more about?";
  }
  
  return "I can help you with Timeloo features, leave management, integrations, and more! What specific aspect would you like to explore?";
}

function handleLeaveQueries(message: string): string {
  if (message.includes('apply') || message.includes('request')) {
    return "📝 **How to Apply for Leave:**\n\n1. Go to your Timeloo dashboard\n2. Click 'Apply for Leave'\n3. Select your leave type and dates\n4. Add a reason/description\n5. Submit for approval\n\nYour manager will be notified automatically! Need help with leave types or policies?";
  }
  
  if (message.includes('balance') || message.includes('remaining')) {
    return "📊 **Leave Balance Information:**\n\nYour monthly leave allowances:\n• Paid Leave: 1.5 days\n• Work From Home: 2 days\n• Short Leave: 4 hours\n\nCheck your dashboard for current balances and used leave. Want to know more about leave policies?";
  }
  
  if (message.includes('types') || message.includes('policy')) {
    return `📋 **Leave Types & Policies:**\n\n${TIMELOO_KNOWLEDGE.leaveTypes.map(lt => `• ${lt}`).join('\n')}\n\nEach leave type has specific rules and approval processes. Need help with a specific leave type?`;
  }
  
  if (message.includes('approval') || message.includes('manager')) {
    return "✅ **Leave Approval Process:**\n\n1. Submit your leave request\n2. Manager gets instant notification\n3. Manager reviews and approves/rejects\n4. You get notified of the decision\n5. Approved leaves appear in team calendar\n\nThe process is designed to be quick and transparent! Any questions about the approval workflow?";
  }
  
  return "I can help you with leave applications, checking balances, understanding policies, or the approval process. What would you like to know?";
}

function handleGameQueries(message: string, userId: string): string {
  if (message.includes('play') || message.includes('games')) {
    return "🎮 **Let's Play!**\n\nI have several fun games for you:\n\n🧩 **Riddles** - Challenge your mind with brain teasers\n🔢 **Math Problems** - Quick calculations to keep you sharp\n💡 **Fun Facts** - Learn amazing things about our world\n\nJust say 'riddle', 'math problem', or 'fun fact' to start playing! Which one sounds fun to you?";
  }
  
  return generateResponse(message, userId);
}

function checkGameAnswers(message: string, userId: string): string | null {
  // Check if user is answering a riddle
  const riddleState = getUserGameState(userId, 'riddle');
  if (riddleState.currentQuestion && riddleState.gameType === 'riddle') {
    const userAnswer = message.trim().toLowerCase();
    const correctAnswer = riddleState.currentQuestion.answer.toLowerCase();
    
    if (userAnswer === correctAnswer || userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
      riddleState.score++;
      riddleState.currentQuestion = null;
      return `🎯 Excellent! The answer is "${correctAnswer}"!\n\nYour riddle score: ${riddleState.score}\n\nWant another riddle? Just say "riddle"! 🧩`;
    } else {
      riddleState.currentQuestion = null;
      return `🤔 Nice try! The answer was "${correctAnswer}".\n\nYour riddle score: ${riddleState.score}\n\nLet's try another riddle! Say "riddle"! 🧩`;
    }
  }
  
  // Check if user is answering a math problem
  const mathState = getUserGameState(userId, 'math');
  if (mathState.currentQuestion && mathState.gameType === 'math') {
    const userAnswer = message.trim();
    const correctAnswer = mathState.currentQuestion.answer;
    
    if (userAnswer === correctAnswer) {
      mathState.score++;
      mathState.currentQuestion = null;
      return `🎯 Correct! The answer is ${correctAnswer}!\n\nYour math score: ${mathState.score}\n\nReady for another problem? Just say "math problem"! 🔢`;
    } else {
      mathState.currentQuestion = null;
      return `❌ Not quite! The correct answer was ${correctAnswer}.\n\nYour math score: ${mathState.score}\n\nLet's try another one! Say "math problem"! 💪`;
    }
  }
  
  return null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, category } = await req.json();
    
    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = generateResponse(message, userId, category);

    return new Response(
      JSON.stringify({ response }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in timeloo-chatbot function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        response: 'Sorry, I encountered an error. Please try again! 😅' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
