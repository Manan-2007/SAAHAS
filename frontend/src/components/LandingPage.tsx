import React from 'react';
import {
  ShieldCheck,
  ArrowRight,
  Phone,
  Mic,
  MessageSquareHeart,
  CalendarClock,
  Activity,
  Users,
  Languages,
  EyeOff,
  Sparkles,
  HeartHandshake,
  LineChart,
  Lock,
} from 'lucide-react';
import { Orb } from './Orb';

interface LandingPageProps {
  onEnter: () => void;
}

const STEPS = [
  { icon: Phone, title: 'Engage', text: 'A gentle check-in over the channel they can reach — app, chat, voice, even a plain phone call.' },
  { icon: Activity, title: 'Sense', text: 'It listens to how they speak and what they say — voice, words, and engagement.' },
  { icon: LineChart, title: 'Score', text: 'A Dynamic Distress Score is updated against their own baseline, with a trend over the whole journey.' },
  { icon: CalendarClock, title: 'Predict', text: 'Court dates are known in advance, so distress around them is forecast before it peaks.' },
  { icon: HeartHandshake, title: 'Act', text: 'A clear, explained alert reaches a human counsellor — who decides and reaches out.' },
];

const FEATURES = [
  { icon: Mic, title: 'Voice check-in', text: 'A 60-second spoken check-in reads emotional tone without a single word typed.' },
  { icon: MessageSquareHeart, title: 'Safe, private chat', text: 'A trauma-informed companion that listens 24×7 — with crisis help one tap away.' },
  { icon: LineChart, title: 'Counsellor command centre', text: 'Caseloads triaged by predicted distress, with an explainable “why” behind every alert.' },
  { icon: Languages, title: 'Multilingual', text: 'English, हिन्दी and ਪੰਜਾਬੀ — designed to reach, not to exclude.' },
  { icon: EyeOff, title: 'Quick safety exit', text: 'One tap masks the screen and clears the session. Nothing lingers on a shared phone.' },
  { icon: Lock, title: 'Consent-first & encrypted', text: 'Personal data is encrypted, opt-in, and deletable anytime. AI triages; humans decide.' },
];

const DIFFERENTIATORS = [
  'Justice-timeline-aware — distress modelled against real case events, not generic weekly pings.',
  'Works on any phone — voice and SMS reach rural victims with no smartphone.',
  'Explainable — every alert shows which signals drove it, so a counsellor can trust and act.',
  'Human-in-the-loop — the system never diagnoses or denies help; it prioritises attention.',
];

