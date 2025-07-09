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
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none overflow-hidden">
      {/* Simple Park Background */}
      <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-green-100 to-transparent transition-all duration-500 ${isWaving ? 'opacity-60' : 'opacity-30'}`}>
        {/* Simple decorative elements */}
        <div className="absolute bottom-0 left-10 text-lg opacity-40">🌳</div>
        <div className="absolute bottom-0 right-20 text-sm opacity-40">🌲</div>
      </div>

      {/* Mascot */}
      <div className={`absolute bottom-4 right-6 transition-all duration-1000 ${
        isWaving ? 'animate-pulse' : ''
      }`}>
        
        {/* Simple music note */}
        {showMusicNotes && (
          <div className="absolute -top-6 -left-2 text-purple-500 animate-pulse text-sm">🎵</div>
        )}

        <div className="relative">
          {/* Main Body - Simple */}
          <div className="w-20 h-24 bg-gradient-to-b from-purple-400 to-purple-500 rounded-full relative shadow-lg border border-purple-300">
            {/* Cute cheeks */}
            <div className="absolute top-6 left-1 w-2 h-2 bg-pink-300 rounded-full opacity-60"></div>
            <div className="absolute top-6 right-1 w-2 h-2 bg-pink-300 rounded-full opacity-60"></div>
            
            {/* Face */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              {/* Eyes */}
              <div className="flex space-x-3 mb-2">
                <div className={`w-3 h-3 bg-white rounded-full relative transition-all duration-150 shadow-sm ${eyesBlink ? 'h-0.5' : ''}`}>
                  {!eyesBlink && <div className="w-1.5 h-1.5 bg-black rounded-full absolute top-0.5 left-0.5"></div>}
                </div>
                <div className={`w-3 h-3 bg-white rounded-full relative transition-all duration-150 shadow-sm ${eyesBlink ? 'h-0.5' : ''}`}>
                  {!eyesBlink && <div className="w-1.5 h-1.5 bg-black rounded-full absolute top-0.5 left-0.5"></div>}
                </div>
              </div>
              
              {/* Nose */}
              <div className="w-1 h-1 bg-pink-400 rounded-full mx-auto mb-1"></div>
              
              {/* Mouth */}
              <div className={`transition-all duration-300 ${
                isWhistling ? 'w-2 h-2 bg-pink-200 rounded-full border border-pink-400' : 'w-4 h-2 border-b-2 border-white rounded-full'
              }`}></div>
            </div>

            {/* Arms */}
            <div className={`absolute top-8 -left-2 w-4 h-2 bg-purple-500 rounded-full transform transition-all duration-500 ${
              isWaving ? 'rotate-12' : 'rotate-6'
            }`}></div>
            <div className={`absolute top-8 -right-2 w-4 h-2 bg-purple-500 rounded-full transform transition-all duration-500 ${
              isWaving ? '-rotate-12' : '-rotate-6'
            }`}></div>

            {/* Simple Clock on chest */}
            <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white rounded-full border-2 border-gray-300">
              <div className="absolute top-1/2 left-1/2 w-0.5 h-2 bg-gray-600 transform -translate-x-1/2 -translate-y-full origin-bottom"></div>
              <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Simple legs */}
            <div className="absolute -bottom-2 left-3 w-3 h-4 bg-purple-600 rounded-full"></div>
            <div className="absolute -bottom-2 right-3 w-3 h-4 bg-purple-600 rounded-full"></div>
          </div>

          {/* Simple speech bubble when waving */}
          {isWaving && (
            <div className="absolute -top-8 -left-16 bg-white rounded-lg p-2 shadow-lg border border-purple-200">
              <div className="text-xs font-medium text-purple-700 whitespace-nowrap">
                Leave applied! 🎉
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelooMascot;