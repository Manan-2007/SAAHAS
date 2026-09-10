import { WellBeingMetric, ScheduledEvent, ChatMessage, ClientRecord, LanguageCode } from '../types';

export const USER_PROFILE = {
  name: 'Sunita',
  fullName: 'Sunita Devi',
  avatar: 'https://lh3.googleusercontent.com/aida/AEtjO1VEyAdYi5Yksnru_1OPhZWlg32VyMC0WRPb4X8Naj0MQOI-8GTGIf1Mx6rXvVJWsTNdlrdTv96zLXRdSrcTP6VtrfmngLPaP3j2DhTlNYBF-xw1BYXZs0Q-uuKtD6UTqmrSM8Slh_orJ2lYlKMLzEPUoPI1J0L_5py49yNtv1tcmxxrnD0MjPETL0amsM-j7HUx7DnUF8JelwHSzUIcbDfU3NBsR-yIc9bGj_EiGAkrrfGdiSyqC9brAYA',
  caseRef: 'DL-2026-F498A-082',
  assignedCounsellor: 'Dr. Ananya Sharma',
  counsellorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCj0Cgm845_iauBgW1URjyHl7QTDgMNqV9IPba6MqeLbnAyuxkyjBbefkzU07eGudlkFZZe6roI7K_BYKCs37Lb8LL5kCRrUmW1pYnEBiJoDSx-0F9BXyxiWbXK85_I0EKEg3VcblZMbPq-Piq29WvlYiSeRs6Fz_75psSKbSRe2Bi5hog4-ImCm4RAmzUE5ULR3dR4VOEoxmwq6mLhlI3aYTnnnQbxoGHDzHXgePyXg3Nq1GFsMQcH',
  counsellorRole: 'Assigned Trauma-Informed Counsellor',
  counsellorPhone: '1800-724-227',
};

export const INITIAL_WELLBEING_METRICS: WellBeingMetric[] = [
  {
    id: 'stress',
    name: 'Stress',
    description: 'Calming down compared to Monday',
    trend: 'Improving',
    icon: 'trending_down',
    category: 'stress',
  },
  {
    id: 'energy',
    name: 'Energy',
    description: 'Holding steady at personal baseline',
    trend: 'Stable',
    icon: 'trending_flat',
    category: 'energy',
  },
  {
    id: 'fatigue',
    name: 'Fatigue',
    description: 'Slightly elevated (after late hearing)',
    trend: 'Rest needed',
    icon: 'bedtime',
    category: 'fatigue',
  },
];

export const SCHEDULED_EVENTS: ScheduledEvent[] = [
  {
    id: 'court-hearing',
    month: 'Sep',
    day: '14',
    title: 'Court Hearing (District Session)',
    timing: 'Thursday · 10:30 AM',
    tag: 'Preparation assistance available',
    tagIcon: 'shield',
    actionLabel: 'Prep Guide',
    actionView: 'legal-prep',
    isConfirmed: true,
  },
  {
    id: 'counsellor-session',
    month: 'Sep',
    day: '16',
    title: 'Follow-up with Counsellor Dr. Ananya',
    timing: 'Saturday · 4:00 PM (30 min)',
    tag: 'Confirmed virtual session',
    tagIcon: 'verified',
    actionLabel: 'Ready',
    isConfirmed: true,
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'sahaas',
    senderName: 'SAHAAS Sanctuary',
    text: 'Welcome Sunita. You are in a quiet, zero-trace safe space. Take your time. How are you feeling this evening?',
    timestamp: '7:15 PM',
  },
  {
    id: 'msg-2',
    sender: 'user',
    senderName: 'Sunita',
    text: 'A bit anxious about the upcoming district court session on Thursday. Thinking about standing in the courtroom makes my chest feel tight.',
    timestamp: '7:18 PM',
  },
  {
    id: 'msg-3',
    sender: 'sahaas',
    senderName: 'SAHAAS Sanctuary',
    text: 'That physical tightness is your nervous system trying to protect you. It is completely natural after what you have navigated. Remember, Dr. Ananya and your legal support advocate will be seated right beside you. Would you like to review the step-by-step room layout, or do a gentle 2-minute somatic grounding breath together first?',
    timestamp: '7:19 PM',
  },
];

