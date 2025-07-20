
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageCircle, X, Minimize2, Maximize2, Sparkles, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import QuickActions from './QuickActions';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface GameState {
  isActive: boolean;
  type: string;
  data: any;
}

const TimelooChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [gameState, setGameState] = useState<GameState>({ isActive: false, type: '', data: null });
  const [chatHistory, setChatHistory] = useState<Message[][]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Random welcome messages with games and facts
  const welcomeMessages = [
    "Hi there! 👋 I'm your Timeloo assistant! Ready for a quick number guessing game? I'm thinking of a number between 1-10! 🎯",
    "Hello! 🎉 Fun fact: Did you know octopuses have three hearts? 🐙 Now, how can I help you with Timeloo today?",
    "Hey! 🌟 Want to play word association? I'll start: 'Vacation' - what's the first word that comes to mind? 🤔",
    "Welcome back! 🚀 Here's a cool fact: Honey never spoils! 🍯 What would you like to know about your leave balance?",
    "Hi! 🎲 Let's roll the virtual dice! *Rolling...* You got a 6! Lucky day ahead! What can I help you with?",
    "Greetings! 🌈 Quick riddle: I'm tall when I'm young, short when I'm old. What am I? (Answer: A candle!) 🕯️ Ready to explore Timeloo?",
    "Hello there! 🎪 This or that: Coffee ☕ or Tea 🍵? Now, let's make your work day amazing with Timeloo!",
    "Hey! 💫 Daily motivation: You're capable of amazing things! 🌟 How can I assist with your leave management today?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with random welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
      setMessages([{
        id: '1',
        text: randomWelcome,
        isBot: true,
        timestamp: new Date()
      }]);
    }
  }, [isOpen]);

  const handleGameResponse = (userInput: string, gameType: string, gameData: any) => {
    let gameResult = '';
    
    switch (gameType) {
      case 'number_guess':
        const guess = parseInt(userInput);
        if (isNaN(guess)) {
          gameResult = "Please enter a valid number! 🔢";
          return gameResult;
        }
        if (guess === gameData.number) {
          gameResult = `🎉 Incredible! You guessed ${guess} correctly! You're amazing! Want to play again with a different range?`;
          setGameState({ isActive: false, type: '', data: null });
        } else if (guess < gameData.number) {
          gameResult = `📈 Higher! The number is greater than ${guess}. Keep trying!`;
        } else {
          gameResult = `📉 Lower! The number is less than ${guess}. You're getting close!`;
        }
        break;
        
      case 'word_association':
        gameResult = `Great choice! "${userInput}" makes me think of "${getRandomAssociation(userInput)}" 🤔 What does that make you think of?`;
        break;
        
      case 'riddle':
        if (userInput.toLowerCase().includes('candle') || userInput.toLowerCase().includes('flame')) {
          gameResult = "🕯️ Excellent! You got it right! A candle is tall when young and short when old. Here's another: What has keys but no locks, space but no room?";
          setGameState({ isActive: true, type: 'riddle', data: { answer: 'keyboard' } });
        } else if (userInput.toLowerCase().includes('keyboard')) {
          gameResult = "⌨️ Perfect! A keyboard has keys but no locks! You're brilliant at riddles! 🧩";
          setGameState({ isActive: false, type: '', data: null });
        } else {
          gameResult = "🤔 Not quite! Think about something that changes size as it's used... Keep trying!";
        }
        break;
        
      case 'dice_roll':
        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;
        if (playerRoll > botRoll) {
          gameResult = `🎲 You rolled ${playerRoll}, I rolled ${botRoll}! You win! 🏆 Victory dance time!`;
        } else if (playerRoll < botRoll) {
          gameResult = `🎲 You rolled ${playerRoll}, I rolled ${botRoll}! I win this round! 😄 Want a rematch?`;
        } else {
          gameResult = `🎲 We both rolled ${playerRoll}! It's a tie! 🤝 Great minds think alike!`;
        }
        setGameState({ isActive: false, type: '', data: null });
        break;
        
      default:
        gameResult = "I'm not sure how to handle that game. Let's try something else! 🎮";
        setGameState({ isActive: false, type: '', data: null });
    }
    
    return gameResult;
  };

  const getRandomAssociation = (word: string) => {
    const associations: { [key: string]: string[] } = {
      'vacation': ['beach', 'relaxation', 'travel', 'adventure', 'freedom'],
      'work': ['productivity', 'achievement', 'teamwork', 'growth', 'success'],
      'coffee': ['energy', 'morning', 'warmth', 'focus', 'community'],
      'tea': ['calm', 'ceremony', 'health', 'comfort', 'tradition'],
      'default': ['happiness', 'sunshine', 'creativity', 'friendship', 'discovery']
    };
    
    const wordKey = word.toLowerCase();
    const options = associations[wordKey] || associations['default'];
    return options[Math.floor(Math.random() * options.length)];
  };

  const startNewGame = (gameType: string) => {
    let gameMessage = '';
    let newGameData = null;
    
    switch (gameType) {
      case 'number_guess':
        const number = Math.floor(Math.random() * 100) + 1;
        newGameData = { number };
        gameMessage = `🎯 New Number Guessing Game! I'm thinking of a number between 1 and 100. What's your guess?`;
        break;
        
      case 'word_association':
        const startWords = ['ocean', 'mountain', 'music', 'adventure', 'discovery', 'innovation'];
        const startWord = startWords[Math.floor(Math.random() * startWords.length)];
        gameMessage = `🔤 Word Association Game! I'll start with: "${startWord}" - what's the first word that comes to mind?`;
        break;
        
      case 'riddle':
        gameMessage = `🧩 Riddle Time! Here's one: I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?`;
        newGameData = { answer: 'map' };
        break;
        
      case 'dice_roll':
        gameMessage = `🎲 Dice Battle! Say "roll" and we'll both roll dice to see who gets the higher number!`;
        break;
    }
    
    setGameState({ isActive: true, type: gameType, data: newGameData });
    
    const gameStartMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: gameMessage,
      isBot: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, gameStartMessage]);
  };

  const handleBackNavigation = () => {
    if (chatHistory.length > 0) {
      const previousMessages = chatHistory[chatHistory.length - 1];
      setChatHistory(prev => prev.slice(0, -1));
      setMessages(previousMessages);
      setGameState({ isActive: false, type: '', data: null });
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date()
    };

    // Save current state to history before updating
    setChatHistory(prev => [...prev, messages]);
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      let botResponseText = '';
      
      // Handle active games first
      if (gameState.isActive) {
        botResponseText = handleGameResponse(currentInput, gameState.type, gameState.data);
      } else {
        // Check if user wants to start a game
        const lowerInput = currentInput.toLowerCase();
        if (lowerInput.includes('play') || lowerInput.includes('game')) {
          if (lowerInput.includes('number') || lowerInput.includes('guess')) {
            startNewGame('number_guess');
            setIsLoading(false);
            setIsTyping(false);
            return;
          } else if (lowerInput.includes('word') || lowerInput.includes('association')) {
            startNewGame('word_association');
            setIsLoading(false);
            setIsTyping(false);
            return;
          } else if (lowerInput.includes('riddle') || lowerInput.includes('puzzle')) {
            startNewGame('riddle');
            setIsLoading(false);
            setIsTyping(false);
            return;
          } else if (lowerInput.includes('dice') || lowerInput.includes('roll')) {
            startNewGame('dice_roll');
            setIsLoading(false);
            setIsTyping(false);
            return;
          }
        }
        
        // Regular API call for non-game interactions
        const { data, error } = await supabase.functions.invoke('timeloo-chatbot', {
          body: { message: currentInput, gameMode: false }
        });

        if (error) throw error;
        botResponseText = data.response || "Sorry, I couldn't process that. How else can I help you? 🤖";
      }

      // Simulate typing delay for better UX
      setTimeout(() => {
        setIsTyping(false);
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: botResponseText,
          isBot: true,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, botMessage]);
      }, 1000);
    } catch (error) {
      console.error('Chat error:', error);
      setIsTyping(false);
      toast({
        title: "Chat Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Oops! I'm having trouble connecting right now. Please try again in a moment! 😅",
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickAction = (actionText: string) => {
    setInputMessage(actionText);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          <Button
            onClick={() => setIsOpen(true)}
            className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-2xl transition-all duration-300 hover:scale-110"
            size="icon"
          >
            <MessageCircle className="h-8 w-8 text-white" />
          </Button>
          
          {/* Static particles */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"></div>
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-green-400 rounded-full"></div>
          
          {/* Notification badge */}
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className={`w-96 shadow-2xl transition-all duration-500 ease-in-out border-2 border-primary/20 ${
        isMinimized ? 'h-16' : 'h-[600px]'
      }`}>
        <CardHeader className="p-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {chatHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 transition-colors"
                  onClick={handleBackNavigation}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="relative">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-300" />
                <span className="font-bold text-lg">Timeloo Assistant</span>
                <span className="text-2xl">🤖</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 transition-colors"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[536px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {isTyping && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-gradient-to-br from-white to-gray-100 text-gray-800 border border-gray-200 p-4 rounded-2xl shadow-lg">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-gray-600">Timeloo is typing...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {messages.length <= 1 && !gameState.isActive && (
              <QuickActions onActionClick={handleQuickAction} />
            )}

            <ChatInput
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              onSendMessage={sendMessage}
              isLoading={isLoading}
              onKeyPress={handleKeyPress}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default TimelooChat;
