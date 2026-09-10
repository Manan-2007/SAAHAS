import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Shield, Sparkles } from 'lucide-react';
import { USER_PROFILE } from '../data/mockData';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ isOpen, onClose }) => {
  const [callState, setCallState] = useState<'connecting' | 'connected'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCallState('connecting');
      setSeconds(0);
      return;
    }

    const timer = setTimeout(() => {
      setCallState('connected');
    }, 2200);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (callState !== 'connected') return;

    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  if (!isOpen) return null;

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111d23]/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#00685d] to-[#004d45] text-white p-6 shadow-2xl flex flex-col items-center justify-between min-h-[500px] border border-[#a3ede4]/20">
        {/* Top security tag */}
        <div className="w-full flex items-center justify-between text-xs text-[#a3ede4]">
          <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-xs">
            <Shield className="w-3 h-3" />
            <span>End-to-End Encrypted Call</span>
          </span>
          <span className="opacity-75">No logs recorded</span>
        </div>

        {/* Center Avatar & Status */}
        <div className="flex flex-col items-center gap-3 my-auto text-center">
          <div className="relative flex items-center justify-center">
            {/* Pulsing rings when connecting / talking */}
            <div className="absolute w-36 h-36 rounded-full bg-[#a3ede4]/20 animate-ping pointer-events-none"></div>
            <div className="absolute w-28 h-28 rounded-full bg-[#a3ede4]/30 animate-pulse pointer-events-none"></div>
            
            <img
              src={USER_PROFILE.counsellorAvatar}
              alt={USER_PROFILE.assignedCounsellor}
              className="relative z-10 w-24 h-24 rounded-full object-cover ring-4 ring-[#a3ede4] shadow-lg"
            />
          </div>

          <div className="mt-2">
            <h3 className="text-xl font-bold tracking-tight text-white">
              {USER_PROFILE.assignedCounsellor}
            </h3>
            <p className="text-xs text-[#a3ede4] font-medium mt-0.5">
              {USER_PROFILE.counsellorRole}
            </p>
          </div>

          {callState === 'connecting' ? (
            <div className="flex items-center gap-2 text-sm text-[#e9f6fd] animate-pulse">
              <Sparkles className="w-4 h-4 text-[#a3ede4]" />
              <span>Connecting private line...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs tracking-widest text-[#a3ede4] font-mono font-semibold bg-black/20 px-3 py-1 rounded-full">
                {formatTime(seconds)}
              </span>
              <p className="text-xs text-[#e9f6fd]/90 max-w-xs italic leading-relaxed px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-xs">
                "Hello Sunita, I am right here with you. Take a soft breath. You don't have to explain anything you aren't ready to."
              </p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="w-full flex items-center justify-around pt-6 border-t border-white/10">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-red-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={onClose}
            className="w-16 h-16 rounded-full bg-[#ba1a1a] hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isSpeaker ? 'bg-[#a3ede4] text-[#00685d]' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title="Toggle Speaker"
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
