
export interface GameState {
  currentQuestion?: any;
  score: number;
  usedQuestions: Set<string>;
  gameType: string;
}

export const GAMES = {
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
      "⚡ Lightning strikes the Earth about 100 times per second!"
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
      { question: "What runs but never walks?", answer: "water" }
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
      { question: "6 × 8 = ?", answer: "48" }
    ]
  }
};

export function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function handleGameResponse(message: string, gameStates: Map<string, GameState>, userId: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Handle fun fact requests
  if (lowerMessage.includes('fun fact') || lowerMessage.includes('fact')) {
    const fact = getRandomElement(GAMES.funFact.facts);
    return `Here's a fun fact for you: ${fact}`;
  }
  
  // Handle riddle requests
  if (lowerMessage.includes('riddle')) {
    const state = getUserGameState(gameStates, userId, 'riddle');
    const riddle = getRandomElement(GAMES.riddle.riddles.filter(r => !state.usedQuestions.has(r.question)));
    
    if (!riddle) {
      // Reset if all riddles used
      state.usedQuestions.clear();
      const newRiddle = getRandomElement(GAMES.riddle.riddles);
      state.currentQuestion = newRiddle;
      state.usedQuestions.add(newRiddle.question);
    } else {
      state.currentQuestion = riddle;
      state.usedQuestions.add(riddle.question);
    }
    
    return `🧩 Here's a riddle for you:\n\n${state.currentQuestion.question}\n\nThink carefully and give me your answer! 🤔`;
  }
  
  // Handle math problem requests
  if (lowerMessage.includes('math') || lowerMessage.includes('problem')) {
    const state = getUserGameState(gameStates, userId, 'math');
    const problem = getRandomElement(GAMES.math.problems.filter(p => !state.usedQuestions.has(p.question)));
    
    if (!problem) {
      // Reset if all problems used
      state.usedQuestions.clear();
      const newProblem = getRandomElement(GAMES.math.problems);
      state.currentQuestion = newProblem;
      state.usedQuestions.add(newProblem.question);
    } else {
      state.currentQuestion = problem;
      state.usedQuestions.add(problem.question);
    }
    
    return `🔢 Here's a math problem for you:\n\n${state.currentQuestion.question}\n\nSolve it and give me your answer! ⚡`;
  }
  
  // Check if user is answering a riddle
  const riddleState = gameStates.get(`${userId}_riddle`);
  if (riddleState?.currentQuestion && riddleState.gameType === 'riddle') {
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
  const mathState = gameStates.get(`${userId}_math`);
  if (mathState?.currentQuestion && mathState.gameType === 'math') {
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
  
  // Default response
  const defaultResponses = [
    "Hi there! I can share fun facts, give you riddles, or create math problems for you! 🤖",
    "I'd love to help! Try asking for a 'fun fact', 'riddle', or 'math problem'! ✨",
    "Hello! I'm here to entertain and challenge you. What would you like - a fun fact, riddle, or math problem? 😊"
  ];
  
  return getRandomElement(defaultResponses);
}

function getUserGameState(gameStates: Map<string, GameState>, userId: string, gameType: string): GameState {
  const key = `${userId}_${gameType}`;
  if (!gameStates.has(key)) {
    gameStates.set(key, {
      score: 0,
      usedQuestions: new Set(),
      gameType: gameType
    });
  }
  return gameStates.get(key)!;
}
