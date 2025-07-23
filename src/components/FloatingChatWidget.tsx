
import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Send, X, MessageCircle, Bot, User, ArrowLeft, Calendar, Clock, Gamepad2, Lightbulb, Brain, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const FloatingChatWidget = () => {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(true);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('help');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        text: `Hi ${user?.firstName || 'there'}! 👋 I'm Timeloo, your smart workplace assistant! I can help you with leave management, play games, share fun facts, and answer questions about your workplace. How can I assist you today?`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, user, messages.length]);

  const handleSendMessage = async (messageText: string = inputMessage) => {
    if (!messageText.trim() || isLoading || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowMainMenu(false);

    try {
      const { data, error } = await supabase.functions.invoke('timeloo-chatbot', {
        body: { 
          message: messageText, 
          userId: user.id,
          category: currentCategory
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
        text: 'Sorry, I encountered an error. Please try again! 😅',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySelect = (category: string, message: string) => {
    setCurrentCategory(category);
    setShowMainMenu(false);
    handleSendMessage(message);
  };

  const handleBack = () => {
    setShowMainMenu(true);
    setCurrentCategory(null);
    setActiveTab('help');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 z-50"
          size="icon"
        >
          <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
        </Button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <Card className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] max-w-sm sm:w-80 sm:max-w-96 h-[calc(100vh-8rem)] max-h-[500px] sm:h-[500px] sm:max-h-[600px] flex flex-col shadow-2xl z-50 border-2 border-primary/20 bg-gradient-to-b from-background to-background/95">
          <CardHeader className="flex-shrink-0 border-b bg-gradient-to-r from-primary/10 to-primary/5 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                {!showMainMenu && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="h-8 w-8 p-0 hover:bg-primary/20 rounded-full"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold text-primary">Timeloo</CardTitle>
                    <p className="text-xs text-muted-foreground hidden sm:block">Your AI Assistant</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                  Online
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0 hover:bg-red-100 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {showMainMenu ? (
              <div className="flex-1 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-4 m-2 bg-muted">
                    <TabsTrigger value="help" className="text-xs">
                      <HelpCircle className="w-3 h-3 mr-1" />
                      Help
                    </TabsTrigger>
                    <TabsTrigger value="games" className="text-xs">
                      <Gamepad2 className="w-3 h-3 mr-1" />
                      Games
                    </TabsTrigger>
                    <TabsTrigger value="riddles" className="text-xs">
                      <Brain className="w-3 h-3 mr-1" />
                      Riddles
                    </TabsTrigger>
                    <TabsTrigger value="facts" className="text-xs">
                      <Lightbulb className="w-3 h-3 mr-1" />
                      Facts
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="help" className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="p-3 sm:p-4 space-y-4">
                        <div className="text-center mb-4">
                          <h3 className="text-base sm:text-lg font-semibold text-primary mb-2">How can I help you?</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">Choose a category or ask me anything!</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <Button
                            variant="outline"
                            className="h-auto p-2 sm:p-3 flex flex-col items-center gap-1 sm:gap-2 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('timeloo', 'Tell me about Timeloo features')}
                          >
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            <span className="text-xs font-medium">Timeloo Help</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="h-auto p-2 sm:p-3 flex flex-col items-center gap-1 sm:gap-2 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('leave', 'How do I apply for leave?')}
                          >
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            <span className="text-xs font-medium">Leave Help</span>
                          </Button>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs text-muted-foreground text-center mb-2">Quick Actions</p>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCategorySelect('help', 'What can you do?')}
                              className="text-xs hover:bg-primary/10 px-2 py-1"
                            >
                              ❓ Help
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCategorySelect('weather', 'What\'s the weather like?')}
                              className="text-xs hover:bg-primary/10 px-2 py-1"
                            >
                              🌤️ Weather
                            </Button>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="games" className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="p-3 sm:p-4 space-y-4">
                        <div className="text-center mb-4">
                          <Gamepad2 className="w-8 h-8 text-primary mx-auto mb-2" />
                          <h3 className="text-base sm:text-lg font-semibold text-primary mb-2">Fun Games</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">Choose a game to play!</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full h-auto p-3 flex items-center justify-start gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('math', 'Give me a math problem')}
                          >
                            <span className="text-lg">🔢</span>
                            <div className="text-left">
                              <p className="text-sm font-medium">Math Challenge</p>
                              <p className="text-xs text-muted-foreground">Test your calculation skills</p>
                            </div>
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="w-full h-auto p-3 flex items-center justify-start gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('trivia', 'Ask me a trivia question')}
                          >
                            <span className="text-lg">🧠</span>
                            <div className="text-left">
                              <p className="text-sm font-medium">Trivia Challenge</p>
                              <p className="text-xs text-muted-foreground">Test your general knowledge</p>
                            </div>
                          </Button>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="riddles" className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="p-3 sm:p-4 space-y-4">
                        <div className="text-center mb-4">
                          <Brain className="w-8 h-8 text-primary mx-auto mb-2" />
                          <h3 className="text-base sm:text-lg font-semibold text-primary mb-2">Brain Teasers</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">Challenge your mind with riddles!</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full h-auto p-3 flex items-center justify-start gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('riddle', 'Give me a riddle')}
                          >
                            <span className="text-lg">🧩</span>
                            <div className="text-left">
                              <p className="text-sm font-medium">Classic Riddles</p>
                              <p className="text-xs text-muted-foreground">Think outside the box</p>
                            </div>
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="w-full h-auto p-3 flex items-center justify-start gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('riddle', 'Give me a hard riddle')}
                          >
                            <span className="text-lg">🤔</span>
                            <div className="text-left">
                              <p className="text-sm font-medium">Hard Riddles</p>
                              <p className="text-xs text-muted-foreground">For the puzzle masters</p>
                            </div>
                          </Button>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="facts" className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="p-3 sm:p-4 space-y-4">
                        <div className="text-center mb-4">
                          <Lightbulb className="w-8 h-8 text-primary mx-auto mb-2" />
                          <h3 className="text-base sm:text-lg font-semibold text-primary mb-2">Amazing Facts</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">Discover interesting facts!</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full h-auto p-3 flex items-center justify-start gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('facts', 'Tell me a fun fact')}
                          >
                            <span className="text-lg">🌟</span>
                            <div className="text-left">
                              <p className="text-sm font-medium">Random Fun Facts</p>
                              <p className="text-xs text-muted-foreground">Learn something new</p>
                            </div>
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="w-full h-auto p-3 flex items-center justify-start gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('facts', 'Tell me a science fact')}
                          >
                            <span className="text-lg">🔬</span>
                            <div className="text-left">
                              <p className="text-sm font-medium">Science Facts</p>
                              <p className="text-xs text-muted-foreground">Explore the world of science</p>
                            </div>
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="w-full h-auto p-3 flex items-center justify-start gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={() => handleCategorySelect('facts', 'Tell me an animal fact')}
                          >
                            <span className="text-lg">🦁</span>
                            <div className="text-left">
                              <p className="text-sm font-medium">Animal Facts</p>
                              <p className="text-xs text-muted-foreground">Amazing animal world</p>
                            </div>
                          </Button>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 px-3 sm:px-4 py-2">
                  <div className="space-y-3 sm:space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-2 ${message.isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                      >
                        <div className={`flex gap-2 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs shadow-md ${
                            message.isUser 
                              ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground' 
                              : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600'
                          }`}>
                            {message.isUser ? <User className="w-3 h-3 sm:w-4 sm:h-4" /> : <Bot className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </div>
                          <div className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm ${
                            message.isUser 
                              ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground' 
                              : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
                            <p className={`text-xs mt-1 sm:mt-2 ${
                              message.isUser ? 'text-primary-foreground/70' : 'text-gray-500'
                            }`}>
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-2 justify-start animate-fade-in">
                        <div className="flex gap-2 max-w-[85%]">
                          <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 shadow-md">
                            <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                          </div>
                          <div className="rounded-2xl px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                            <div className="flex space-x-2">
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="flex-shrink-0 border-t bg-gradient-to-r from-gray-50 to-gray-100 p-3 sm:p-4">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 rounded-full border-2 border-gray-200 focus:border-primary transition-colors bg-white text-sm"
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() || isLoading}
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 hover:scale-105 shadow-lg flex-shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default FloatingChatWidget;
