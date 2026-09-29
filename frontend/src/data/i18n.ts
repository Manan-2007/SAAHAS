// Interface strings in English, Hindi and Punjabi. Hindi and Punjabi are
// drafts that need a native reviewer (see CLAUDE.md, known gaps).

import type { LanguageCode } from '../types';

export const TRANSLATIONS: Record<LanguageCode, {
  appName: string;
  privateSafe: string;
  quickExit: string;
  homeTitle: string;
  greeting: string;
  greetingMorning: string;
  greetingEvening: string;
  feelingPrompt: string;
  peaceSubtitle: string;
  waysToReflect: string;
  encrypted: string;
  talkToSahaas: string;
  talkToSahaasDesc: string;
  voiceCheckIn: string;
  voiceDesc: string;
  quickDailyCheckIn: string;
  quickDailyDesc: string;
  wellbeingSnapshot: string;
  yourWellbeing: string;
  stableToday: string;
  upcomingEvents: string;
  needSomeone: string;
  needSomeoneDesc: string;
  talkCounsellor: string;
  messageCounsellor: string;
  confidentialFooter: string;
  navHome: string;
  navChat: string;
  navVoice: string;
  navWellbeing: string;
  navSupport: string;
}> = {
  en: {
    appName: 'SAHAAS',
    privateSafe: 'Private & Safe',
    quickExit: 'Quick Exit',
    homeTitle: 'Home Dashboard',
    greeting: 'Hello, {name}',
    greetingMorning: 'Good morning, {name}',
    greetingEvening: 'Good evening, {name}',
    feelingPrompt: 'How are you feeling today?',
    peaceSubtitle: 'This space is quiet, protected, and completely at your own pace.',
    waysToReflect: 'WAYS TO REFLECT',
    encrypted: 'Encrypted',
    talkToSahaas: 'Talk to SAHAAS',
    talkToSahaasDesc: "Share what's on your mind anytime in confidence. No pressure, no rush.",
    voiceCheckIn: 'Voice Check-in',
    voiceDesc: 'A gentle 60-second check-in using your voice. Express feeling without typing.',
    quickDailyCheckIn: 'Quick Daily Check-in',
    quickDailyDesc: 'A few gentle questions, about two minutes. No right or wrong answers.',
    wellbeingSnapshot: 'Self-Awareness Snapshot',
    yourWellbeing: 'Your Well-being Today',
    stableToday: 'Stable today',
    upcomingEvents: 'Upcoming Support & Events',
    needSomeone: 'Need someone to talk to right now?',
    needSomeoneDesc: 'You are not carrying this alone. Your designated counsellor is on standby to listen without judgment or legal obligation.',
    talkCounsellor: 'Talk with Counsellor',
    messageCounsellor: 'Message',
    confidentialFooter: 'Everything you share is encrypted, and nothing is kept on this phone. You choose what is saved, and Quick Exit signs you out instantly.',
    navHome: 'Home',
    navChat: 'Chat',
    navVoice: 'Voice',
    navWellbeing: 'Well-being',
    navSupport: 'Support',
  },
  hi: {
    appName: 'साहस (SAHAAS)',
    privateSafe: 'निजी एवं सुरक्षित',
    quickExit: 'त्वरित निकास (Exit)',
    homeTitle: 'होम डैशबोर्ड',
    greeting: 'नमस्ते, {name}',
    greetingMorning: 'सुप्रभात, {name}',
    greetingEvening: 'शुभ संध्या, {name}',
    feelingPrompt: 'आज आप कैसा महसूस कर रही हैं?',
    peaceSubtitle: 'यह स्थान शांत, सुरक्षित और आपकी अपनी गति पर आधारित है।',
    waysToReflect: 'साझा करने और विचार के तरीके',
    encrypted: 'एन्क्रिप्टेड',
    talkToSahaas: 'साहस (SAHAAS) से बात करें',
    talkToSahaasDesc: 'बिना किसी संकोच या दबाव के अपनी बात साझा करें।',
    voiceCheckIn: 'आवाज़ से चेक-इन',
    voiceDesc: '६० सेकंड में अपनी आवाज़ से दिल की बात कहें। बिना टाइप किए।',
    quickDailyCheckIn: 'त्वरित दैनिक चेक-इन',
    quickDailyDesc: 'कुछ हल्के सवाल, लगभग दो मिनट। कोई सही या गलत जवाब नहीं।',
    wellbeingSnapshot: 'आत्म-जागरूकता सारांश',
    yourWellbeing: 'आज आपका मानसिक स्वास्थ्य',
    stableToday: 'आज स्थिर',
    upcomingEvents: 'आगामी सहायता व घटनाक्रम',
    needSomeone: 'क्या अभी किसी से बात करने की आवश्यकता है?',
    needSomeoneDesc: 'आप इस सफर में अकेली नहीं हैं। आपकी परामर्शदाता बिना किसी निर्णय या दबाव के सुनने के लिए उपलब्ध हैं।',
    talkCounsellor: 'परामर्शदाता से बात करें',
    messageCounsellor: 'संदेश भेजें',
    confidentialFooter: 'आप जो भी साझा करते हैं वह एन्क्रिप्टेड है और इस फ़ोन पर कुछ नहीं रखा जाता। क्या सहेजा जाए, यह आप चुनते हैं; क्विक एग्ज़िट तुरंत साइन आउट करता है।',
    navHome: 'होम',
    navChat: 'चैट',
    navVoice: 'आवाज़',
    navWellbeing: 'स्वास्थ्य',
    navSupport: 'सहायता',
  },
  pa: {
    appName: 'ਸਾਹਸ (SAHAAS)',
    privateSafe: 'ਨਿੱਜੀ ਅਤੇ ਸੁਰੱਖਿਅਤ',
    quickExit: 'ਤੁਰੰਤ ਬਾਹਰ (Exit)',
    homeTitle: 'ਮੁੱਖ ਡੈਸ਼ਬੋਰਡ',
    greeting: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, {name}',
    greetingMorning: 'ਸ਼ੁਭ ਸਵੇਰ, {name}',
    greetingEvening: 'ਸ਼ੁਭ ਸ਼ਾਮ, {name}',
    feelingPrompt: 'ਅੱਜ ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?',
    peaceSubtitle: 'ਇਹ ਜਗ੍ਹਾ ਸ਼ਾਂਤ, ਸੁਰੱਖਿਅਤ ਅਤੇ ਤੁਹਾਡੀ ਆਪਣੀ ਰਫ਼ਤਾਰ ਤੇ ਹੈ।',
    waysToReflect: 'ਮਨ ਸਾਂਝਾ ਕਰਨ ਦੇ ਤਰੀਕੇ',
    encrypted: 'ਏਨਕ੍ਰਿਪਟਡ',
    talkToSahaas: 'ਸਾਹਸ ਨਾਲ ਗੱਲ ਕਰੋ',
    talkToSahaasDesc: 'ਬਿਨਾਂ ਕਿਸੇ ਦਬਾਅ ਦੇ ਆਪਣੇ ਮਨ ਦੀ ਗੱਲ ਸਾਂਝੀ ਕਰੋ।',
    voiceCheckIn: 'ਆਵਾਜ਼ ਨਾਲ ਚੈੱਕ-ਇਨ',
    voiceDesc: '੬੦ ਸਕਿੰਟਾਂ ਵਿੱਚ ਆਪਣੀ ਆਵਾਜ਼ ਨਾਲ ਭਾਵਨਾਵਾਂ ਦੱਸੋ।',
    quickDailyCheckIn: 'ਰੋਜ਼ਾਨਾ ਚੈੱਕ-ਇਨ',
    quickDailyDesc: 'ਕੁਝ ਹਲਕੇ ਸਵਾਲ, ਲਗਭਗ ਦੋ ਮਿੰਟ। ਕੋਈ ਸਹੀ ਜਾਂ ਗਲਤ ਜਵਾਬ ਨਹੀਂ।',
    wellbeingSnapshot: 'ਸਵੈ-ਜਾਗਰੂਕਤਾ ਝਲਕ',
    yourWellbeing: 'ਅੱਜ ਤੁਹਾਡੀ ਸਿਹਤ',
    stableToday: 'ਅੱਜ ਸੰਤੁਲਿਤ',
    upcomingEvents: 'ਆਉਣ ਵਾਲੀਆਂ ਮਿਤੀਆਂ',
    needSomeone: 'ਕੀ ਹੁਣੇ ਕਿਸੇ ਨਾਲ ਗੱਲ ਕਰਨੀ ਚਾਹੁੰਦੇ ਹੋ?',
    needSomeoneDesc: 'ਤੁਸੀਂ ਇਕੱਲੇ ਨਹੀਂ ਹੋ। ਤੁਹਾਡੀ ਕਾਊਂਸਲਰ ਬਿਨਾਂ ਕਿਸੇ ਫੈਸਲੇ ਦੇ ਸੁਣਨ ਲਈ ਤਿਆਰ ਹਨ।',
    talkCounsellor: 'ਕਾਊਂਸਲਰ ਨਾਲ ਗੱਲ ਕਰੋ',
    messageCounsellor: 'ਸੁਨੇਹਾ ਭੇਜੋ',
    confidentialFooter: 'ਤੁਸੀਂ ਜੋ ਸਾਂਝਾ ਕਰਦੇ ਹੋ ਉਹ ਏਨਕ੍ਰਿਪਟਡ ਹੈ ਅਤੇ ਇਸ ਫ਼ੋਨ ਤੇ ਕੁਝ ਨਹੀਂ ਰੱਖਿਆ ਜਾਂਦਾ। ਕੁਇੱਕ ਐਗਜ਼ਿਟ ਤੁਰੰਤ ਸਾਈਨ ਆਊਟ ਕਰਦਾ ਹੈ।',
    navHome: 'ਮੁੱਖ',
    navChat: 'ਗੱਲਬਾਤ',
    navVoice: 'ਆਵਾਜ਼',
    navWellbeing: 'ਸਿਹਤ',
    navSupport: 'ਸਹਾਇਤਾ',
  },
};
