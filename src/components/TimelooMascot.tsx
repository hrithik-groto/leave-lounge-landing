import React, { useState, useEffect } from 'react';

interface TimelooMascotProps {
  shouldWave?: boolean;
  onWaveComplete?: () => void;
}

const TimelooMascot: React.FC<TimelooMascotProps> = ({ shouldWave = false, onWaveComplete }) => {
  const [isWaving, setIsWaving] = useState(false);
  const [eyesBlink, setEyesBlink] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isWhistling, setIsWhistling] = useState(false);
  const [showMusicNotes, setShowMusicNotes] = useState(false);

  useEffect(() => {
    if (shouldWave) {
      setIsWaving(true);
      setIsWalking(true);
      setIsWhistling(true);
      setShowMusicNotes(true);
      
      const timer = setTimeout(() => {
        setIsWaving(false);
        setIsWalking(false);
        setIsWhistling(false);
        setShowMusicNotes(false);
        onWaveComplete?.();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [shouldWave, onWaveComplete]);

  // Blinking animation when not active
  useEffect(() => {
    if (!isWaving) {
      const blinkInterval = setInterval(() => {
        setEyesBlink(true);
        setTimeout(() => setEyesBlink(false), 150);
      }, 3000);
      return () => clearInterval(blinkInterval);
    }
  }, [isWaving]);

  // Random whistling when idle
  useEffect(() => {
    if (!isWaving) {
      const whistleInterval = setInterval(() => {
        if (Math.random() > 0.7) {
          setIsWhistling(true);
          setShowMusicNotes(true);
          setTimeout(() => {
            setIsWhistling(false);
            setShowMusicNotes(false);
          }, 2000);
        }
      }, 8000);
      return () => clearInterval(whistleInterval);
    }
  }, [isWaving]);

  return (
    <div className="fixed bottom-4 left-4 z-10 pointer-events-none">
      {/* Mascot Container */}
      <div className={`transition-all duration-1000 ${
        isWaving ? 'animate-bounce' : ''
      }`}>
        
        {/* Speech bubble when waving */}
        {isWaving && (
          <div className="absolute -top-12 left-8 bg-white rounded-lg p-2 shadow-lg border border-gray-200 animate-fade-in">
            <div className="text-xs font-medium text-gray-700 whitespace-nowrap">
              Leave applied! 🎉
            </div>
            <div className="absolute bottom-0 left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white transform translate-y-full"></div>
          </div>
        )}

        <div className="relative">
          {/* Main Body - Cat-like character */}
          <div className="w-16 h-20 bg-gradient-to-b from-gray-300 to-gray-400 rounded-full relative shadow-lg">
            
            {/* Cat ears */}
            <div className="absolute -top-2 left-2 w-3 h-4 bg-gray-400 rounded-full transform rotate-12"></div>
            <div className="absolute -top-2 right-2 w-3 h-4 bg-gray-400 rounded-full transform -rotate-12"></div>
            <div className="absolute -top-1 left-2.5 w-2 h-3 bg-pink-300 rounded-full transform rotate-12"></div>
            <div className="absolute -top-1 right-2.5 w-2 h-3 bg-pink-300 rounded-full transform -rotate-12"></div>
            
            {/* Face */}
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
              {/* Eyes */}
              <div className="flex space-x-2 mb-1">
                <div className={`w-2.5 h-2.5 bg-black rounded-full transition-all duration-150 ${eyesBlink ? 'h-0.5' : ''}`}></div>
                <div className={`w-2.5 h-2.5 bg-black rounded-full transition-all duration-150 ${eyesBlink ? 'h-0.5' : ''}`}></div>
              </div>
              
              {/* Nose */}
              <div className="w-1.5 h-1 bg-pink-400 rounded-full mx-auto mb-1"></div>
              
              {/* Mouth */}
              <div className="w-3 h-1.5 border-b-2 border-gray-600 rounded-full"></div>
            </div>

            {/* Arms with waving animation */}
            <div className={`absolute top-6 -left-1 w-3 h-1.5 bg-gray-400 rounded-full transform transition-all duration-500 ${
              isWaving ? 'rotate-45 -translate-y-1' : 'rotate-12'
            }`}></div>
            <div className={`absolute top-6 -right-1 w-3 h-1.5 bg-gray-400 rounded-full transform transition-all duration-500 ${
              isWaving ? '-rotate-45 -translate-y-1' : '-rotate-12'
            }`}></div>

            {/* Orange element on chest */}
            <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-orange-400 rounded-full border-2 border-orange-300">
              <div className="absolute top-1/2 left-1/2 w-0.5 h-1.5 bg-orange-600 transform -translate-x-1/2 -translate-y-full origin-bottom"></div>
              <div className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-orange-700 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Legs */}
            <div className="absolute -bottom-1 left-2 w-2.5 h-3 bg-gray-500 rounded-full"></div>
            <div className="absolute -bottom-1 right-2 w-2.5 h-3 bg-gray-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelooMascot;