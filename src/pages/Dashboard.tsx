
import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import FloatingChatWidget from '@/components/FloatingChatWidget';

const Dashboard = () => {
  const { userId, signOut } = useAuth();
  const navigate = useNavigate();

  if (!userId) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <Button onClick={() => signOut()}>Sign Out</Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Your dashboard content goes here */}
        <p className="text-gray-700">Welcome to your dashboard!</p>
      </main>
      
      {/* Add the floating chatbot widget */}
      <FloatingChatWidget />
    </div>
  );
};

export default Dashboard;
