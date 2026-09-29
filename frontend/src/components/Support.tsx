import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Phone, PhoneCall, MessageCircle, Send, Clock, CheckCircle2, Scale, Gavel, LifeBuoy,
  AlertTriangle, Loader2, ShieldCheck, CheckSquare, Square, UserRound, CalendarDays,
} from 'lucide-react';
import type { LanguageCode } from '../types';
import { useAuth } from '../auth/AuthProvider';
import {
  ApiError, CaseIssue, CaseUpcoming, ContactRequestView, CounsellorMessage, SupportInfo, api,
} from '../lib/api';
import { openLiveStream } from '../lib/liveStream';
import { CrisisBanner, DEFAULT_CRISIS_MESSAGE } from './CrisisBanner';
import { SafetyCard } from './SafetyCard';

export type SupportTab = 'counsellor' | 'problem' | 'rights' | 'court' | 'helplines';

interface SupportProps {
  initialTab?: SupportTab;
  language: LanguageCode;
  onBack: () => void;
  onOpenCall: () => void;
}

const TABS: { id: SupportTab; label: string; icon: React.ElementType }[] = [
  { id: 'counsellor', label: 'My counsellor', icon: UserRound },
  { id: 'problem', label: 'Report a problem', icon: AlertTriangle },
  { id: 'rights', label: 'My rights', icon: Scale },
  { id: 'court', label: 'Court day', icon: Gavel },
  { id: 'helplines', label: 'Helplines', icon: LifeBuoy },
];

