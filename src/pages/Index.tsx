
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
    if (isLoaded && user) {
      // Check if user was redirected from Slack OAuth
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('slack_connected') === 'true') {
        toast({
          title: "🎉 Slack Connected!",
          description: "Your Slack account has been successfully connected!",
          className: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
        });
        // Clean up URL and redirect to dashboard
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500); // Give user time to see the success message
      } else {
        // Regular redirect to dashboard for authenticated users
        navigate('/dashboard');
      }
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
