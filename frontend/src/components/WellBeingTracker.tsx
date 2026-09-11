import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Wind, 
  Sparkles, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  Bed, 
  Info, 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw,
  Check
} from 'lucide-react';
import { WellBeingMetric } from '../types';

interface WellBeingTrackerProps {
  onBack: () => void;
  metrics: WellBeingMetric[];
  onUpdateMetric: (metric: string, status: string) => void;
}

export const WellBeingTracker: React.FC<WellBeingTrackerProps> = ({
  onBack,
  metrics,
  onUpdateMetric,
}) => {
  const [activeTab, setActiveTab] = useState<'checkin' | 'breathing' | 'grounding'>('checkin');

  // Check-in state
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    body: '',
    emotion: '',
    nourishment: '',
  });
  const [checkInDone, setCheckInDone] = useState(false);

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

  const handleFinishCheckin = () => {
    setCheckInDone(true);
    onUpdateMetric('stress', 'Improving');
  };

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
          Daily 3-Question
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

      {/* TAB 1: 3-Question Daily Check-in */}
      {activeTab === 'checkin' && (
        <div className="bg-white rounded-3xl p-6 border border-[#e5dac4] shadow-xs flex flex-col gap-5">
          {!checkInDone ? (
            <>
              <div className="flex items-center justify-between border-b border-[#e5dac4] pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#9c6743]">
                    Question {step} of 3
                  </span>
                  <h3 className="text-lg font-bold text-[#352e24] mt-0.5">
                    {step === 1 && "How does your body feel right now?"}
                    {step === 2 && "What is your emotional landscape today?"}
                    {step === 3 && "What would feel most comforting right now?"}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#efe7d6] text-[#9c6743] font-bold text-xs flex items-center justify-center">
                  {step}/3
                </div>
              </div>

              {/* Step 1 Options */}
              {step === 1 && (
                <div className="flex flex-col gap-2.5">
                  {[
                    "Shoulders or chest feel tense",
                    "A bit heavy and tired",
                    "Settled and relaxed",
                    "Restless energy"
                  ].map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAnswers({ ...answers, body: opt });
                        setStep(2);
                      }}
                      className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all active:scale-[0.99] flex items-center justify-between ${
                        answers.body === opt
                          ? 'border-[#9c6743] bg-[#efe7d6] text-[#9c6743]'
                          : 'border-[#e5dac4] hover:bg-[#f5f1e8] text-[#352e24]'
                      }`}
                    >
                      <span>{opt}</span>
                      <span className="w-4 h-4 rounded-full border border-current"></span>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2 Options */}
              {step === 2 && (
                <div className="flex flex-col gap-2.5">
                  {[
                    "Gentle and grounded",
                    "Apprehensive about upcoming events",
                    "Protected and quiet",
                    "Processing complex emotions"
                  ].map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAnswers({ ...answers, emotion: opt });
                        setStep(3);
                      }}
                      className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all active:scale-[0.99] flex items-center justify-between ${
                        answers.emotion === opt
                          ? 'border-[#9c6743] bg-[#efe7d6] text-[#9c6743]'
                          : 'border-[#e5dac4] hover:bg-[#f5f1e8] text-[#352e24]'
                      }`}
                    >
                      <span>{opt}</span>
                      <span className="w-4 h-4 rounded-full border border-current"></span>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 3 Options */}
              {step === 3 && (
                <div className="flex flex-col gap-2.5">
                  {[
                    "A 5-minute quiet resting period",
                    "Gentle reassurance from Dr. Ananya",
                    "Reviewing my court prep checklist",
                    "Doing a guided breathing cycle"
                  ].map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAnswers({ ...answers, nourishment: opt });
                        handleFinishCheckin();
                      }}
                      className="p-3.5 rounded-xl border border-[#e5dac4] hover:border-[#9c6743] hover:bg-[#efe7d6] text-left text-xs font-medium text-[#352e24] transition-all active:scale-[0.99] flex items-center justify-between"
                    >
                      <span>{opt}</span>
                      <Check className="w-4 h-4 text-[#9c6743]" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-[#e7d3b5]/50 text-[#9c6743] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#352e24]">Check-in Recorded Gently</h3>
                <p className="text-xs text-[#5c5142] mt-1 max-w-sm">
                  Your baseline has been updated safely. No labels or diagnoses are assigned—only your personal awareness.
                </p>
              </div>

              <div className="w-full bg-[#efe7d6] p-3 rounded-2xl text-left text-xs text-[#5c5142] flex flex-col gap-1.5 border border-[#e5dac4]">
                <span className="font-semibold text-[#9c6743]">Your Reflection:</span>
                <span>• Body: {answers.body || "Tension in shoulders"}</span>
                <span>• Landscape: {answers.emotion || "Apprehensive about upcoming events"}</span>
                <span>• Need: {answers.nourishment || "Gentle reassurance"}</span>
              </div>

              <button
                onClick={() => {
                  setCheckInDone(false);
                  setStep(1);
                }}
                className="text-xs font-semibold text-[#9c6743] hover:underline"
              >
                Take check-in again
              </button>
            </div>
          )}
        </div>
      )}

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
