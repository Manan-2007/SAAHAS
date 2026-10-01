import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Eye, EyeOff, Mic, Square, Trash2, UserRound } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { useAuth } from '../../auth/AuthProvider';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { formatDuration, useSafeChat } from '../data/useSafeChat';
import { Button, IconButton } from '../ui/Button';
import { CrisisBanner } from '../ui/CrisisBanner';
import { SafetyCard } from '../ui/SafetyCard';
import { Notice, Serif } from '../ui/primitives';
import { accentStyle } from '../ui/accents';
import { Notebook } from '../illustrations/scenes';

// A private conversation, not customer support. Big readable messages, room
// between them, a calm composer, and a real person one tap away. The AI says
// what it is; it doesn't brand the room.

const STARTERS = [
  'I just want to talk',
  'Something is sitting heavy',
  'I’m worried about what’s coming up',
  'Can you just listen for a bit?',
];

export const Chat: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isVictim, isGuest, navigate, openHelplines, raiseCrisis, crisis } = useSurvivor();
  const [crisisVisible, setCrisisVisible] = useState(false);
  const chat = useSafeChat({
    resume: isVictim,
    onCrisis: (message) => {
      raiseCrisis(message);
      setCrisisVisible(true);
    },
  });
  const [draft, setDraft] = useState('');
  const [discreet, setDiscreet] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const hasSpoken = chat.messages.some((m) => m.sender === 'user');

  useEffect(() => {
    if (chat.messages.length || chat.typing) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages, chat.typing]);

  const submit = (text = draft) => {
    if (chat.send(text) && text === draft) setDraft('');
  };

  const privacyLine = isGuest
    ? 'private · nothing is saved without an account'
    : user.consent.store_messages
      ? 'private · kept encrypted, only for you'
      : 'private · your words aren’t saved';

  const recording = chat.voiceStage === 'recording';
  const busyVoice = chat.voiceStage === 'connecting' || chat.voiceStage === 'processing';

  return (
    <div className="flex flex-col gap-4" style={accentStyle('iris')}>
      <div className="flex items-center gap-2 settle">
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{t('nav.chat')}</h1>
          <p className="text-sm text-ink-2 flex items-center gap-1.5 break-soft">
            {privacyLine}
            {chat.saved && (
              <span className="inline-flex items-center gap-1 text-ink-2">
                · <Check className="w-3.5 h-3.5" aria-hidden /> saved to your journey
              </span>
            )}
          </p>
        </div>
        <IconButton
          icon={discreet ? EyeOff : Eye}
          label={discreet ? 'Show messages' : 'Blur messages (tap one to read it)'}
          pressed={discreet}
          onClick={() => setDiscreet((d) => !d)}
        />
        <IconButton
          icon={UserRound}
          label={isVictim ? 'Talk to your counsellor' : 'Call a helpline'}
          onClick={() => (isVictim ? navigate('counsellor') : openHelplines())}
        />
        {chat.messages.length > 0 && <IconButton icon={Trash2} label="Clear this screen" onClick={chat.clearScreen} />}
      </div>

      {!hasSpoken && chat.messages.length === 0 && (
        <section className="flex flex-col items-center text-center gap-4 pt-2 settle" style={{ ['--i' as string]: 1 }}>
          <div className="w-full max-w-[300px]" aria-hidden>
            <Notebook />
          </div>
          <Serif as="h2" className="text-[28px] leading-[1.2] text-ink">what’s been sitting with you?</Serif>
          <p className="text-[15px] text-ink-2 max-w-[34ch]">
            {t('chat.empty')} You don’t have to explain everything.
          </p>
          <div className="w-full flex flex-col gap-2 pt-1">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="tactile-quiet w-full min-h-12 rounded-tile bg-surface border border-line px-4 text-left text-[15px] text-ink"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-sm text-ink-2 max-w-[38ch] pt-2">
            SAAHAS is an AI companion, not a counsellor. A real person is always one tap away, up top.
          </p>
        </section>
      )}

      {chat.resumed && (
        <p className="text-center text-sm text-ink-2 settle">picking up where you left off</p>
      )}

      <ol className="flex flex-col gap-3" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
        {chat.messages.map((m) => (
          <Bubble key={m.id} message={m} discreet={discreet} />
        ))}
        {chat.typing && (
          <li className="self-start rounded-card rounded-bl-[6px] bg-surface border border-line px-4 py-4 flex gap-1.5" aria-label="SAAHAS is writing">
            {[0, 1, 2].map((i) => (
              <span key={i} className="dot-breath w-2 h-2 rounded-full bg-ink-2" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </li>
        )}
      </ol>

      {chat.offline && (
        <Notice tone="offline" action={<Button variant="ghost" onClick={() => navigate('support')}>{t('nav.support')}</Button>}>
          SAAHAS can’t be reached right now. If you need a person, your counsellor and the free helplines are always in Support.
        </Notice>
      )}
      {chat.notice && <Notice tone="info">{chat.notice}</Notice>}
      {chat.safety && <SafetyCard onDismiss={chat.dismissSafety} />}
      {crisisVisible && crisis && <CrisisBanner message={crisis} onDismiss={() => setCrisisVisible(false)} />}

      <div ref={bottom} className="h-28" aria-hidden />

      {/* The composer sits above the bottom nav, leaving room for the Voice button between. */}
      <div className="fixed inset-x-0 z-30 bottom-[calc(64px+max(0.75rem,env(safe-area-inset-bottom)))] lg:bottom-0 lg:left-[248px] bg-canvas/95 backdrop-blur-md border-t border-line pb-9 lg:pb-4">
        <form
          className="mx-auto w-full max-w-[560px] lg:max-w-[680px] px-4 sm:px-6 pt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <button
            type="button"
            onClick={chat.toggleVoiceNote}
            disabled={busyVoice}
            aria-label={recording ? 'Send your voice note' : 'Record a voice note'}
            style={accentStyle('lilac')}
            className={`w-12 h-12 shrink-0 rounded-full grid place-items-center disabled:opacity-50 ${
              recording ? 'tactile bg-(--accent) text-on-accent' : 'tactile-quiet bg-surface border border-line text-ink-2 hover:text-ink'
            }`}
          >
            {recording ? <Square className="w-4 h-4 fill-current" aria-hidden /> : <Mic className="w-5 h-5" aria-hidden />}
          </button>
          <label className="sr-only" htmlFor="chat-input">Message</label>
          <textarea
            id="chat-input"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={chat.voiceStage !== 'idle'}
            maxLength={4000}
            placeholder={
              chat.voiceStage === 'connecting'
                ? 'Opening your microphone…'
                : recording
                  ? `Listening… ${formatDuration(chat.recordSeconds)} · tap ■ to send`
                  : chat.voiceStage === 'processing'
                    ? 'Listening to your voice note…'
                    : 'Write what’s on your mind…'
            }
            className="flex-1 min-h-12 max-h-40 rounded-tile bg-surface border border-line px-4 py-3 text-[16px] leading-snug text-ink placeholder:text-ink-2/70 outline-none resize-none focus:border-ink-2 [field-sizing:content]"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || chat.typing || chat.voiceStage !== 'idle'}
            className="tactile w-12 h-12 shrink-0 rounded-full bg-(--accent) text-on-accent grid place-items-center disabled:opacity-35"
          >
            <ArrowUp className="w-5 h-5" aria-hidden strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </div>
  );
};

const Bubble: React.FC<{ message: ChatMessage; discreet: boolean }> = ({ message, discreet }) => {
  const [revealed, setRevealed] = useState(false);
  const mine = message.sender === 'user';
  const notice = message.id.startsWith('note-');
  const hidden = discreet && !revealed;

  if (notice) {
    return <li className="self-center max-w-[40ch] text-center text-sm text-ink-2 py-1 soft-fade break-soft">{message.text}</li>;
  }

  return (
    <li className={`soft-fade flex flex-col gap-1 max-w-[86%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="sr-only">{mine ? 'You said' : 'SAAHAS said'}:</span>
      <div
        tabIndex={discreet ? 0 : undefined}
        onClick={() => discreet && setRevealed((r) => !r)}
        onKeyDown={(e) => discreet && (e.key === 'Enter' || e.key === ' ') && setRevealed((r) => !r)}
        className={`px-4 py-3 text-[16px] leading-relaxed whitespace-pre-line break-soft transition-[filter] duration-300 ${
          mine
            ? 'rounded-card rounded-br-[6px] bg-(--accent) text-on-accent'
            : 'rounded-card rounded-bl-[6px] bg-surface border border-line text-ink'
        } ${hidden ? 'blur-[6px] select-none cursor-pointer' : ''}`}
      >
        {message.isAudio ? (
          <span className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Mic className="w-4 h-4" aria-hidden /> voice note · {message.audioDuration}
            </span>
            {message.text !== 'Voice note' && <span>{message.text.replace(/^Voice note - /, '')}</span>}
          </span>
        ) : (
          message.text
        )}
      </div>
      <span className="text-[12px] text-ink-2/80 px-1">{message.timestamp}</span>
    </li>
  );
};