const TIMES: { id: NonNullable<ContactRequestView['preferred_time']>; label: string }[] = [
  { id: 'asap', label: 'As soon as possible' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

// Plain words for where a problem stands - never the counsellor's jargon.
const ISSUE_STATUS: Record<CaseIssue['status'], string> = {
  open: 'Your counsellor has been told',
  in_progress: 'Your counsellor is working on this',
  action_taken: 'Steps have been taken',
  resolved: 'Sorted',
  dismissed: 'Closed',
};

// Rights in plain words, each tied to the law it comes from (checked 2026-09-18;
// the same sources as backend/monitoring/legal_actions.json).
const RIGHTS: { title: Record<'en' | 'hi', string>; body: Record<'en' | 'hi', string>; law: string; problem: string }[] = [
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

const CHECKLIST = [
  { id: 'id', text: 'An ID card (Aadhaar or voter card)' },
  { id: 'papers', text: 'Your FIR copy and any case papers you have' },
  { id: 'companion', text: 'Someone you trust to go with you - you have a right to a companion' },
  { id: 'tickets', text: 'Keep your bus or train tickets - travel costs are paid back' },
  { id: 'water', text: 'Water and something to eat - court days can be long' },
  { id: 'questions', text: 'Write down anything you want to ask your lawyer' },
];
const CHECKLIST_KEY = 'sahaas_court_checklist';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'We couldn’t reach SAHAAS. Please try again.');

const CARD = 'bg-white rounded-2xl p-5 border border-[#e5dac4] shadow-xs';

export const Support: React.FC<SupportProps> = ({ initialTab = 'counsellor', language, onBack, onOpenCall }) => {
  const { user } = useAuth();
  const isVictim = user.role === 'victim';
  const lang = language === 'hi' ? 'hi' : 'en';
  const [tab, setTab] = useState<SupportTab>(initialTab);
  const [info, setInfo] = useState<SupportInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // counsellor tab
  const [time, setTime] = useState<NonNullable<ContactRequestView['preferred_time']>>('asap');
  const [note, setNote] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [thread, setThread] = useState<CounsellorMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [crisis, setCrisis] = useState<string | null>(null);
  const [safety, setSafety] = useState(false);
  const threadEnd = useRef<HTMLDivElement | null>(null);

  // problem tab
  const [categories, setCategories] = useState<{ category: string; label: string }[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [problemNote, setProblemNote] = useState('');
  const [reported, setReported] = useState<CaseIssue[] | null>(null);
  const [reportDone, setReportDone] = useState(false);

  // court tab
  const [dates, setDates] = useState<CaseUpcoming[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(CHECKLIST_KEY) || '{}');
    } catch {
      return {};
    }
  });

  const loadInfo = useCallback(() => {
    if (!isVictim) return;
    api.support().then(setInfo).catch((e) => setError(errorText(e)));
  }, [isVictim]);
  const loadThread = useCallback(() => {
    if (!isVictim) return;
    api.messages().then(setThread).catch(() => setThread([]));
  }, [isVictim]);
  const loadIssues = useCallback(() => {
    if (!isVictim) return;
    api.myIssues().then(setReported).catch(() => setReported([]));
  }, [isVictim]);

  useEffect(() => {
    loadInfo();
    loadThread();
    loadIssues();
  }, [loadInfo, loadThread, loadIssues]);

  // Replies and request updates arrive live, not on the next visit.
  useEffect(() => {
    if (!isVictim) return;
    return openLiveStream('/me/stream', {
      onEvent: (e) => {
        if (e.type === 'message') loadThread();
        if (e.type === 'contact_request') loadInfo();
        if (e.type === 'issue') loadIssues();
      },
    });
  }, [isVictim, loadThread, loadInfo, loadIssues]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread]);

  useEffect(() => {
    if (tab === 'problem' && categories === null && isVictim) {
      api.issueCategories().then(setCategories).catch(() => setCategories([]));
    }
    if (tab === 'court' && dates === null && isVictim) {
      api.case().then((c) => setDates(c.upcoming.filter((u) => u.kind === 'court_date' || u.kind === 'date_changed')))
        .catch(() => setDates([]));
    }
  }, [tab, categories, dates, isVictim]);

  const requestCallback = async () => {
    setRequesting(true);
    setError(null);
    try {
      await api.requestContact({ kind: 'callback', preferred_time: time, note: note.trim() || null });
      setNote('');
      loadInfo();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRequesting(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.sendMessage(text);
      setDraft('');
      setThread((t) => [...(t ?? []), res.message]);
      if (res.crisis) setCrisis(res.crisis_message || DEFAULT_CRISIS_MESSAGE);
      if (res.safety) setSafety(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  };

  const report = async () => {
    if (!picked) return;
    setError(null);
    try {
      await api.reportIssue(picked, problemNote.trim() || null);
      setPicked(null);
      setProblemNote('');
      setReportDone(true);
      loadIssues();
      if (['threat', 'pressure_to_compromise', 'boycott_harassment'].includes(picked)) setSafety(true);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const toggle = (id: string) => {
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      } catch {
        /* private mode: kept for this visit only */
      }
      return next;
    });
  };

  const counsellor = info?.counsellor ?? null;
  const openRequest = useMemo(() => info?.requests.find((r) => r.status !== 'done' && r.kind !== 'ivrs_callback')
    ?? info?.requests.find((r) => r.status !== 'done'), [info]);
  const lastDone = useMemo(() => info?.requests.find((r) => r.status === 'done'), [info]);

  if (!isVictim) {
    return (
      <div className="flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 gap-4 pb-8 animate-fadeIn">
        <button onClick={onBack} className="self-start p-2 rounded-xl bg-white border border-[#e5dac4] text-xs font-semibold flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className={CARD}>
          <p className="text-sm text-[#352e24] font-semibold">A counsellor comes with an account</p>
          <p className="text-xs text-[#5c5142] mt-1">Without an account you can still use every helpline below.</p>
        </div>
        <Helplines onOpenCall={onOpenCall} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 gap-4 pb-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <button onClick={onBack}
                className="p-2 rounded-xl bg-white border border-[#e5dac4] text-[#5c5142] hover:text-[#9c6743] flex items-center gap-1.5 text-xs font-semibold shadow-2xs">
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>
        <span className="text-xs font-semibold text-[#9c6743] bg-[#efe7d6] px-3 py-1 rounded-full border border-[#e5dac4]">
          Support &amp; your rights
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const badge = t.id === 'counsellor' && (info?.unread_messages ?? 0) > 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className={`relative shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      tab === t.id ? 'bg-[#9c6743] text-white border-[#9c6743] shadow-xs' : 'bg-white text-[#5c5142] border-[#e5dac4] hover:bg-[#efe7d6]'
                    }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {badge && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ba1a1a] text-white text-[10px] flex items-center justify-center">{info!.unread_messages}</span>}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="text-xs text-[#93000a] bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl px-3 py-2">{error}</p>}
      {crisis && <CrisisBanner message={crisis} onCall={onOpenCall} onDismiss={() => setCrisis(null)} />}
      {safety && <SafetyCard counsellor={counsellor?.name} onDismiss={() => setSafety(false)} />}

      {tab === 'counsellor' && (
        <>
          <section className={`${CARD} flex flex-col gap-3`}>
            {counsellor?.name ? (
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full bg-[#efe7d6] text-[#9c6743] flex items-center justify-center font-bold">
                  {counsellor.name.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#352e24]">{counsellor.name}</p>
                  <p className="text-xs text-[#5c5142]">Your counsellor{counsellor.hours ? ` · ${counsellor.hours}` : ''}</p>
                </div>
                {counsellor.phone && (
                  <a href={`tel:${counsellor.phone.replace(/[^+\d]/g, '')}`}
                     className="px-3 py-2 rounded-xl bg-[#9c6743] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#835636]">
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#5c5142]">
                A counsellor will be assigned to you soon. Until then, the helplines are open 24x7, and anything you send
                here is kept for them.
              </p>
            )}

            {openRequest ? (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#efe7d6]/70 border border-[#e5dac4]">
                <Clock className="w-4 h-4 text-[#9c6743] mt-0.5 shrink-0" />
                <p className="text-xs text-[#352e24] leading-relaxed">
                  {openRequest.status === 'acknowledged'
                    ? `${counsellor?.name ?? 'Your counsellor'} has seen your request and will call you.`
                    : `You asked for a call back ${openRequest.preferred_time === 'asap' ? 'as soon as possible' : `in the ${openRequest.preferred_time}`}. ${counsellor?.name ?? 'Your counsellor'} has been told.`}
                  {openRequest.response && <span className="block mt-1 text-[#5c5142]">“{openRequest.response}”</span>}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold text-[#5c5142] mb-2">Ask {counsellor?.name ?? 'your counsellor'} to call you</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TIMES.map((t) => (
                      <button key={t.id} onClick={() => setTime(t.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                                time === t.id ? 'bg-[#9c6743] text-white border-[#9c6743]' : 'bg-white text-[#5c5142] border-[#e5dac4]'
                              }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2}
                          placeholder="Anything they should know first? (optional)"
                          className="w-full px-3 py-2 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm outline-none focus:border-[#9c6743]" />
                <button onClick={requestCallback} disabled={requesting}
                        className="w-full py-2.5 rounded-xl bg-[#9c6743] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#835636] disabled:opacity-60">
                  {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                  Request a call back
                </button>
                {lastDone?.response && (
                  <p className="text-[11px] text-[#8a7d68]">Last time: “{lastDone.response}”</p>
                )}
              </>
            )}
          </section>

          <section className={`${CARD} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#9c6743]" />
              <h3 className="text-sm font-bold text-[#352e24]">Messages with {counsellor?.name ?? 'your counsellor'}</h3>
            </div>
            <p className="text-[11px] text-[#8a7d68] -mt-1">
              A real person reads these, usually within a working day. For an emergency call 112.
            </p>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {thread === null ? (
                <p className="text-xs text-[#8a7d68]">Loading…</p>
              ) : thread.length === 0 ? (
                <p className="text-xs text-[#5c5142]">No messages yet. Write whenever you like - there’s no wrong thing to say.</p>
              ) : (
                thread.map((m) => (
                  <div key={m.id} className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    m.sender === 'victim' ? 'self-end bg-[#9c6743] text-white rounded-br-md' : 'self-start bg-[#efe7d6] text-[#352e24] rounded-bl-md'
                  }`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <span className={`block text-[10px] mt-0.5 ${m.sender === 'victim' ? 'text-white/70' : 'text-[#8a7d68]'}`}>{when(m.at)}</span>
                  </div>
                ))
              )}
              <div ref={threadEnd} />
            </div>
            <div className="flex items-end gap-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} rows={2}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                        placeholder={`Write to ${counsellor?.name ?? 'your counsellor'}…`}
                        className="flex-1 px-3 py-2 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm outline-none focus:border-[#9c6743]" />
              <button onClick={send} disabled={!draft.trim() || sending} aria-label="Send"
                      className="p-3 rounded-xl bg-[#9c6743] text-white hover:bg-[#835636] disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </section>
        </>
      )}

      {tab === 'problem' && (
        <section className={`${CARD} flex flex-col gap-3`}>
          <div>
            <h3 className="text-sm font-bold text-[#352e24]">Something wrong with your case?</h3>
            <p className="text-xs text-[#5c5142] mt-0.5 leading-relaxed">
              Tell us what happened. Your counsellor gets it straight away, with the legal steps they can take for you.
            </p>
          </div>
          {reportDone && (
            <p className="flex items-center gap-2 text-xs text-[#7a5a3f] bg-[#efe7d6] rounded-xl p-2.5 sparkle-in">
              <CheckCircle2 className="w-4 h-4 text-[#9c6743]" /> Sent. Thank you for telling us - you did the right thing.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            {(categories ?? []).map((c) => (
              <button key={c.category} onClick={() => { setPicked(c.category); setReportDone(false); }}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                        picked === c.category ? 'border-[#9c6743] bg-[#efe7d6] text-[#352e24] font-semibold' : 'border-[#e5dac4] bg-white hover:bg-[#f5f1e8] text-[#352e24]'
                      }`}>
                {c.label}
              </button>
            ))}
            {categories === null && <p className="text-xs text-[#8a7d68]">Loading…</p>}
          </div>
          {picked && (
            <>
              <textarea value={problemNote} onChange={(e) => setProblemNote(e.target.value)} maxLength={2000} rows={3}
                        placeholder="What happened, and when? (optional - share only what feels okay)"
                        className="w-full px-3 py-2 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm outline-none focus:border-[#9c6743]" />
              <button onClick={report} className="w-full py-2.5 rounded-xl bg-[#9c6743] text-white text-sm font-semibold hover:bg-[#835636]">
                Send to my counsellor
              </button>
            </>
          )}
          {reported && reported.length > 0 && (
            <div className="pt-2 border-t border-[#efe7d6] flex flex-col gap-2">
              <p className="text-xs font-semibold text-[#5c5142]">What you’ve told us</p>
              {reported.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-[#352e24]">{r.label}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full font-semibold ${
                    r.status === 'resolved' ? 'bg-[#e7d3b5] text-[#7a5a3f]' : 'bg-[#f5f1e8] text-[#5c5142]'
                  }`}>{ISSUE_STATUS[r.status]}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-[#8a7d68]">If you are in danger right now, call 112.</p>
        </section>
      )}

      {tab === 'rights' && (
        <section className="flex flex-col gap-2.5">
          <div className={CARD}>
            <h3 className="text-sm font-bold text-[#352e24] flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#9c6743]" /> Your rights under the law</h3>
            <p className="text-xs text-[#5c5142] mt-1 leading-relaxed">
              These come from the SC/ST (Prevention of Atrocities) Act and its Rules. If any of them isn’t happening for you,
              tap “This isn’t happening” and your counsellor will take it up.
            </p>
          </div>
          {RIGHTS.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-[#e5dac4] flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-[#352e24]">{r.title[lang]}</p>
              <p className="text-xs text-[#5c5142] leading-relaxed">{r.body[lang]}</p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-[#8a7d68]">{r.law}</span>
                <button onClick={() => { setPicked(r.problem); setReportDone(false); setTab('problem'); }}
                        className="text-[11px] font-semibold text-[#9c6743] hover:underline shrink-0">
                  This isn’t happening
                </button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-[#8a7d68] px-1">General information, not legal advice. Your counsellor and legal aid (15100) can help with your situation.</p>
        </section>
      )}

      {tab === 'court' && (
        <section className="flex flex-col gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#9c6743] to-[#6f4a2f] text-white p-5 shadow-xs">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[#e7d3b5] flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Your next court date
            </span>
            {dates === null ? (
              <p className="text-sm mt-2 text-white/80">Loading…</p>
            ) : dates.length === 0 ? (
              <p className="text-sm mt-2 text-white/90">No court date is on your calendar yet. Your counsellor adds them as they’re set.</p>
            ) : (
              <>
                <p className="text-xl font-bold mt-1">{dates[0].label}</p>
                <p className="text-xs text-white/80 mt-0.5">
                  {new Date(`${dates[0].date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' · '}{dates[0].days_until === 0 ? 'Today' : dates[0].days_until === 1 ? 'Tomorrow' : `in ${dates[0].days_until} days`}
                </p>
              </>
            )}
          </div>
          <div className={CARD}>
            <h4 className="text-sm font-bold text-[#352e24] mb-2">What to expect</h4>
            <ul className="flex flex-col gap-2 text-xs text-[#5c5142] leading-relaxed">
              <li>• Court days often involve waiting. It is normal, and it doesn’t mean something has gone wrong.</li>
              <li>• You can ask your lawyer or the prosecutor to explain anything you don’t understand.</li>
              <li>• If you feel unwell or overwhelmed, you can ask for a short break.</li>
              <li>• You have a right to be heard when bail or the sentence is decided.</li>
            </ul>
          </div>
          <div className={CARD}>
            <h4 className="text-sm font-bold text-[#352e24] mb-2">Before you go</h4>
            <div className="flex flex-col gap-1.5">
              {CHECKLIST.map((c) => (
                <button key={c.id} onClick={() => toggle(c.id)}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-[#e5dac4] hover:bg-[#efe7d6] text-left">
                  {checked[c.id] ? <CheckSquare className="w-5 h-5 text-[#9c6743] shrink-0" /> : <Square className="w-5 h-5 text-[#8a7d68] shrink-0" />}
                  <span className={`text-xs ${checked[c.id] ? 'line-through text-[#8a7d68]' : 'text-[#352e24]'}`}>{c.text}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#8a7d68] mt-2">This list stays on this phone only until you close SAHAAS.</p>
          </div>
        </section>
      )}

      {tab === 'helplines' && <Helplines onOpenCall={onOpenCall} list={info?.helplines} />}
    </div>
  );
};

const DEFAULT_HELPLINES = [
  { number: '112', name: 'Emergency', hours: '24x7', what: 'Police, fire or ambulance if you are in danger now' },
  { number: '14566', name: 'National Helpline Against Atrocities', hours: '24x7, toll-free', what: 'Report an atrocity or a problem with your SC/ST case' },
  { number: '181', name: 'Women Helpline', hours: '24x7', what: 'Support for women facing violence' },
  { number: '14416', name: 'Tele-MANAS', hours: '24x7, free, many languages', what: 'Someone to talk to about how you feel' },
  { number: '15100', name: 'NALSA Legal Aid', hours: 'Free legal help', what: 'Free lawyers and legal advice' },
];

const Helplines: React.FC<{ onOpenCall: () => void; list?: SupportInfo['helplines'] }> = ({ list }) => (
  <section className="flex flex-col gap-2.5">
    {(list && list.length ? list : DEFAULT_HELPLINES).map((h) => (
      <div key={h.number} className="bg-white rounded-2xl p-4 border border-[#e5dac4] shadow-xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h5 className="text-sm font-bold text-[#352e24]">{h.name}</h5>
          <p className="text-xs text-[#5c5142]">{h.what}</p>
          <p className="text-[11px] text-[#8a7d68]">{h.hours}</p>
        </div>
        <a href={`tel:${h.number}`}
           className="px-4 py-2 rounded-xl bg-[#9c6743] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#b3654a] shrink-0">
          <Phone className="w-3.5 h-3.5" /> {h.number}
        </a>
      </div>
    ))}
  </section>
);