export const COUNSELLOR_CASELOAD: ClientRecord[] = [
  {
    id: 'client-1',
    name: 'Sunita Devi',
    age: 32,
    caseRef: 'DL-2026-F498A-082',
    status: 'Stable',
    lastCheckIn: 'Today · 7:15 PM',
    nextHearing: 'Sep 14 (District Court)',
    assignedCounsellor: 'Dr. Ananya Sharma',
    notes: 'Emotional baseline stabilizing. Expressed court apprehension; recommended trauma-informed witness prep guide and 4-7-8 breathing.',
    recentTrends: {
      stress: 'Improving',
      energy: 'Stable',
      fatigue: 'Rest needed',
    },
  },
  {
    id: 'client-2',
    name: 'Meera K.',
    age: 28,
    caseRef: 'DL-2026-DV-119',
    status: 'Attention',
    lastCheckIn: 'Yesterday · 4:30 PM',
    nextHearing: 'Sep 22 (Family Court)',
    assignedCounsellor: 'Dr. Ananya Sharma',
    notes: 'Nighttime panic symptoms noted after interim maintenance notice. Scheduled an extra virtual check-in on Friday.',
    recentTrends: {
      stress: 'Elevated',
      energy: 'Low',
      fatigue: 'High',
    },
  },
  {
    id: 'client-3',
    name: 'Priya R.',
    age: 35,
    caseRef: 'DL-2026-PO-044',
    status: 'Stable',
    lastCheckIn: '2 days ago',
    nextHearing: 'Oct 03 (Sessions Court)',
    assignedCounsellor: 'Dr. Ananya Sharma',
    notes: 'Safe accommodation secured with partner NGO. Transition phase ongoing smoothly with emotional support.',
    recentTrends: {
      stress: 'Improving',
      energy: 'Stable',
      fatigue: 'Moderate',
    },
  },
];

export const EMERGENCY_HELPLINES = [
  {
    title: 'Women in Distress National Helpline',
    number: '181',
    hours: '24/7 Free & Toll-Free',
    type: 'Crisis & Shelter Support',
  },
  {
    title: 'National Emergency Response System',
    number: '112',
    hours: '24/7 Emergency Dispatch',
    type: 'Police & Medical Rescue',
  },
  {
    title: 'Legal Services Authority (NALSA Free Aid)',
    number: '15100',
    hours: '9:30 AM - 6:00 PM',
    type: 'Free Legal Representation',
  },
  {
    title: 'KIRAN Mental Health Rehabilitation',
    number: '1800-599-0019',
    hours: '24/7 Psychological First Aid',
    type: 'Trauma & Psychological Care',
  },
];

