import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface TimelooMascotProps {
  shouldWave?: boolean;
  onWaveComplete?: () => void;
}

const TimelooMascot: React.FC<TimelooMascotProps> = ({ shouldWave = false, onWaveComplete }) => {
  const [isWaving, setIsWaving] = useState(false);
  const [eyesBlink, setEyesBlink] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Time update effect
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  // Blinking animation when not waving
  useEffect(() => {
    if (!isWaving) {
      const blinkInterval = setInterval(() => {
        setEyesBlink(true);
        setTimeout(() => setEyesBlink(false), 150);
      }, 2500 + Math.random() * 2000); // Random blinking between 2.5-4.5 seconds
      return () => clearInterval(blinkInterval);
    }
  }, [isWaving]);

  const getISTTime = () => {
    const istTime = toZonedTime(currentTime, 'Asia/Kolkata');
    return format(istTime, 'HH:mm');
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 pointer-events-none">
      <div className={`transition-all duration-500 ${isWaving ? 'animate-bounce' : ''}`}>
        {/* Mascot Body */}
        <div className="relative">
          {/* Main Body */}
          <div className="w-24 h-28 bg-gradient-to-b from-purple-400 via-purple-500 to-purple-600 rounded-full relative shadow-xl">
            {/* Face */}
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
              {/* Eyes */}
              <div className="flex space-x-2.5 mb-1.5">
                <div className={`w-2.5 h-2.5 bg-white rounded-full relative transition-all duration-200 shadow-sm ${eyesBlink ? 'h-0.5 scale-y-10' : ''}`}>
                  {!eyesBlink && (
                    <>
                      <div className="w-1.5 h-1.5 bg-black rounded-full absolute top-0.5 left-0.5"></div>
                      <div className="w-0.5 h-0.5 bg-white rounded-full absolute top-0.5 left-1"></div>
                    </>
                  )}
                </div>
                <div className={`w-2.5 h-2.5 bg-white rounded-full relative transition-all duration-200 shadow-sm ${eyesBlink ? 'h-0.5 scale-y-10' : ''}`}>
                  {!eyesBlink && (
                    <>
                      <div className="w-1.5 h-1.5 bg-black rounded-full absolute top-0.5 left-0.5"></div>
                      <div className="w-0.5 h-0.5 bg-white rounded-full absolute top-0.5 left-1"></div>
                    </>
                  )}
                </div>
              </div>
              {/* Cute smile */}
              <div className="w-4 h-2 border-b-3 border-white rounded-full opacity-90"></div>
              {/* Cute cheek blush */}
              <div className="absolute -left-1 top-2 w-1.5 h-1 bg-pink-300 rounded-full opacity-40"></div>
              <div className="absolute -right-1 top-2 w-1.5 h-1 bg-pink-300 rounded-full opacity-40"></div>
            </div>

            {/* Arms with more character */}
            <div className={`absolute top-9 -left-2.5 w-5 h-2.5 bg-purple-500 rounded-full transform transition-all duration-300 shadow-md ${isWaving ? 'rotate-45 animate-pulse scale-110' : 'rotate-12'}`}></div>
            <div className={`absolute top-9 -right-2.5 w-5 h-2.5 bg-purple-500 rounded-full transform transition-all duration-300 shadow-md ${isWaving ? '-rotate-45 animate-pulse scale-110' : '-rotate-12'}`}></div>

            {/* Digital Clock on chest */}
            <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-gray-900 rounded-md px-2 py-1 shadow-lg border border-gray-700">
              <div className="text-green-400 font-mono text-xs font-bold tracking-wider">
                {getISTTime()}
              </div>
              <div className="text-green-300 font-mono text-xs opacity-70 text-center">
                IST
              </div>
            </div>

            {/* Legs */}
            <div className="absolute -bottom-2 left-4 w-3.5 h-5 bg-purple-600 rounded-full shadow-md"></div>
            <div className="absolute -bottom-2 right-4 w-3.5 h-5 bg-purple-600 rounded-full shadow-md"></div>
          </div>

          {/* Speech bubble when waving */}
          {isWaving && (
            <div className="absolute -top-10 -right-16 bg-white rounded-lg p-3 shadow-lg animate-fade-in border border-purple-200">
              <div className="text-xs font-medium text-purple-700 whitespace-nowrap">
                Leave applied! 🎉
              </div>
              <div className="absolute bottom-0 right-8 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white transform translate-y-full"></div>
            </div>
          )}

          {/* Floating hearts when waving */}
          {isWaving && (
            <>
              <div className="absolute -top-4 left-2 text-red-400 animate-ping">💜</div>
              <div className="absolute -top-6 right-2 text-pink-400 animate-pulse delay-300">💙</div>
              <div className="absolute -top-2 right-6 text-purple-400 animate-bounce delay-500">💚</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelooMascot;