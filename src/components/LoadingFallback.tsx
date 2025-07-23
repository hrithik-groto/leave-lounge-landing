
import React from 'react';

interface LoadingFallbackProps {
  message?: string;
}

const LoadingFallback = ({ message = "Loading..." }: LoadingFallbackProps) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default LoadingFallback;
