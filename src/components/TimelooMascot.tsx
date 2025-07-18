import React, { useState, useEffect } from 'react';

interface TimelooMascotProps {
  shouldWave?: boolean;
  onWaveComplete?: () => void;
  showMessage?: boolean;
  message?: string;
}

const TimelooMascot: React.FC<TimelooMascotProps> = ({ shouldWave = false, onWaveComplete, showMessage = false, message = "applied! 🎉 💙" }) => {
  const [isWaving, setIsWaving] = useState(false);
  const [eyesBlink, setEyesBlink] = useState(false);

  useEffect(() => {
    if (shouldWave) {
      setIsWaving(true);
      const timer = setTimeout(() => {
        setIsWaving(false);
        onWaveComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [shouldWave, onWaveComplete]);

  // Blinking animation when not waving
  useEffect(() => {
    if (!isWaving) {
      const blinkInterval = setInterval(() => {
        setEyesBlink(true);
        setTimeout(() => setEyesBlink(false), 150);
      }, 3000);
      return () => clearInterval(blinkInterval);
    }
  }, [isWaving]);

  return (
    <div className="fixed bottom-6 left-6 z-50 pointer-events-none flex items-end gap-4">
      <div className={`transition-all duration-500 ${isWaving ? 'animate-bounce' : ''}`}>
        {/* Mascot Body */}
        <div className="relative">
          {/* Main Body */}
          <div className="w-20 h-24 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full relative shadow-lg">
            {/* Face */}
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
              {/* Eyes */}
              <div className="flex space-x-2 mb-1">
                <div className={`w-2 h-2 bg-white rounded-full relative transition-all duration-150 ${eyesBlink ? 'h-0.5' : ''}`}>
                  {!eyesBlink && <div className="w-1 h-1 bg-black rounded-full absolute top-0.5 left-0.5"></div>}
                </div>
                <div className={`w-2 h-2 bg-white rounded-full relative transition-all duration-150 ${eyesBlink ? 'h-0.5' : ''}`}>
                  {!eyesBlink && <div className="w-1 h-1 bg-black rounded-full absolute top-0.5 left-0.5"></div>}
                </div>
              </div>
              {/* Smile */}
              <div className="w-3 h-1.5 border-b-2 border-white rounded-full"></div>
            </div>

            {/* Arms */}
            <div className={`absolute top-8 -left-2 w-4 h-2 bg-purple-500 rounded-full transform transition-all duration-300 ${isWaving ? 'rotate-45 animate-pulse' : 'rotate-12'}`}></div>
            <div className={`absolute top-8 -right-2 w-4 h-2 bg-purple-500 rounded-full transform transition-all duration-300 ${isWaving ? '-rotate-45 animate-pulse' : '-rotate-12'}`}></div>

            {/* Clock on chest */}
            <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white rounded-full border-2 border-gray-300">
              <div className="absolute top-1/2 left-1/2 w-0.5 h-2 bg-gray-600 transform -translate-x-1/2 -translate-y-full origin-bottom rotate-90"></div>
              <div className="absolute top-1/2 left-1/2 w-0.5 h-1.5 bg-gray-800 transform -translate-x-1/2 -translate-y-full origin-bottom"></div>
              <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Legs */}
            <div className="absolute -bottom-2 left-3 w-3 h-4 bg-purple-600 rounded-full"></div>
            <div className="absolute -bottom-2 right-3 w-3 h-4 bg-purple-600 rounded-full"></div>
          </div>

          {/* Speech bubble when waving */}
          {isWaving && (
            <div className="absolute -top-8 -right-32 bg-white rounded-lg p-2 shadow-lg animate-fade-in border border-purple-200">
              <div className="text-xs font-medium text-purple-700 whitespace-nowrap">
                Leave applied! 🎉
              </div>
              <div className="absolute bottom-0 left-8 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white transform translate-y-full"></div>
            </div>
          )}

          {/* Floating hearts when waving */}
          {isWaving && (
            <>
              <div className="absolute -top-4 left-2 text-red-400 animate-ping">💜</div>
              <div className="absolute -top-6 right-2 text-pink-400 animate-pulse delay-300">💙</div>
              <div className="absolute -top-2 right-6 text-purple-400 animate-bounce delay-500">💚</div>
              <div className="absolute -top-8 left-6 text-blue-400 animate-bounce delay-400">🍾</div>
            </>
          )}
        </div>
      </div>
      
      {/* Message on the right side */}
      {showMessage && (
        <div className="mb-8 animate-fade-in">
          <div className="bg-white rounded-lg p-3 shadow-lg border border-purple-200 max-w-xs ml-4">
            <div className="text-sm font-medium text-purple-700">
              {message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelooMascot;
