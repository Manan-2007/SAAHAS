import React, { useEffect, useState } from 'react';
import {
  Lock,
  ArrowRight,
  Mic,
  CheckCircle2,
  Sparkles,
  Cloud,
  SunMedium,
  Calendar,
  Phone,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Bed,
  Info,
  Shield,
  Clock,
  CheckCheck,
  Headphones
} from 'lucide-react';
import { AppView, LanguageCode, WellBeingMetric } from '../types';
import { TRANSLATIONS } from '../data/mockData';
import { useAuth } from '../auth/AuthProvider';
import { CaseEvent, DueCheckin, EventKind, api } from '../lib/api';

const TREND_COLORS: Record<WellBeingMetric['trend'], string> = {
  Improving: '#9c6743',
  Stable: '#8a6a4a',
  'Rest needed': '#837562',
  Elevated: '#9a5b13',
};

const EVENT_TAGS: Record<EventKind, string> = {
  hearing: 'Preparation help is available',
  fir: 'FIR',
  chargesheet: 'Chargesheet',
  compensation: 'Ask your advocate about the next step',
  counselling: 'With your counsellor',
  other: 'Case date',
};

const eventDate = (ev: CaseEvent) => new Date(`${ev.date}T00:00:00`);

function whenLabel(ev: CaseEvent): string {
  const weekday = eventDate(ev).toLocaleDateString(undefined, { weekday: 'long' });
  const relative = ev.days_until === 0 ? 'Today' : ev.days_until === 1 ? 'Tomorrow' : `In ${ev.days_until} days`;
  return `${weekday} · ${relative}`;
}

// null while loading; 'ready' when a questionnaire is due; otherwise the next date
function nextCheckin(due: DueCheckin[] | null): 'ready' | string | null {
  if (!due) return null;
  if (due.some((d) => d.due)) return 'ready';
  const next = due.map((d) => d.next_due_at).filter((d): d is string => !!d).sort()[0];
  return next ? new Date(next).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : null;
}

