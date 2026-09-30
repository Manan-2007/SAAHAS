// The warm style's line for the day (ui_style 'warm', backend.md 6f).
// Strength-based, about the person - never about how they "should" feel.
// Hindi is a draft for native review; Punjabi falls back to English.

import type { LanguageCode } from '../../types';

const AFFIRMATIONS: Record<'en' | 'hi', string[]> = {
  en: [
    'speaking up took courage. it’s still in you today.',
    'you’re allowed to rest.',
    'what happened was not your fault.',
    'small steps count, even the ones nobody sees.',
    'your feelings make sense. you don’t owe anyone an explanation.',
    'asking for help is a kind of strength.',
    'one breath, one hour, one day. that’s enough.',
    'your voice matters, here and in your case.',
  ],
  hi: [
    'आवाज़ उठाने में साहस लगा था। वह आज भी आपमें है।',
    'आराम करना ठीक है।',
    'जो हुआ, उसमें आपकी कोई ग़लती नहीं थी।',
    'हर छोटा कदम मायने रखता है, वो भी जो कोई नहीं देखता।',
    'आपकी भावनाएँ सही हैं। किसी को सफ़ाई देने की ज़रूरत नहीं।',
    'मदद माँगना भी हिम्मत है।',
    'एक साँस, एक घंटा, एक दिन। इतना काफ़ी है।',
    'आपकी आवाज़ मायने रखती है, यहाँ भी और आपके मामले में भी।',
  ],
};

/** The same line all day, a different one tomorrow. */
export function affirmationFor(language: LanguageCode, date = new Date()): string {
  const list = AFFIRMATIONS[language === 'hi' ? 'hi' : 'en'];
  const index = (date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate()) % list.length;
  return list[index];
}
