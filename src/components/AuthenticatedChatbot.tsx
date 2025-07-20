
import React from 'react';
import { useUser } from '@clerk/clerk-react';
import TimelooChat from './TimelooChat';

const AuthenticatedChatbot = () => {
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    return null;
  }

  return <TimelooChat />;
};

export default AuthenticatedChatbot;
