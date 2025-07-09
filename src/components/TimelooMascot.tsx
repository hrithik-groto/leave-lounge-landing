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
    <div className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
      {/* Beautiful Park Background - Always visible */}
      <div className={`absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-green-200 via-green-100 to-transparent transition-opacity duration-1000 ${isWaving ? 'opacity-70' : 'opacity-40'}`}>
        {/* Rainbow */}
        {isWaving && (
          <div className="absolute top-2 right-10 w-16 h-8 opacity-70">
            <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 rounded-full"></div>
          </div>
        )}
        
        {/* Waterfall */}
        <div className="absolute bottom-0 right-5 w-1 h-20 bg-gradient-to-b from-blue-300 to-blue-500 opacity-40 animate-pulse"></div>
        
        {/* Small birds */}
        {isWaving && (
          <>
            <div className="absolute top-5 left-20 text-xs animate-bounce delay-100">🐦</div>
            <div className="absolute top-8 right-32 text-xs animate-bounce delay-500">🐦</div>
          </>
        )}
        {/* Trees - Always visible */}
        <div className="absolute bottom-0 left-10 text-2xl opacity-50">🌳</div>
        <div className="absolute bottom-0 right-20 text-xl opacity-50">🌲</div>
        
        {/* Subtle grass elements when not waving */}
        {!isWaving && (
          <>
            <div className="absolute bottom-0 left-32 text-sm opacity-30">🌿</div>
            <div className="absolute bottom-0 right-40 text-sm opacity-30">🌸</div>
          </>
        )}
      </div>

      {/* Mascot */}
      <div className={`absolute bottom-6 transition-all duration-2000 ${
        isWalking ? 'right-6 animate-bounce' : 'right-6'
      } ${isWaving ? 'animate-bounce' : ''}`}>
        
        {/* Music Notes */}
        {showMusicNotes && (
          <>
            <div className="absolute -top-8 -left-4 text-purple-500 animate-ping text-lg">🎵</div>
            <div className="absolute -top-12 left-2 text-blue-500 animate-pulse delay-300 text-sm">🎶</div>
            <div className="absolute -top-6 left-8 text-pink-500 animate-bounce delay-500 text-xs">♪</div>
          </>
        )}

        <div className="relative">
          {/* Main Body - Enhanced */}
          <div className="w-24 h-28 bg-gradient-to-b from-purple-400 via-purple-500 to-purple-600 rounded-full relative shadow-xl border-2 border-purple-300">
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
            <div className={`absolute top-10 -left-3 w-5 h-3 bg-purple-500 rounded-full transform transition-all duration-300 shadow-md ${
              isWaving ? 'rotate-45 animate-pulse' : isWalking ? 'animate-bounce' : 'rotate-12'
            }`}></div>
            <div className={`absolute top-10 -right-3 w-5 h-3 bg-purple-500 rounded-full transform transition-all duration-300 shadow-md ${
              isWaving ? '-rotate-45 animate-pulse' : isWalking ? 'animate-bounce delay-100' : '-rotate-12'
            }`}></div>

            {/* Enhanced Clock on chest */}
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-white rounded-full border-3 border-gray-300 shadow-md">
              <div className="absolute top-1/2 left-1/2 w-0.5 h-2.5 bg-gray-600 transform -translate-x-1/2 -translate-y-full origin-bottom rotate-90"></div>
              <div className="absolute top-1/2 left-1/2 w-0.5 h-2 bg-gray-800 transform -translate-x-1/2 -translate-y-full origin-bottom"></div>
              <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Legs with walking animation */}
            <div className={`absolute -bottom-3 left-4 w-4 h-5 bg-purple-600 rounded-full shadow-md ${
              isWalking ? 'animate-bounce' : ''
            }`}></div>
            <div className={`absolute -bottom-3 right-4 w-4 h-5 bg-purple-600 rounded-full shadow-md ${
              isWalking ? 'animate-bounce delay-100' : ''
            }`}></div>
          </div>

          {/* Speech bubble when waving */}
          {isWaving && (
            <div className="absolute -top-12 -left-20 bg-white rounded-lg p-3 shadow-xl animate-fade-in border border-purple-200">
              <div className="text-sm font-medium text-purple-700 whitespace-nowrap">
                Leave applied! 🎉
              </div>
              <div className="absolute bottom-0 left-10 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white transform translate-y-full"></div>
            </div>
          )}

          {/* Floating hearts when waving */}
          {isWaving && (
            <>
              <div className="absolute -top-6 left-2 text-red-400 animate-ping text-lg">💜</div>
              <div className="absolute -top-8 right-2 text-pink-400 animate-pulse delay-300 text-lg">💙</div>
              <div className="absolute -top-4 right-8 text-purple-400 animate-bounce delay-500 text-lg">💚</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelooMascot;