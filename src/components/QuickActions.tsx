
import React from 'react';
import { Button } from '@/components/ui/button';
import { Gamepad2 } from 'lucide-react';

interface QuickActionsProps {
  onActionClick: (actionText: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onActionClick }) => {
  const quickActions = [
    { text: "How to apply for leave?", icon: "📝", gradient: "from-blue-500 to-purple-600" },
    { text: "Check my leave balance", icon: "📊", gradient: "from-green-500 to-teal-600" },
    { text: "Let's play a game!", icon: "🎮", gradient: "from-pink-500 to-rose-600" },
    { text: "Help me understand approvals", icon: "✅", gradient: "from-orange-500 to-red-600" }
  ];

  return (
    <div className="px-4 pb-2 bg-gradient-to-r from-gray-50 to-white">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-gray-700">Quick Actions</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className={`text-xs h-12 justify-start bg-gradient-to-r ${action.gradient} text-white border-0 hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg`}
              onClick={() => onActionClick(action.text)}
            >
              <span className="mr-2 text-base">{action.icon}</span>
              <span className="text-xs font-medium">{action.text}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
