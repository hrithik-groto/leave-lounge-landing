
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Game responses and logic
const GAMES = {
  trivia: {
    questions: [
      { question: "What's the largest planet in our solar system?", answer: "Jupiter", options: ["Earth", "Jupiter", "Saturn", "Mars"] },
      { question: "Which country invented pizza?", answer: "Italy", options: ["Greece", "Italy", "France", "Spain"] },
      { question: "What's the fastest land animal?", answer: "Cheetah", options: ["Lion", "Cheetah", "Leopard", "Tiger"] },
      { question: "How many sides does a hexagon have?", answer: "6", options: ["5", "6", "7", "8"] },
      { question: "What's the capital of Australia?", answer: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Perth"] },
      { question: "Which element has the symbol 'O'?", answer: "Oxygen", options: ["Gold", "Silver", "Oxygen", "Iron"] },
      { question: "What year did the Titanic sink?", answer: "1912", options: ["1910", "1912", "1914", "1916"] },
      { question: "What's the smallest ocean?", answer: "Arctic", options: ["Atlantic", "Indian", "Arctic", "Pacific"] },
      { question: "How many bones are in an adult human body?", answer: "206", options: ["196", "206", "216", "226"] },
      { question: "What's the largest mammal in the world?", answer: "Blue Whale", options: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"] }
    ]
  },
  riddles: {
    riddles: [
      { question: "What has keys but no locks, and space but no room?", answer: "A keyboard" },
      { question: "What goes up but never comes down?", answer: "Your age" },
      { question: "What has hands but cannot clap?", answer: "A clock" },
      { question: "What can travel around the world while staying in a corner?", answer: "A stamp" },
      { question: "What has one eye but cannot see?", answer: "A needle" },
      { question: "What gets wetter the more it dries?", answer: "A towel" },
      { question: "What has a head and a tail but no body?", answer: "A coin" },
      { question: "What can you catch but not throw?", answer: "A cold" },
      { question: "What has many teeth but cannot bite?", answer: "A zipper" },
      { question: "What runs but never walks?", answer: "Water" }
    ]
  },
  'word-association': {
    chains: [
      ["Ocean", "Wave", "Surfer", "Beach", "Sand"],
      ["Mountain", "Snow", "Ski", "Winter", "Cold"],
      ["Forest", "Tree", "Bird", "Nest", "Egg"],
      ["City", "Building", "Office", "Work", "Computer"],
      ["Garden", "Flower", "Bee", "Honey", "Sweet"],
      ["Space", "Star", "Light", "Sun", "Day"],
      ["Book", "Story", "Adventure", "Journey", "Travel"],
      ["Music", "Dance", "Party", "Friends", "Fun"],
      ["Rain", "Cloud", "Sky", "Blue", "Peace"],
      ["Fire", "Heat", "Summer", "Vacation", "Relax"]
    ]
  },
  'math-challenge': {
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
      { question: "6 × 8 = ?", answer: "48" }
    ]
  },
  'would-you-rather': {
    questions: [
      "Would you rather have the ability to fly or be invisible?",
      "Would you rather always be 10 minutes late or 20 minutes early?",
      "Would you rather have unlimited money or unlimited time?",
      "Would you rather be able to read minds or predict the future?",
      "Would you rather live without music or without movies?",
      "Would you rather have a rewind button or a pause button for life?",
      "Would you rather be famous or be the best friend of someone famous?",
      "Would you rather never have to sleep or never have to eat?",
      "Would you rather live in space or underwater?",
      "Would you rather have perfect memory or perfect health?"
    ]
  }
};

const FUN_FACTS = [
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
  "🎵 Music can help plants grow faster!",
  "🐘 Elephants are one of the few animals that can recognize themselves in mirrors!",
  "🌈 There are more possible games of chess than atoms in the universe!",
  "🦋 Butterflies taste with their feet!",
  "🌍 Earth is the only planet not named after a god or goddess!"
];

const WORKPLACE_RESPONSES = [
  "Great question! Here are some tips for better workplace productivity...",
  "That's a common workplace challenge. Here's what I'd suggest...",
  "I understand your work concern. Let me help you with that...",
  "Here's some advice for your professional situation...",
  "That's an important workplace topic. Here's my perspective..."
];

// Game state management
const gameStates = new Map();

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getUserGameState(userId: string, gameType: string) {
  const key = `${userId}_${gameType}`;
  if (!gameStates.has(key)) {
    gameStates.set(key, {
      currentIndex: 0,
      score: 0,
      usedQuestions: new Set(),
      currentChain: [],
      chainIndex: 0
    });
  }
  return gameStates.get(key);
}

function handleTriviaGame(userId: string, message: string) {
  const state = getUserGameState(userId, 'trivia');
  const questions = GAMES.trivia.questions;
  
  // If user is just starting or asking for a question
  if (message.toLowerCase().includes('trivia') || message.toLowerCase().includes('question')) {
    // Find an unused question
    let question;
    let attempts = 0;
    do {
      question = getRandomElement(questions);
      attempts++;
    } while (state.usedQuestions.has(question.question) && attempts < 10);
    
    state.currentQuestion = question;
    state.usedQuestions.add(question.question);
    
    return `🧠 **Trivia Question ${state.usedQuestions.size}**\n\n${question.question}\n\n${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}\n\nJust type your answer (A, B, C, or D)! 🎯`;
  }
  
  // Check if user is answering a question
  if (state.currentQuestion) {
    const userAnswer = message.trim().toLowerCase();
    const correctAnswer = state.currentQuestion.answer.toLowerCase();
    const optionIndex = ['a', 'b', 'c', 'd'].indexOf(userAnswer);
    
    let isCorrect = false;
    if (optionIndex !== -1) {
      isCorrect = state.currentQuestion.options[optionIndex].toLowerCase() === correctAnswer;
    } else {
      isCorrect = userAnswer === correctAnswer;
    }
    
    if (isCorrect) {
      state.score++;
      state.currentQuestion = null;
      return `🎉 Correct! The answer is ${state.currentQuestion?.answer}!\n\nYour score: ${state.score}/${state.usedQuestions.size}\n\nReady for another question? Just say "next question" or "trivia"! 🚀`;
    } else {
      state.currentQuestion = null;
      return `❌ Not quite! The correct answer was ${state.currentQuestion?.answer}.\n\nYour score: ${state.score}/${state.usedQuestions.size}\n\nDon't worry, let's try another one! Say "next question" or "trivia"! 💪`;
    }
  }
  
  return "Let's play trivia! Say 'trivia' or 'question' to get started! 🧠";
}

function handleRiddleGame(userId: string, message: string) {
  const state = getUserGameState(userId, 'riddles');
  const riddles = GAMES.riddles.riddles;
  
  if (message.toLowerCase().includes('riddle') || message.toLowerCase().includes('puzzle')) {
    let riddle;
    let attempts = 0;
    do {
      riddle = getRandomElement(riddles);
      attempts++;
    } while (state.usedQuestions.has(riddle.question) && attempts < 10);
    
    state.currentRiddle = riddle;
    state.usedQuestions.add(riddle.question);
    
    return `🧩 **Riddle ${state.usedQuestions.size}**\n\n${riddle.question}\n\nThink carefully and give me your answer! 🤔`;
  }
  
  if (state.currentRiddle) {
    const userAnswer = message.trim().toLowerCase();
    const correctAnswer = state.currentRiddle.answer.toLowerCase();
    
    if (userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
      state.score++;
      state.currentRiddle = null;
      return `🎯 Excellent! The answer is "${state.currentRiddle?.answer}"!\n\nYour score: ${state.score}/${state.usedQuestions.size}\n\nReady for another riddle? Just say "riddle" or "puzzle"! 🧩`;
    } else {
      state.currentRiddle = null;
      return `🤔 Nice try! The answer was "${state.currentRiddle?.answer}".\n\nYour score: ${state.score}/${state.usedQuestions.size}\n\nLet's try another riddle! Say "riddle" or "puzzle"! 🧩`;
    }
  }
  
  return "Let's solve some riddles! Say 'riddle' or 'puzzle' to get started! 🧩";
}

function handleWordAssociation(userId: string, message: string) {
  const state = getUserGameState(userId, 'word-association');
  const chains = GAMES['word-association'].chains;
  
  if (message.toLowerCase().includes('word association') || message.toLowerCase().includes('association')) {
    const chain = getRandomElement(chains);
    state.currentChain = chain;
    state.chainIndex = 0;
    
    return `🔗 **Word Association Game!**\n\nI'll start with a word, and you give me a related word. Let's see how creative you can be!\n\nStarting word: **${chain[0]}**\n\nWhat word comes to mind? 🤔`;
  }
  
  if (state.currentChain && state.currentChain.length > 0) {
    const userWord = message.trim();
    state.chainIndex++;
    
    if (state.chainIndex < state.currentChain.length) {
      return `${userWord} → ${state.currentChain[state.chainIndex]}\n\nGreat connection! Now, what word do you associate with **${state.currentChain[state.chainIndex]}**? 🔗`;
    } else {
      const finalResponse = `${userWord} → Great final connection! 🎉\n\nOur word chain: ${state.currentChain.join(' → ')} → ${userWord}\n\nThat was fun! Want to start another word association? Just say "word association"! 🔗`;
      state.currentChain = [];
      state.chainIndex = 0;
      return finalResponse;
    }
  }
  
  return "Let's play word association! Say 'word association' to start! 🔗";
}

function handleMathChallenge(userId: string, message: string) {
  const state = getUserGameState(userId, 'math-challenge');
  const problems = GAMES['math-challenge'].problems;
  
  if (message.toLowerCase().includes('math') || message.toLowerCase().includes('problem')) {
    let problem;
    let attempts = 0;
    do {
      problem = getRandomElement(problems);
      attempts++;
    } while (state.usedQuestions.has(problem.question) && attempts < 10);
    
    state.currentProblem = problem;
    state.usedQuestions.add(problem.question);
    
    return `🔢 **Math Challenge ${state.usedQuestions.size}**\n\n${problem.question}\n\nSolve it and give me your answer! ⚡`;
  }
  
  if (state.currentProblem) {
    const userAnswer = message.trim();
    const correctAnswer = state.currentProblem.answer;
    
    if (userAnswer === correctAnswer) {
      state.score++;
      state.currentProblem = null;
      return `🎯 Correct! The answer is ${correctAnswer}!\n\nYour score: ${state.score}/${state.usedQuestions.size}\n\nReady for another math problem? Just say "math" or "problem"! 🔢`;
    } else {
      state.currentProblem = null;
      return `❌ Not quite! The correct answer was ${correctAnswer}.\n\nYour score: ${state.score}/${state.usedQuestions.size}\n\nLet's try another one! Say "math" or "problem"! 💪`;
    }
  }
  
  return "Let's solve some math problems! Say 'math' or 'problem' to get started! 🔢";
}

function handleWouldYouRather(userId: string, message: string) {
  const state = getUserGameState(userId, 'would-you-rather');
  const questions = GAMES['would-you-rather'].questions;
  
  if (message.toLowerCase().includes('would you rather') || message.toLowerCase().includes('rather')) {
    let question;
    let attempts = 0;
    do {
      question = getRandomElement(questions);
      attempts++;
    } while (state.usedQuestions.has(question) && attempts < 10);
    
    state.currentQuestion = question;
    state.usedQuestions.add(question);
    
    return `⚖️ **Would You Rather #${state.usedQuestions.size}**\n\n${question}\n\nTell me your choice and why! I'd love to hear your reasoning! 🤔`;
  }
  
  if (state.currentQuestion) {
    const responses = [
      "Interesting choice! I can see why you'd pick that! 🤔",
      "That's a great perspective! I hadn't thought of it that way! 💭",
      "Fascinating reasoning! You make a compelling argument! 🌟",
      "I love how you think! That's a unique viewpoint! ✨",
      "Great choice! Your reasoning makes perfect sense! 🎯"
    ];
    
    state.currentQuestion = null;
    return `${getRandomElement(responses)}\n\nReady for another dilemma? Just say "would you rather"! ⚖️`;
  }
  
  return "Let's play Would You Rather! Say 'would you rather' to get started! ⚖️";
}

function handleStoryBuilding(userId: string, message: string) {
  const state = getUserGameState(userId, 'story-building');
  
  if (message.toLowerCase().includes('story') || message.toLowerCase().includes('building')) {
    const starters = [
      "Once upon a time, in a mysterious forest, a young explorer discovered a glowing...",
      "In the year 2150, humans discovered that their pet cats were actually...",
      "The old lighthouse keeper noticed something strange about the approaching ship...",
      "When Sarah opened her grandmother's attic, she found a diary that revealed...",
      "The space station's AI suddenly announced: 'We have visitors, and they're not human...'",
      "Detective Johnson received a case file about a library where books were...",
      "In a small town, every Tuesday at exactly 3 PM, something magical happened...",
      "The new employee at the museum didn't know that after midnight, the exhibits...",
      "When the last tree on Earth began to speak, it said...",
      "The time traveler realized they had made a terrible mistake when they saw..."
    ];
    
    state.currentStory = getRandomElement(starters);
    state.storyParts = [state.currentStory];
    
    return `📚 **Story Building Time!**\n\nI'll start our story, and you continue it! Here we go:\n\n"${state.currentStory}"\n\nWhat happens next? Continue the story! ✨`;
  }
  
  if (state.currentStory && state.storyParts) {
    const userContinuation = message.trim();
    state.storyParts.push(userContinuation);
    
    const continuations = [
      "But suddenly, an unexpected twist occurred...",
      "Meanwhile, in another part of the story...",
      "Little did they know that watching from the shadows...",
      "As the plot thickened, our hero discovered...",
      "In a surprising turn of events...",
      "The mystery deepened when they realized...",
      "Just when everything seemed normal...",
      "However, fate had other plans...",
      "As the story reaches its climax...",
      "In the final moments of our tale..."
    ];
    
    if (state.storyParts.length < 6) {
      const continuation = getRandomElement(continuations);
      state.storyParts.push(continuation);
      
      return `Great addition to our story! 📖\n\nSo far: "${state.storyParts.join(' ')}\n\nKeep it going! What happens next? ✨`;
    } else {
      const fullStory = state.storyParts.join(' ');
      state.currentStory = null;
      state.storyParts = [];
      
      return `🎉 **Our Story is Complete!**\n\n"${fullStory}"\n\nWhat an amazing story we created together! Want to build another story? Just say "story" or "building"! 📚`;
    }
  }
  
  return "Let's build a story together! Say 'story' or 'building' to start! 📚";
}

function handleGameResponse(userId: string, message: string, gameType: string) {
  switch (gameType) {
    case 'trivia':
      return handleTriviaGame(userId, message);
    case 'riddles':
      return handleRiddleGame(userId, message);
    case 'word-association':
      return handleWordAssociation(userId, message);
    case 'math-challenge':
      return handleMathChallenge(userId, message);
    case 'would-you-rather':
      return handleWouldYouRather(userId, message);
    case 'story-building':
      return handleStoryBuilding(userId, message);
    default:
      return "I'm not sure which game you'd like to play! Please choose from the game menu.";
  }
}

function generateResponse(message: string, userId: string, currentGame: string | null): string {
  const lowerMessage = message.toLowerCase();
  
  // Handle game-specific responses
  if (currentGame) {
    return handleGameResponse(userId, message, currentGame);
  }
  
  // Handle game selection responses
  if (lowerMessage.includes('trivia challenge')) {
    return handleTriviaGame(userId, message);
  }
  
  if (lowerMessage.includes('riddle master')) {
    return handleRiddleGame(userId, message);
  }
  
  if (lowerMessage.includes('word association')) {
    return handleWordAssociation(userId, message);
  }
  
  if (lowerMessage.includes('math challenge')) {
    return handleMathChallenge(userId, message);
  }
  
  if (lowerMessage.includes('would you rather')) {
    return handleWouldYouRather(userId, message);
  }
  
  if (lowerMessage.includes('story builder')) {
    return handleStoryBuilding(userId, message);
  }
  
  // Handle fun facts
  if (lowerMessage.includes('fun fact') || lowerMessage.includes('fact')) {
    return `Here's a fun fact for you: ${getRandomElement(FUN_FACTS)}`;
  }
  
  // Handle weather (simulated)
  if (lowerMessage.includes('weather')) {
    const weatherOptions = [
      "It's a beautiful sunny day! ☀️ Perfect for a productive workday!",
      "Looks like it's partly cloudy today! 🌤️ Great weather for getting things done!",
      "It's a bit rainy today 🌧️ but that just means it's cozy inside!",
      "Beautiful clear skies today! 🌞 Hope you're having a great day at work!",
      "It's looking like a lovely day outside! 🌈 Perfect for staying motivated!"
    ];
    return getRandomElement(weatherOptions);
  }
  
  // Handle greetings
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return "Hello there! 👋 I'm Timeloo, your friendly workplace assistant! How can I help you today? I can chat, play games, share fun facts, or help with work-related questions!";
  }
  
  // Handle work-related queries
  if (lowerMessage.includes('work') || lowerMessage.includes('job') || lowerMessage.includes('productivity') || lowerMessage.includes('meeting')) {
    return `${getRandomElement(WORKPLACE_RESPONSES)} Feel free to ask me more specific questions about your work situation!`;
  }
  
  // Handle gratitude
  if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
    return "You're very welcome! 😊 I'm always here to help and chat. Is there anything else you'd like to talk about or any games you'd like to play?";
  }
  
  // Handle goodbye
  if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you')) {
    return "Goodbye! 👋 It was great chatting with you! Feel free to come back anytime you want to talk or play some games. Have a wonderful day! 😊";
  }
  
  // Default response
  const defaultResponses = [
    "That's interesting! Tell me more about that! 🤔",
    "I'd love to hear more about your thoughts on this! 💭",
    "That's a great topic! What aspects of it interest you most? 🌟",
    "I'm here to listen and chat! What would you like to talk about? 😊",
    "Fascinating! I enjoy our conversations. What else is on your mind? ✨",
    "I appreciate you sharing that with me! Want to explore this topic further? 🔍",
    "That's quite thoughtful! I'm curious to know more about your perspective! 🧠",
    "Thanks for sharing! I'm always ready to chat about anything you find interesting! 🎯"
  ];
  
  return getRandomElement(defaultResponses);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, currentGame } = await req.json();
    
    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = generateResponse(message, userId, currentGame);

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