const BANDS = [
  { label: 'Stable', range: '0–25', color: '#9c6743', bg: '#efe7d6' },
  { label: 'Watch', range: '26–50', color: '#8a6a4a', bg: '#e7d3b5' },
  { label: 'Elevated', range: '51–75', color: '#9a5b13', bg: '#f3dcc3' },
  { label: 'Critical', range: '76–100', color: '#93000a', bg: '#ffdad6' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const leaveQuickly = () => window.location.replace('https://www.google.com/search?q=weather+today');

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#352e24] font-sans overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-[#f5f1e8]/85 backdrop-blur-md border-b border-[#e5dac4]/70">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-[#9c6743]">SAHAAS</span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 text-[#7a5a3f] text-[11px] font-semibold">
              <Lock className="w-3 h-3" /> Private &amp; Safe
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={leaveQuickly}
              className="text-xs font-semibold text-[#8a7d68] hover:text-[#5c5142] px-2 py-1"
              title="Leave to a neutral page quickly"
            >
              Leave quickly
            </button>
            <button
              onClick={onEnter}
              className="px-4 py-2 rounded-xl bg-[#9c6743] text-white text-sm font-semibold hover:bg-[#835636] transition-colors shadow-sm"
            >
              Enter SAHAAS
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#e7d3b5]/50 blur-3xl pointer-events-none" />
        <div className="absolute top-40 -left-24 w-96 h-96 rounded-full bg-[#9fafca]/20 blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 pt-12 pb-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 border border-[#e5dac4] text-[#7a5a3f] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Smart India Hackathon · PS 26094 · MoSJE
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Justice takes years.
              <br />
              <span className="text-[#9c6743]">Nobody should carry it alone.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#5c5142] leading-relaxed max-w-xl">
              SAHAAS <span className="text-[#7a5a3f] font-semibold">(साहस — courage)</span> is a calm, private
              companion for survivors of atrocities. It checks in gently, senses distress from how you speak and what
              you share, and quietly alerts a human counsellor <span className="font-semibold">before</span> a crisis —
              across the whole justice journey.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={onEnter}
                className="px-6 py-3 rounded-2xl bg-[#9c6743] text-white font-semibold text-sm shadow-md hover:bg-[#835636] active:scale-[0.99] transition-all flex items-center gap-2"
              >
                Get started <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#how"
                className="px-6 py-3 rounded-2xl bg-white text-[#352e24] font-semibold text-sm border border-[#e5dac4] hover:bg-[#efe7d6] transition-colors"
              >
                How it works
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-[#8a7d68]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#9c6743]" /> Consent-first &amp; encrypted</span>
              <span className="inline-flex items-center gap-1.5"><Languages className="w-4 h-4 text-[#9c6743]" /> EN · हिन्दी · ਪੰਜਾਬੀ</span>
              <span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4 text-[#9c6743]" /> Works on any phone</span>
            </div>
          </div>

          {/* Orb hero visual */}
          <div className="relative flex items-center justify-center">
            <div className="rounded-[2rem] bg-gradient-to-br from-white/80 to-[#efe7d6]/60 border border-[#e5dac4] shadow-xl p-8 sm:p-12 flex flex-col items-center gap-5 backdrop-blur-sm">
              <Orb state="idle" size={220} />
              <p className="text-sm text-[#5c5142] text-center max-w-xs leading-relaxed">
                “Take a slow breath. There is no urgency here.” <br />
                <span className="text-xs text-[#8a7d68]">Your listening companion, always at your pace.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The gap */}
      <section className="bg-white border-y border-[#e5dac4]/70">
        <div className="max-w-6xl mx-auto px-5 py-14 grid md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-1">
            <h2 className="text-2xl font-bold leading-snug">The missing layer of care</h2>
            <p className="text-sm text-[#5c5142] mt-3 leading-relaxed">
              Helplines like NHAA 14566 have logged <strong>6.5+ lakh calls</strong> since 2021 — but they stop at
              registering a complaint. Through years of hearings, delays and intimidation,
              <strong> nobody monitors the victim's mental state.</strong> SAHAAS adds exactly that.
            </p>
          </div>
          <div className="md:col-span-2 grid sm:grid-cols-3 gap-4">
            {[
              { stat: 'Years', label: 'a trial can run, with distress spiking around every court date' },
              { stat: '0', label: 'continuous well-being monitoring in the current system' },
              { stat: 'Any phone', label: 'is enough — voice & SMS reach victims with no smartphone' },
            ].map((s) => (
              <div key={s.stat} className="rounded-2xl bg-[#f5f1e8] border border-[#e5dac4] p-5">
                <div className="text-2xl font-bold text-[#9c6743]">{s.stat}</div>
                <p className="text-xs text-[#5c5142] mt-1.5 leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Distress Score */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-[#9c6743]">The heart of SAHAAS</span>
          <h2 className="text-3xl font-bold mt-2">A Dynamic Distress Score</h2>
          <p className="text-sm text-[#5c5142] mt-3 leading-relaxed">
            One 0–100 index per person, recomputed after every check-in from voice, words and engagement — measured
            against <strong>their own baseline</strong>, not a population average, and tracked as a trend across the
            entire justice journey. A rising trajectory triggers help <strong>early</strong>, not after the crisis.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {BANDS.map((b) => (
            <div key={b.label} className="rounded-2xl border border-[#e5dac4] p-4 text-center" style={{ backgroundColor: b.bg }}>
              <div className="text-lg font-bold" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: b.color }}>{b.range}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-[#8a7d68] mt-4">
          Survivors never see a number — only gentle words. The score is for the counsellor who supports them.
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white border-y border-[#e5dac4]/70">
        <div className="max-w-6xl mx-auto px-5 py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#9c6743]">How it works</span>
            <h2 className="text-3xl font-bold mt-2">From a quiet check-in to a human reaching out</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl bg-[#f5f1e8] border border-[#e5dac4] p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#9c6743] text-white flex items-center justify-center">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-[#e5dac4]">0{i + 1}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#352e24]">{s.title}</h3>
                  <p className="text-xs text-[#5c5142] mt-1 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#9c6743]">What's inside</span>
          <h2 className="text-3xl font-bold mt-2">Calm for survivors. Clarity for counsellors.</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white border border-[#e5dac4] p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#efe7d6] text-[#9c6743] flex items-center justify-center">
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#352e24]">{f.title}</h3>
                <p className="text-sm text-[#5c5142] mt-1 leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why different */}
      <section className="bg-gradient-to-br from-[#b3654a] to-[#9c6743] text-white">
        <div className="max-w-6xl mx-auto px-5 py-16">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">Why it wins</span>
            <h2 className="text-3xl font-bold mt-2">Not a chatbot. An early-warning system.</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {DIFFERENTIATORS.map((d) => (
              <div key={d} className="flex items-start gap-3 p-4 rounded-2xl bg-white/12 border border-white/20 backdrop-blur-sm">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-[#e7d3b5]" />
                <p className="text-sm leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white border border-[#e5dac4] p-6 shadow-xs flex flex-col gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#efe7d6] text-[#9c6743] flex items-center justify-center">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold">For survivors</h3>
          <p className="text-sm text-[#5c5142] leading-relaxed">
            A safe, unhurried space to be heard — in your language, at your pace, with support and a way out always
            within reach. No numbers, no judgement, no pressure.
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-[#e5dac4] p-6 shadow-xs flex flex-col gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#efe7d6] text-[#9c6743] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold">For counsellors &amp; officials</h3>
          <p className="text-sm text-[#5c5142] leading-relaxed">
            A caseload triaged by who needs attention <em>this week</em>, an explainable reason behind every alert,
            and a forecast that turns known court dates into early action.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-5 pb-20">
        <div className="rounded-3xl bg-white border border-[#e5dac4] shadow-md p-8 sm:p-12 text-center flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#c8a97e] to-[#9c6743] flex items-center justify-center shadow-md">
            <HeartHandshake className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold">You don't have to hold it alone.</h2>
          <p className="text-sm text-[#5c5142] max-w-md leading-relaxed">
            Create a private, protected space in under a minute — or step into the counsellor command centre.
          </p>
          <button
            onClick={onEnter}
            className="px-7 py-3.5 rounded-2xl bg-[#9c6743] text-white font-semibold text-sm shadow-md hover:bg-[#835636] active:scale-[0.99] transition-all flex items-center gap-2"
          >
            Enter SAHAAS <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-[#8a7d68] pt-1">
            <Phone className="w-3.5 h-3.5" /> In crisis now? Call 112 · Women's Helpline 181 · Tele-MANAS 14416
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e5dac4]/70 bg-[#efe7d6]/40">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8a7d68]">
          <span className="font-semibold text-[#7a5a3f]">SAHAAS · साहस</span>
          <span className="text-center">
            AI-Powered Dynamic Mental-Health Monitoring for Victims of Atrocities · SIH PS 26094 · Ministry of Social
            Justice &amp; Empowerment
          </span>
          <span>AI triages · humans decide</span>
        </div>
      </footer>
    </div>
  );
};
