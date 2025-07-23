
import React, { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoaded) return;

    // Handle Slack OAuth success callback
    const urlParams = new URLSearchParams(window.location.search);
    const slackConnected = urlParams.get('slack_connected');
    
    if (slackConnected === 'true') {
      // Clean up URL immediately
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      if (user) {
        // Show success toast
        toast({
          title: "🎉 Slack Connected!",
          description: "Your Slack account has been successfully connected!",
          className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
        });
        
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
        return;
      }
    }
    
    // Regular redirect logic for authenticated users
    if (user && !slackConnected) {
      navigate('/dashboard');
    }
  }, [user, isLoaded, navigate, toast]);

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show success message while redirecting after Slack connection
  const urlParams = new URLSearchParams(window.location.search);
  if (user && urlParams.get('slack_connected') === 'true') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-blue-50">
        <div className="text-center">
          <div className="animate-pulse text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">Slack Connected!</h2>
          <p className="text-green-600 mb-4">Redirecting to dashboard...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show loading state while redirecting authenticated users
  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <Header />
      <Hero />
      <Features />
      <Testimonials />
      <Footer />
    </div>
  );
};

export default Index;