interface HomeDashboardProps {
  language: LanguageCode;
  onNavigate: (view: AppView) => void;
  onOpenCall: () => void;
  selectedMood: string;
  onMoodSelect: (mood: string) => void;
  metrics: WellBeingMetric[];
  wellbeingMessage: string | null;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  language,
  onNavigate,
  onOpenCall,
  selectedMood,
  onMoodSelect,
  metrics,
  wellbeingMessage,
}) => {
  const t = TRANSLATIONS[language];
  const { user, lock } = useAuth();
  const isVictim = user.role === 'victim';
  const firstName = user.name.trim().split(' ')[0] || user.name;
  // Personalize the localized greeting by swapping the demo name for the user's.
  const greeting = t.greeting.replace(/Sunita|सुनीता|ਸੁਨੀਤਾ/, firstName);
  const [events, setEvents] = useState<CaseEvent[] | null>(null);
  const [due, setDue] = useState<DueCheckin[] | null>(null);

  // Case dates come from the counsellor; check-ins are scheduled by the backend
  useEffect(() => {
    if (!isVictim) return;
    let live = true;
    api
      .events()
      .then((list) => live && setEvents(list.filter((e) => e.days_until >= 0).slice(0, 3)))
      .catch(() => live && setEvents([]));
    api
      .due()
      .then((list) => live && setDue(list))
      .catch(() => live && setDue([]));
    return () => {
      live = false;
    };
  }, [isVictim]);

  const next = nextCheckin(due);
  const counsellorInitials = (user.counsellor ?? 'C')
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col w-full max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 gap-5 pb-8 animate-fadeIn">
      {/* 1. Aura Greeting */}
      <section className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#efe7d6] via-[#ece2ce] to-[#e7d3b5]/25 p-5 sm:p-6 shadow-xs border border-[#e5dac4]/60">
        {/* Subtle Animated Soothing Aura Ambient */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-[#e7d3b5]/45 blur-2xl pointer-events-none animate-pulse"></div>
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-[#d9bf97]/30 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#9c6743] tracking-wide">
              {greeting}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#352e24] tracking-tight mt-0.5">
              {t.feelingPrompt}
            </h2>
            <p className="text-sm text-[#5c5142] mt-1 leading-relaxed">
              {t.peaceSubtitle}
            </p>
          </div>

          {/* Quick Mood Pulse Chips */}
          <div className="flex items-center gap-2 pt-2 flex-wrap" id="mood-pill-group">
            <button
              onClick={() => onMoodSelect('calm')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 ${
                selectedMood === 'calm'
                  ? 'bg-[#9c6743] text-white ring-2 ring-[#9c6743]/30'
                  : 'bg-white text-[#352e24] hover:bg-[#9c6743]/10'
              }`}
              type="button"
            >
              <Sparkles className={`w-3.5 h-3.5 ${selectedMood === 'calm' ? 'text-white' : 'text-[#8a6a4a]'}`} />
              <span>Calm</span>
            </button>

            <button
              onClick={() => onMoodSelect('tired')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 ${
                selectedMood === 'tired'
                  ? 'bg-[#9c6743] text-white ring-2 ring-[#9c6743]/30'
                  : 'bg-white text-[#352e24] hover:bg-[#9c6743]/10'
              }`}
              type="button"
            >
              <Cloud className={`w-3.5 h-3.5 ${selectedMood === 'tired' ? 'text-white' : 'text-[#9c6743]'}`} />
              <span>A bit tired</span>
            </button>

            <button
              onClick={() => onMoodSelect('reflective')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 ${
                selectedMood === 'reflective'
                  ? 'bg-[#9c6743] text-white ring-2 ring-[#9c6743]/30'
                  : 'bg-white text-[#352e24] hover:bg-[#9c6743]/10'
              }`}
              type="button"
            >
              <SunMedium className={`w-3.5 h-3.5 ${selectedMood === 'reflective' ? 'text-white' : 'text-[#837562]'}`} />
              <span>Reflective</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Ways to Reflect Section */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-[#5c5142] tracking-wider uppercase">
            {t.waysToReflect}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#9c6743]">
            <Lock className="w-3 h-3" />
            <span>{t.encrypted}</span>
          </span>
        </div>

        {/* Talk to SAHAAS Hero Card */}
        <button
          onClick={() => onNavigate('safe-chat')}
          className="group text-left relative rounded-2xl bg-white p-4 shadow-xs hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-between gap-4 border border-[#e5dac4]/60 focus:outline-none"
        >
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="relative w-12 h-12 rounded-xl bg-[#e7d3b5]/60 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-[#7a5a3f]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9c6743] opacity-60"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#9c6743]"></span>
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-[#352e24] group-hover:text-[#9c6743] transition-colors">
                  {t.talkToSahaas}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#ece2ce] text-[#5c5142] text-[10px] font-semibold uppercase tracking-wider">
                  Private
                </span>
              </div>
              <p className="text-xs text-[#5c5142] mt-0.5 line-clamp-2 leading-relaxed">
                {t.talkToSahaasDesc}
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#efe7d6] flex items-center justify-center shrink-0 group-hover:bg-[#9c6743] group-hover:text-white transition-colors">
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Dual Deck for Voice & Quick Check-in */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Voice Check-in Card */}
          <button
            onClick={() => onNavigate('voice-companion')}
            className="group text-left rounded-2xl bg-white p-4 shadow-xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between gap-3 border border-[#e5dac4]/60 focus:outline-none"
          >
            <div className="flex items-center justify-between">
              <div className="relative w-10 h-10 rounded-full bg-[#ecdcbf] flex items-center justify-center shadow-inner">
                <Mic className="w-5 h-5 text-[#3a2c1e]" />
                <span className="absolute inset-0 rounded-full bg-[#9c6743]/10 animate-ping pointer-events-none"></span>
              </div>
              <span className="text-[11px] text-[#9c6743] font-semibold bg-[#efe7d6] px-2 py-0.5 rounded-full border border-[#e5dac4]/50">
                60 seconds
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-[#352e24] group-hover:text-[#9c6743] transition-colors">
                {t.voiceCheckIn}
              </span>
              <p className="text-xs text-[#5c5142] mt-1 leading-relaxed">
                {t.voiceDesc}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#9c6743] pt-1">
              <span>Start gentle recording</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Check-in Card */}
          <button
            onClick={() => onNavigate('well-being')}
            className="group text-left rounded-2xl bg-white p-4 shadow-xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between gap-3 border border-[#e5dac4]/60 focus:outline-none"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#e7d3b5]/50 flex items-center justify-center text-[#7a5a3f]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[11px] text-[#5c5142] font-semibold bg-[#efe7d6] px-2 py-0.5 rounded-full border border-[#e5dac4]/50">
                {next === 'ready' ? 'Ready for you' : '2 minutes'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-[#352e24] group-hover:text-[#9c6743] transition-colors">
                {t.quickDailyCheckIn}
              </span>
              <p className="text-xs text-[#5c5142] mt-1 leading-relaxed">
                {t.quickDailyDesc}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#9c6743] pt-1">
              <span>Begin check-in</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </section>

      {/* 3. 'Your Well-being Today' Card */}
      <section className="rounded-2xl bg-white p-5 shadow-xs flex flex-col gap-4 border border-[#e5dac4]/60">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-col">
            <span className="text-xs text-[#5c5142] font-medium">{t.wellbeingSnapshot}</span>
            <h3 className="text-lg font-bold text-[#352e24]">{t.yourWellbeing}</h3>
          </div>
          {/* Soft Green Status Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e7d3b5]/40 text-[#7a5a3f] text-xs font-semibold">
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{t.stableToday}</span>
          </span>
        </div>

        {wellbeingMessage && <p className="text-sm text-[#5c5142] leading-relaxed -mt-1">{wellbeingMessage}</p>}

        {/* 3 Non-alarmist Indicator Rows */}
        <div className="flex flex-col gap-2.5">
          {metrics.map((m) => {
            const color = TREND_COLORS[m.trend];
            const Icon = m.category === 'fatigue' ? Bed : m.category === 'stress' ? TrendingDown : TrendingUp;
            return (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-[#efe7d6]/60 hover:bg-[#efe7d6] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-2xs" style={{ color }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#352e24]">{m.name}</span>
                    <span className="text-xs text-[#5c5142]">{m.description}</span>
                  </div>
                </div>
                <span
                  className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
                  style={{ color, backgroundColor: `${color}1a` }}
                >
                  {m.trend}
                </span>
              </div>
            );
          })}
        </div>

        {/* Personal Baseline Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#ece2ce]/60 text-[#5c5142] border border-[#e5dac4]/80">
          <Info className="w-4 h-4 text-[#9c6743] shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Indicators are calculated relative to your personal baseline, not diagnostic labels. You are in control of how you interpret this.
          </p>
        </div>
      </section>

      {/* 4. Upcoming Support & Events Section */}
      <section className="rounded-2xl bg-white p-5 shadow-xs flex flex-col gap-4 border border-[#e5dac4]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#ece2ce] flex items-center justify-center text-[#9c6743]">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#352e24]">{t.upcomingEvents}</h3>
          </div>
          <button
            onClick={() => onNavigate('legal-prep')}
            className="text-xs text-[#9c6743] font-semibold hover:underline"
          >
            Hearing guide
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {!isVictim ? (
            <p className="text-xs text-[#5c5142] leading-relaxed">
              With an account, your counsellor can add your hearings and sessions here.
            </p>
          ) : events === null ? (
            <p className="text-xs text-[#8a7d68]">Loading your dates…</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-[#5c5142] leading-relaxed">
              Nothing scheduled right now. Your counsellor adds hearings and sessions here as they're set.
            </p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-[#efe7d6]/50 transition-all hover:bg-[#efe7d6] border border-[#e5dac4]/40"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-white shadow-2xs shrink-0 text-center border border-[#e5dac4]">
                    <span className="text-[10px] uppercase font-bold text-[#9c6743] tracking-wide leading-none">
                      {eventDate(ev).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-base font-bold text-[#352e24] leading-none mt-1">
                      {eventDate(ev).getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-[#352e24] truncate">{ev.title}</span>
                    <span className="text-xs text-[#5c5142]">{whenLabel(ev)}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9c6743] mt-1">
                      <Shield className="w-3 h-3 text-[#9c6743]" />
                      <span>{EVENT_TAGS[ev.kind]}</span>
                    </span>
                  </div>
                </div>
                {ev.kind === 'hearing' && (
                  <button
                    onClick={() => onNavigate('legal-prep')}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#352e24] hover:bg-[#9c6743] hover:text-white text-xs font-semibold shadow-2xs transition-colors shrink-0 border border-[#e5dac4]"
                  >
                    Prep Guide
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Next gentle check-in (scheduled by the backend) */}
        <div className="flex items-center justify-between pt-1 px-1 text-xs gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#9c6743] shrink-0" />
            <span className="text-[#352e24]">
              {!isVictim ? (
                'Check-ins are kept when you have an account'
              ) : next === 'ready' ? (
                <strong className="font-semibold text-[#9c6743]">A gentle check-in is ready for you</strong>
              ) : next ? (
                <>
                  Next gentle check-in: <strong className="font-semibold text-[#9c6743]">{next}</strong>
                </>
              ) : (
                'Your check-ins will appear here'
              )}
            </span>
          </div>
          {!isVictim ? (
            <button onClick={lock} className="text-xs text-[#9c6743] font-semibold hover:underline shrink-0" type="button">
              Create account
            </button>
          ) : (
            next === 'ready' && (
              <button
                onClick={() => onNavigate('well-being')}
                className="text-xs text-[#9c6743] font-semibold hover:underline shrink-0"
                type="button"
              >
                Begin
              </button>
            )
          )}
        </div>
      </section>

      {/* 5. Emergency & Empathetic Support Banner */}
      <section className="rounded-2xl bg-gradient-to-r from-[#b3654a] to-[#9c6743] text-white p-5 sm:p-6 shadow-md flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-white/80 font-bold">
              Immediate Care & Reassurance
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              {t.needSomeone}
            </h3>
          </div>
          <span className="p-2.5 rounded-full bg-white/15 backdrop-blur-sm text-white">
            <Headphones className="w-5 h-5" />
          </span>
        </div>

        <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
          {t.needSomeoneDesc}
        </p>

        {/* Counsellor Direct Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-white/25 text-white text-base font-bold flex items-center justify-center shadow-sm ring-2 ring-white/50">
              {counsellorInitials}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">
                {user.counsellor ?? (isVictim ? 'Counsellor not assigned yet' : 'Support lines')}
              </span>
              <span className="text-xs text-white/80">
                {user.counsellor ? 'Your trauma-informed counsellor' : 'Free helplines, open 24x7'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCall}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white text-[#9c6743] text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#efe7d6] active:scale-95 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>{t.talkCounsellor}</span>
            </button>
            <button
              onClick={() => onNavigate('safe-chat')}
              className="px-3.5 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white/30 active:scale-95 transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t.messageCounsellor}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. Safe Guard Footnote */}
      <footer className="flex flex-col items-center justify-center text-center gap-1.5 pt-2 pb-6 text-[#5c5142]">
        <div className="flex items-center gap-1.5 text-[#9c6743] text-xs">
          <Shield className="w-4 h-4" />
          <span className="font-semibold">Confidential & Encrypted</span>
        </div>
        <p className="text-xs text-[#8a7d68] max-w-md leading-relaxed">
          {t.confidentialFooter}
        </p>
      </footer>
    </div>
  );
};
