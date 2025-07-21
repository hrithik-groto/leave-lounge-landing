
import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Send, ArrowLeft, Bot, User, Gamepad2 } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface GameOption {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

const AVAILABLE_GAMES: GameOption[] = [
  {
    id: 'trivia',
    name: 'Trivia Challenge',
    description: 'Test your knowledge with fun questions',
    emoji: '🧠'
  },
  {
    id: 'word-association',
    name: 'Word Association',
    description: 'Connect words in creative ways',
    emoji: '🔗'
  },
  {
    id: 'riddles',
    name: 'Riddle Master',
    description: 'Solve challenging riddles',
    emoji: '🧩'
  },
  {
    id: 'story-building',
    name: 'Story Builder',
    description: 'Create stories together',
    emoji: '📚'
  },
  {
    id: 'math-challenge',
    name: 'Math Challenge',
    description: 'Quick math problems',
    emoji: '🔢'
  },
  {
    id: 'would-you-rather',
    name: 'Would You Rather',
    description: 'Choose between interesting options',
    emoji: '⚖️'
  }
];

const TimelooChat = () => {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [showBackButton, setShowBackButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      // Add welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        text: `Hi ${user.firstName || 'there'}! 👋 I'm Timeloo, your friendly workplace assistant! I'm here to help you with work-related questions, play games, or just have a chat. What would you like to do today?`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [user]);

  const handleSendMessage = async (messageText: string = inputMessage) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowBackButton(true);

    try {
      const { data, error } = await supabase.functions.invoke('timeloo-chatbot', {
        body: { 
          message: messageText, 
          userId: user?.id,
          currentGame: currentGame 
        }
      });

      if (error) {
        console.error('Error calling chatbot:', error);
        throw error;
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again!',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGameSelect = (game: GameOption) => {
    setCurrentGame(game.id);
    setShowGames(false);
    setShowBackButton(true);
    
    const gameMessage = `I'd like to play ${game.name}! ${game.description}`;
    handleSendMessage(gameMessage);
  };

  const handlePlayGames = () => {
    setShowGames(true);
    setShowBackButton(true);
  };

  const handleBack = () => {
    setShowGames(false);
    setCurrentGame(null);
    setShowBackButton(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Please sign in to chat with Timeloo</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Bot className="w-6 h-6 text-primary" />
            <CardTitle className="text-lg">Timeloo Assistant</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            Online
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {showGames ? (
          <div className="p-6">
            <div className="text-center mb-6">
              <Gamepad2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Choose a Game</h3>
              <p className="text-muted-foreground">Select a game to play with Timeloo</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_GAMES.map((game) => (
                <Button
                  key={game.id}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent transition-colors"
                  onClick={() => handleGameSelect(game)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-lg">{game.emoji}</span>
                    <span className="font-medium text-left">{game.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left whitespace-normal">
                    {game.description}
                  </p>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {message.isUser ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div className={`rounded-lg px-3 py-2 ${
                        message.isUser 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                        <p className={`text-xs mt-1 ${
                          message.isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex gap-2 max-w-[85%]">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="rounded-lg px-3 py-2 bg-muted">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlayGames}
                  className="flex items-center gap-2"
                >
                  <Gamepad2 className="w-4 h-4" />
                  Play Games
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendMessage("Tell me a random fun fact")}
                  className="whitespace-nowrap"
                >
                  Fun Fact
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendMessage("What's the weather like?")}
                  className="whitespace-nowrap"
                >
                  Weather
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  size="sm"
                  className="px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TimelooChat;
