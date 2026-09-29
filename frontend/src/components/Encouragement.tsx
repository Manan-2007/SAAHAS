import React, { useEffect, useState } from 'react';
import { Sparkles, Sun, HeartHandshake, Flower2 } from 'lucide-react';
import type { LanguageCode } from '../types';
import { Progress, api } from '../lib/api';

// The encouraging card on the warm-style home screen. Strength-based words and
// counts of things the person did - never how they felt, never a streak to
// break or a number that can go down.

const AFFIRMATIONS: Record<'en' | 'hi', string[]> = {
  en: [
    'Speaking up took courage. That courage is still in you today.',
    'You are allowed to rest. Rest is part of getting through this.',
    'What happened to you was not your fault.',
    'Every small step counts, even the ones nobody sees.',
    'You have come through hard days before. You are not alone in this one.',
    'Your feelings make sense. You don’t have to explain them to anyone.',
    'Asking for help is a strength, not a weakness.',
    'You deserve to be treated with dignity - by everyone, including yourself.',
    'One breath, one hour, one day. That is enough.',
    'Your voice matters, in this app and in your case.',
  ],
  hi: [
    'आवाज़ उठाने के लिए साहस चाहिए था। वह साहस आज भी आपके अंदर है।',
    'आराम करना ठीक है। आराम भी इस सफ़र का हिस्सा है।',
    'आपके साथ जो हुआ, उसमें आपकी कोई गलती नहीं थी।',
    'हर छोटा कदम मायने रखता है, वो भी जो कोई नहीं देखता।',
    'मुश्किल दिन पहले भी आए और गए। इस बार भी आपके साथ लोग हैं।',
    'आपकी भावनाएँ सही हैं। आपको किसी को सफ़ाई देने की ज़रूरत नहीं।',
    'मदद माँगना कमज़ोरी नहीं, हिम्मत है।',
    'आप सम्मान की हक़दार हैं - सबसे, और ख़ुद से भी।',
    'एक साँस, एक घंटा, एक दिन। इतना काफ़ी है।',
    'आपकी आवाज़ मायने रखती है - यहाँ भी और आपके मामले में भी।',
  ],
};

function todaysIndex(n: number) {
  const d = new Date();
  return (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % n;
}

export const Encouragement: React.FC<{ language: LanguageCode; firstName: string; onBreathe?: () => void }> = ({
  language,
  firstName,
}) => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const list = AFFIRMATIONS[language === 'hi' ? 'hi' : 'en'];
  const affirmation = list[todaysIndex(list.length)];

  useEffect(() => {
    let live = true;
    api.progress().then((p) => live && setProgress(p)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const wins: { icon: React.ElementType; text: string }[] = [];
  if (progress) {
    if (progress.days_active_7d > 0) {
      wins.push({
        icon: Sun,
        text: `You showed up for yourself on ${progress.days_active_7d} ${progress.days_active_7d === 1 ? 'day' : 'days'} this week.`,
      });
    }
    if (progress.checkins_14d > 0) {
      wins.push({
        icon: Flower2,
        text: `${progress.checkins_14d} gentle ${progress.checkins_14d === 1 ? 'check-in' : 'check-ins'} in the last two weeks.`,
      });
    }
    if (progress.conversations_7d > 0) {
      wins.push({ icon: HeartHandshake, text: 'You shared what was on your mind. That takes strength.' });
    }
  }

  return (
    <section className="relative rounded-2xl overflow-hidden p-5 border border-[#efd9e3] shadow-xs"
             style={{ background: 'linear-gradient(135deg, #fbe7ef 0%, #fdf1e8 55%, #f3e8f7 100%)' }}>
      <div className="absolute -top-8 -right-6 w-32 h-32 rounded-full bg-white/40 blur-2xl pointer-events-none" />
      <div className="relative flex flex-col gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#a24d72]">
          <Sparkles className="w-3.5 h-3.5 sparkle-in" /> For you today, {firstName}
        </span>
        <p className="text-base sm:text-lg font-semibold text-[#4a2a3a] leading-snug">“{affirmation}”</p>
        {wins.length > 0 ? (
          <ul className="flex flex-col gap-1.5 pt-1">
            {wins.map((w, i) => {
              const Icon = w.icon;
              return (
                <li key={i} className="flex items-center gap-2 text-xs text-[#6b3f55] sparkle-in" style={{ animationDelay: `${i * 120}ms` }}>
                  <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#b0587a]" />
                  </span>
                  {w.text}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-[#6b3f55]">Whenever you’re ready, a small check-in is a kind thing to do for yourself.</p>
        )}
      </div>
    </section>
  );
};
