import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Lock } from 'lucide-react';
import { LanguageCode } from '../types';
import type { Wellbeing } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { CheckInFlow } from './CheckInFlow';

interface WellBeingTrackerProps {
  onBack: () => void;
  language: LanguageCode;
  onWellbeing: (w: Wellbeing) => void;
  onOpenCall: () => void;
}

export const WellBeingTracker: React.FC<WellBeingTrackerProps> = ({
  onBack,
  language,
  onWellbeing,
  onOpenCall,
}) => {
  const { user, lock } = useAuth();
  const [activeTab, setActiveTab] = useState<'checkin' | 'breathing' | 'grounding'>('checkin');

  // 4-7-8 Breathing Circle State
  const [breathActive, setBreathActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [breathCount, setBreathCount] = useState(4);

  useEffect(() => {
    let timer: any = null;
    if (breathActive) {
      timer = setInterval(() => {
        setBreathCount((prev) => {
          if (prev <= 1) {
            if (breathPhase === 'inhale') {
              setBreathPhase('hold');
              return 7;
            } else if (breathPhase === 'hold') {
              setBreathPhase('exhale');
              return 8;
            } else {
              setBreathPhase('inhale');
              return 4;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [breathActive, breathPhase]);

  // 5-4-3-2-1 Sensory Grounding state
  const [sensoryStep, setSensoryStep] = useState(1);

  return (
    <div className="flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 gap-5 pb-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-[#e5dac4] text-[#5c5142] hover:text-[#9c6743] flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="text-xs font-semibold text-[#7a5a3f] bg-[#e7d3b5]/40 px-3 py-1 rounded-full">
          Self-Compassion Space
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#efe7d6] p-1 rounded-2xl border border-[#e5dac4] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('checkin')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'checkin'
              ? 'bg-white text-[#9c6743] shadow-2xs'
              : 'text-[#5c5142] hover:text-[#352e24]'
          }`}
        >
          Check-in
        </button>
        <button
          onClick={() => setActiveTab('breathing')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'breathing'
              ? 'bg-white text-[#9c6743] shadow-2xs'
              : 'text-[#5c5142] hover:text-[#352e24]'
          }`}
        >
          4-7-8 Breathing
        </button>
        <button
          onClick={() => setActiveTab('grounding')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'grounding'
              ? 'bg-white text-[#9c6743] shadow-2xs'
              : 'text-[#5c5142] hover:text-[#352e24]'
          }`}
        >
          5-4-3-2-1 Sensory
        </button>
      </div>

      {/* TAB 1: Check-in questionnaires (the backend decides which is due) */}
      {activeTab === 'checkin' &&
        (user.role === 'victim' ? (
          <CheckInFlow language={language} onWellbeing={onWellbeing} onOpenCall={onOpenCall} />
        ) : (
          <div className="bg-white rounded-3xl p-6 border border-[#e5dac4] shadow-xs flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#efe7d6] text-[#9c6743] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#352e24]">Check-ins need an account</h3>
            <p className="text-xs text-[#5c5142] max-w-sm leading-relaxed">
              They're saved so your counsellor can notice when things get harder. Breathing and grounding work without one.
            </p>
            <button onClick={lock} className="text-xs font-semibold text-[#9c6743] hover:underline">
              Create an account
            </button>
          </div>
        ))}

      {/* TAB 2: 4-7-8 Breathing Circle */}
      {activeTab === 'breathing' && (
        <div className="bg-white rounded-3xl p-6 border border-[#e5dac4] shadow-xs flex flex-col items-center text-center gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#9c6743]">
              Somatic Calming
            </span>
            <h3 className="text-xl font-bold text-[#352e24] mt-0.5">
              4-7-8 Parasympathetic Reset
            </h3>
            <p className="text-xs text-[#5c5142] mt-1 max-w-sm">
              Inhale through nose for 4s, hold gently for 7s, exhale through mouth for 8s to calm the vagus nerve.
            </p>
          </div>

          {/* Breathing Visual Circle */}
          <div className="relative flex items-center justify-center my-6">
            <div
              className={`rounded-full flex flex-col items-center justify-center transition-all duration-1000 shadow-xl ${
                breathPhase === 'inhale'
                  ? 'w-48 h-48 bg-[#ecdcbf] text-[#3a2c1e] scale-110'
                  : breathPhase === 'hold'
                  ? 'w-48 h-48 bg-[#b3654a] text-white scale-105'
                  : 'w-36 h-36 bg-[#9c6743] text-white scale-90'
              }`}
            >
              <span className="text-xs uppercase font-bold tracking-widest opacity-80">
                {breathPhase}
              </span>
              <span className="text-4xl font-mono font-bold mt-1">
                {breathActive ? breathCount : '4'}
              </span>
            </div>
          </div>

          {/* Start/Stop Button */}
          <button
            onClick={() => setBreathActive(!breathActive)}
            className="px-6 py-3 rounded-2xl bg-[#9c6743] text-white text-sm font-semibold hover:bg-[#b3654a] transition-all flex items-center gap-2 shadow-sm"
          >
            {breathActive ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause Breath</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Begin Breathing Loop</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* TAB 3: 5-4-3-2-1 Sensory Grounding */}
      {activeTab === 'grounding' && (
        <div className="bg-white rounded-3xl p-6 border border-[#e5dac4] shadow-xs flex flex-col gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#9c6743]">
              Trauma Grounding Anchor
            </span>
            <h3 className="text-lg font-bold text-[#352e24] mt-0.5">
              5-4-3-2-1 Sensory Check
            </h3>
            <p className="text-xs text-[#5c5142] mt-1 leading-relaxed">
              When thoughts spin about court dates or memories, orient your sensory organs directly to your current physical room.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {[
              { num: 5, label: "5 things you can SEE around you (a color, texture, light reflection)" },
              { num: 4, label: "4 things you can physically TOUCH (your clothes, chair, your own hands)" },
              { num: 3, label: "3 things you can HEAR (a fan hum, distant vehicle, your own breath)" },
              { num: 2, label: "2 things you can SMELL (fresh air, clothing, tea/coffee)" },
              { num: 1, label: "1 comforting truth you can tell yourself ('I am protected right now')" },
            ].map((stepItem) => (
              <div
                key={stepItem.num}
                onClick={() => setSensoryStep(stepItem.num)}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                  sensoryStep === stepItem.num
                    ? 'border-[#9c6743] bg-[#efe7d6]'
                    : 'border-[#e5dac4] bg-white opacity-80'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[#9c6743] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {stepItem.num}
                </div>
                <span className="text-xs font-medium text-[#352e24] leading-normal">
                  {stepItem.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