export const TRANSLATIONS: Record<LanguageCode, {
  appName: string;
  privateSafe: string;
  quickExit: string;
  homeTitle: string;
  viewingAs: string;
  victimUser: string;
  switchAdmin: string;
  switchToUser: string;
  greeting: string;
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
    viewingAs: 'Viewing as:',
    victimUser: 'Victim/User',
    switchAdmin: 'Switch to Admin Demo',
    switchToUser: 'Switch to User View',
    greeting: 'Good evening, Sunita',
    feelingPrompt: 'How are you feeling today?',
    peaceSubtitle: 'This space is quiet, protected, and completely at your own pace.',
    waysToReflect: 'WAYS TO REFLECT',
    encrypted: 'End-to-end encrypted',
    talkToSahaas: 'Talk to SAHAAS',
    talkToSahaasDesc: "Share what's on your mind anytime in confidence. No pressure, no rush.",
    voiceCheckIn: 'Voice Check-in',
    voiceDesc: 'A gentle 60-second check-in using your voice. Express feeling without typing.',
    quickDailyCheckIn: 'Quick Daily Check-in',
    quickDailyDesc: '3 simple questions to record your baseline without clinical interrogation.',
    wellbeingSnapshot: 'Self-Awareness Snapshot',
    yourWellbeing: 'Your Well-being Today',
    stableToday: 'Stable today',
    upcomingEvents: 'Upcoming Support & Events',
    needSomeone: 'Need someone to talk to right now?',
    needSomeoneDesc: 'You are not carrying this alone. Your designated counsellor is on standby to listen without judgment or legal obligation.',
    talkCounsellor: 'Talk with Counsellor',
    messageCounsellor: 'Message',
    confidentialFooter: 'No interaction data, voice recordings, or history are stored in your device\'s browser cache. Selecting Quick Exit instantly resets your active session.',
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
    viewingAs: 'देखा जा रहा है:',
    victimUser: 'उपयोगकर्ता / पीड़िता',
    switchAdmin: 'एडमिन डेमो पर जाएं',
    switchToUser: 'उपयोगकर्ता दृश्य पर लौटें',
    greeting: 'शुभ संध्या, सुनीता',
    feelingPrompt: 'आज आप कैसा महसूस कर रही हैं?',
    peaceSubtitle: 'यह स्थान शांत, सुरक्षित और आपकी अपनी गति पर आधारित है।',
    waysToReflect: 'साझा करने और विचार के तरीके',
    encrypted: 'एंड-टू-एंड एन्क्रिप्टेड',
    talkToSahaas: 'साहस (SAHAAS) से बात करें',
    talkToSahaasDesc: 'बिना किसी संकोच या दबाव के अपनी बात साझा करें।',
    voiceCheckIn: 'आवाज़ से चेक-इन',
    voiceDesc: '६० सेकंड में अपनी आवाज़ से दिल की बात कहें। बिना टाइप किए।',
    quickDailyCheckIn: 'त्वरित दैनिक चेक-इन',
    quickDailyDesc: 'बिना किसी चिकित्सकीय सवाल के ३ सरल प्रश्नों से अपना हाल बताएं।',
    wellbeingSnapshot: 'आत्म-जागरूकता सारांश',
    yourWellbeing: 'आज आपका मानसिक स्वास्थ्य',
    stableToday: 'आज स्थिर',
    upcomingEvents: 'आगामी सहायता व घटनाक्रम',
    needSomeone: 'क्या अभी किसी से बात करने की आवश्यकता है?',
    needSomeoneDesc: 'आप इस सफर में अकेली नहीं हैं। आपकी परामर्शदाता बिना किसी निर्णय या दबाव के सुनने के लिए उपलब्ध हैं।',
    talkCounsellor: 'परामर्शदाता से बात करें',
    messageCounsellor: 'संदेश भेजें',
    confidentialFooter: 'आपकी बातचीत, रिकॉर्डिंग या इतिहास आपके डिवाइस में संग्रहीत नहीं होते। क्विक एग्ज़िट तुरंत सत्र रीसेट करता है।',
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
    viewingAs: 'ਵੇਖ ਰਹੇ ਹੋ:',
    victimUser: 'ਉਪਭੋਗਤਾ',
    switchAdmin: 'ਐਡਮਿਨ ਡੈਮੋ ਵੇਖੋ',
    switchToUser: 'ਉਪਭੋਗਤਾ ਵੇਖੋ',
    greeting: 'ਸ਼ੁਭ ਸ਼ਾਮ, ਸੁਨੀਤਾ',
    feelingPrompt: 'ਅੱਜ ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?',
    peaceSubtitle: 'ਇਹ ਜਗ੍ਹਾ ਸ਼ਾਂਤ, ਸੁਰੱਖਿਅਤ ਅਤੇ ਤੁਹਾਡੀ ਆਪਣੀ ਰਫ਼ਤਾਰ ਤੇ ਹੈ।',
    waysToReflect: 'ਮਨ ਸਾਂਝਾ ਕਰਨ ਦੇ ਤਰੀਕੇ',
    encrypted: 'ਸੁਰੱਖਿਅਤ ਏਨਕ੍ਰਿਪਟਡ',
    talkToSahaas: 'ਸਾਹਸ ਨਾਲ ਗੱਲ ਕਰੋ',
    talkToSahaasDesc: 'ਬਿਨਾਂ ਕਿਸੇ ਦਬਾਅ ਦੇ ਆਪਣੇ ਮਨ ਦੀ ਗੱਲ ਸਾਂਝੀ ਕਰੋ।',
    voiceCheckIn: 'ਆਵਾਜ਼ ਨਾਲ ਚੈੱਕ-ਇਨ',
    voiceDesc: '੬੦ ਸਕਿੰਟਾਂ ਵਿੱਚ ਆਪਣੀ ਆਵਾਜ਼ ਨਾਲ ਭਾਵਨਾਵਾਂ ਦੱਸੋ।',
    quickDailyCheckIn: 'ਰੋਜ਼ਾਨਾ ਚੈੱਕ-ਇਨ',
    quickDailyDesc: '੩ ਸਧਾਰਣ ਸਵਾਲਾਂ ਨਾਲ ਆਪਣੇ ਹਾਲ ਬਾਰੇ ਦੱਸੋ।',
    wellbeingSnapshot: 'ਸਵੈ-ਜਾਗਰੂਕਤਾ ਝਲਕ',
    yourWellbeing: 'ਅੱਜ ਤੁਹਾਡੀ ਸਿਹਤ',
    stableToday: 'ਅੱਜ ਸੰਤੁਲਿਤ',
    upcomingEvents: 'ਆਉਣ ਵਾਲੀਆਂ ਮਿਤੀਆਂ',
    needSomeone: 'ਕੀ ਹੁਣੇ ਕਿਸੇ ਨਾਲ ਗੱਲ ਕਰਨੀ ਚਾਹੁੰਦੇ ਹੋ?',
    needSomeoneDesc: 'ਤੁਸੀਂ ਇਕੱਲੇ ਨਹੀਂ ਹੋ। ਤੁਹਾਡੀ ਕਾਊਂਸਲਰ ਬਿਨਾਂ ਕਿਸੇ ਫੈਸਲੇ ਦੇ ਸੁਣਨ ਲਈ ਤਿਆਰ ਹਨ।',
    talkCounsellor: 'ਕਾਊਂਸਲਰ ਨਾਲ ਗੱਲ ਕਰੋ',
    messageCounsellor: 'ਸੁਨੇਹਾ ਭੇਜੋ',
    confidentialFooter: 'ਤੁਹਾਡਾ ਕੋਈ ਵੀ ਡਾਟਾ ਬ੍ਰਾਊਜ਼ਰ ਕੈਸ਼ ਵਿੱਚ ਨਹੀਂ ਰੱਖਿਆ ਜਾਂਦਾ। ਕੁਇੱਕ ਐਗਜ਼ਿਟ ਤੁਰੰਤ ਸਭ ਸਾਫ਼ ਕਰਦਾ ਹੈ।',
    navHome: 'ਮੁੱਖ',
    navChat: 'ਗੱਲਬਾਤ',
    navVoice: 'ਆਵਾਜ਼',
    navWellbeing: 'ਸਿਹਤ',
    navSupport: 'ਸਹਾਇਤਾ',
  },
};
