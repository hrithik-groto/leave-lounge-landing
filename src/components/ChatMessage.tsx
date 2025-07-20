
import React from 'react';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <div className={`flex ${message.isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}>
      <div
        className={`max-w-[80%] p-4 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl ${
          message.isBot
            ? 'bg-gradient-to-br from-white to-gray-100 text-gray-800 border border-gray-200'
            : 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
        <span className="text-xs opacity-70 block mt-2 text-right">
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  );
};

export default ChatMessage;
