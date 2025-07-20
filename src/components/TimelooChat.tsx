
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageCircle, X, Minimize2, Maximize2, Sparkles } from 'lucide-react';
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

const TimelooChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
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

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke('timeloo-chatbot', {
        body: { message: inputMessage }
      });

      if (error) throw error;

      // Simulate typing delay for better UX
      setTimeout(() => {
        setIsTyping(false);
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response || "Sorry, I couldn't process that. How else can I help you? 🤖",
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
          
          {/* Floating particles animation */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          
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
              <div className="relative">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75"></div>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-300 animate-spin" />
                <span className="font-bold text-lg">Timeloo Assistant</span>
                <span className="text-2xl animate-bounce">🤖</span>
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

            {messages.length <= 1 && (
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
