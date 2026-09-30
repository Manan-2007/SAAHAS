// Rights in plain words, each tied to the law it comes from (checked
// 2026-09-18 against the same sources as backend/monitoring/legal_actions.json).
// `problem` is the case-issue category to raise when the right isn't being met.
// Moved unchanged from the old Support screen. Hindi is a draft for review.

export interface Right {
  title: Record<'en' | 'hi', string>;
  body: Record<'en' | 'hi', string>;
  law: string;
  problem: string;
}

export const RIGHTS: Right[] = [
  {
    title: { en: 'To be told about every court date', hi: 'हर अदालती तारीख की सूचना पाने का हक़' },
    body: {
      en: 'Including bail hearings. The prosecutor or the State must inform you in time. The Supreme Court has said this notice is mandatory.',
      hi: 'ज़मानत की सुनवाई भी। सरकारी वकील या राज्य को आपको समय पर बताना होगा। सुप्रीम कोर्ट ने इसे अनिवार्य कहा है।',
    },
    law: 'SC/ST (PoA) Act s.15A(3); Hariram Bhambhi v. Satyanarayan (2021)',
    problem: 'no_hearing_notice',
  },
  {
    title: { en: 'To be heard in court', hi: 'अदालत में अपनी बात रखने का हक़' },
    body: {
      en: 'When bail, release, parole or the sentence is decided, you can speak and give written submissions.',
      hi: 'ज़मानत, रिहाई, पैरोल या सज़ा के फ़ैसले के समय आप अपनी बात कह सकते हैं और लिखित में दे सकते हैं।',
    },
    law: 'SC/ST (PoA) Act s.15A(5)',
    problem: 'no_hearing_notice',
  },
  {
    title: { en: 'Your complaint must be registered', hi: 'आपकी शिकायत दर्ज होनी ही चाहिए' },
    body: {
      en: 'The police must register your FIR and give you a free copy. They cannot insist on an "inquiry first". If they refuse, you can write to the Superintendent of Police.',
      hi: 'पुलिस को आपकी FIR दर्ज करनी होगी और उसकी मुफ़्त कॉपी देनी होगी। "पहले जाँच" की शर्त नहीं लगा सकते। मना करें तो आप पुलिस अधीक्षक (SP) को लिख सकते हैं।',
    },
    law: 'SC/ST (PoA) Act s.4(2)(b)-(c), s.18A; BNSS s.173(4)',
    problem: 'fir_refused',
  },
  {
    title: { en: 'Protection from threats and pressure', hi: 'धमकी और दबाव से सुरक्षा' },
    body: {
      en: 'The State must protect you, your family and witnesses from threats, intimidation or pressure to take back the case. You can also ask for witness protection.',
      hi: 'राज्य को आपकी, आपके परिवार और गवाहों की धमकी, डराने या केस वापस लेने के दबाव से रक्षा करनी होगी। आप गवाह सुरक्षा भी माँग सकते हैं।',
    },
    law: 'SC/ST (PoA) Act s.15A(1); Witness Protection Scheme 2018',
    problem: 'threat',
  },
  {
    title: { en: 'Travel and daily expenses', hi: 'आने-जाने और रोज़ का ख़र्च' },
    body: {
      en: 'Going to the police, hospital or court for your case should not cost you. Travel and daily expenses are paid, and women can bring a companion whose costs are paid too.',
      hi: 'अपने मामले के लिए थाने, अस्पताल या अदालत जाने का ख़र्च आपको नहीं उठाना चाहिए। किराया और रोज़ का ख़र्च मिलता है, और महिलाएँ एक साथी ला सकती हैं जिसका ख़र्च भी मिलता है।',
    },
    law: 'SC/ST (PoA) Rules r.11',
    problem: 'tame_not_paid',
  },
  {
    title: { en: 'Support money, in stages', hi: 'सहायता राशि, चरणों में' },
    body: {
      en: 'Relief is paid at set stages of the case. You never need to remember amounts - your counsellor tracks them and chases anything that hasn’t arrived.',
      hi: 'सहायता राशि मामले के तय चरणों पर मिलती है। आपको रक़म याद रखने की ज़रूरत नहीं - आपके काउंसलर इसका हिसाब रखते हैं।',
    },
    law: 'SC/ST (PoA) Rules r.12(4), Annexure-I',
    problem: 'relief_not_received',
  },
  {
    title: { en: 'A lawyer, free', hi: 'मुफ़्त वकील' },
    body: {
      en: 'You can ask for a senior advocate of your choice for your case, and free legal aid is available on 15100.',
      hi: 'आप अपने मामले के लिए अपनी पसंद के वरिष्ठ वकील की माँग कर सकते हैं, और 15100 पर मुफ़्त कानूनी मदद मिलती है।',
    },
    law: 'SC/ST (PoA) Rules r.4(5); SC/ST (PoA) Act s.15A(12); NALSA 15100',
    problem: 'no_lawyer',
  },
  {
    title: { en: 'To be treated with dignity', hi: 'सम्मान से व्यवहार का हक़' },
    body: {
      en: 'Every official must treat you with fairness, respect and dignity.',
      hi: 'हर अधिकारी को आपसे निष्पक्षता, इज़्ज़त और सम्मान से पेश आना होगा।',
    },
    law: 'SC/ST (PoA) Act s.15A(2)',
    problem: 'disrespect',
  },
];

// Hearing preparation: gentle, practical, no jargon. Moved from the old
// Support screen's "Court day" tab.
export const WHAT_TO_EXPECT = [
  'Court days often involve waiting. That’s normal, and it doesn’t mean something has gone wrong.',
  'You can ask your lawyer or the prosecutor to explain anything you don’t understand.',
  'If you feel unwell or overwhelmed, you can ask for a short break.',
  'You have a right to be heard when important decisions about the case are made.',
];

export const WHAT_TO_BRING = [
  { id: 'id', text: 'An ID card (Aadhaar or voter card)' },
  { id: 'papers', text: 'Your FIR copy and any case papers you have' },
  { id: 'companion', text: 'Someone you trust - you have a right to a companion' },
  { id: 'tickets', text: 'Your bus or train tickets - travel costs are paid back' },
  { id: 'water', text: 'Water and something to eat - court days can be long' },
  { id: 'questions', text: 'Anything you want to ask your lawyer, written down' },
];
