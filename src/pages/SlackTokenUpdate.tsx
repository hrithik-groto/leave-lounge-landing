
import React from 'react';
import SlackTokenUpdater from '@/components/SlackTokenUpdater';

const SlackTokenUpdate = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Slack Token Update
          </h1>
          <p className="text-gray-600">
            Update your Slack bot access token to maintain integration functionality
          </p>
        </div>
        
        <SlackTokenUpdater />
      </div>
    </div>
  );
};

export default SlackTokenUpdate;
