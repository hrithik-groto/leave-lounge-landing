
import React, { useState } from 'react';
import { Menu, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', href: '#home' },
    { name: 'About Us', href: '#about' },
    { name: 'Pricing', href: '#pricing' },
  ];

  const handleGoToApp = () => {
    navigate('/dashboard');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                Timeloo
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="relative text-gray-700 hover:text-purple-600 px-4 py-2 text-sm font-medium transition-all duration-300 group"
              >
                {item.name}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
            ))}
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <SignedOut>
              <SignInButton>
                <Button 
                  variant="ghost" 
                  className="text-gray-700 hover:text-purple-600 hover:bg-purple-50 font-medium px-6 py-2 rounded-xl transition-all duration-300"
                >
                  Login
                </Button>
              </SignInButton>
              <SignUpButton>
                <Button className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white font-medium px-8 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                  Sign Up
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <NotificationBell />
              <Button 
                onClick={handleGoToApp}
                className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white font-medium px-8 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 mr-3"
              >
                Go to App
              </Button>
              <div className="p-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-full">
                <UserButton 
                  afterSignOutUrl="/" 
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10 rounded-full border-2 border-white shadow-lg"
                    }
                  }}
                />
              </div>
            </SignedIn>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-all duration-300"
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden animate-fade-in bg-white/95 backdrop-blur-xl rounded-2xl mx-4 my-4 shadow-xl border border-gray-200/50">
            <div className="px-6 pt-4 pb-6 space-y-3">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-4 py-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 text-base font-medium rounded-xl transition-all duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="pt-4 border-t border-gray-200/50 space-y-3">
                <SignedOut>
                  <SignInButton>
                    <Button variant="ghost" className="w-full justify-center text-gray-700 hover:text-purple-600 hover:bg-purple-50 font-medium py-3 rounded-xl">
                      Login
                    </Button>
                  </SignInButton>
                  <SignUpButton>
                    <Button className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white font-medium py-3 rounded-xl shadow-lg">
                      Sign Up
                    </Button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <div className="flex justify-center mb-3">
                    <NotificationBell />
                  </div>
                  <Button 
                    onClick={handleGoToApp}
                    className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white font-medium py-3 rounded-xl shadow-lg mb-3"
                  >
                    Go to App
                  </Button>
                  <div className="flex justify-center">
                    <div className="p-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-full">
                      <UserButton 
                        afterSignOutUrl="/" 
                        appearance={{
                          elements: {
                            avatarBox: "w-10 h-10 rounded-full border-2 border-white shadow-lg"
                          }
                        }}
                      />
                    </div>
                  </div>
                </SignedIn>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
