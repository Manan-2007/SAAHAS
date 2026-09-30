import React, { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import type { CaseIssue } from '../../lib/api';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { SAFETY_CATEGORIES, errorText, reportIssue, useIssueCategories, useMyIssues } from '../data/survivorData';
import { Button } from '../ui/Button';
import { SafetyCard } from '../ui/SafetyCard';
import { TextArea } from '../ui/forms';
import { Choice, ChoiceGroup, Notice, Placeholder, ScreenHeader, Stack } from '../ui/primitives';

// Where a reported problem stands, in plain words - never the counsellor's jargon.
const STATUS: Record<CaseIssue['status'], string> = {
  open: 'your counsellor has been told',
  in_progress: 'your counsellor is working on this',
  action_taken: 'steps have been taken',
  resolved: 'sorted',
  dismissed: 'closed',
};

export const Problem: React.FC<{ initialCategory?: string }> = ({ initialCategory }) => {
  const { t } = useLanguage();
  const { back, isVictim } = useSurvivor();
  const categories = useIssueCategories(isVictim);
  const mine = useMyIssues(isVictim);
  const [picked, setPicked] = useState<string | null>(initialCategory ?? null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [safety, setSafety] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!picked) return;
    setSending(true);
    setError(null);
    try {
      await reportIssue(picked, note.trim() || null);
      if (SAFETY_CATEGORIES.has(picked)) setSafety(true);
      setPicked(null);
      setNote('');
      setSent(true);
      mine.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack gap="gap-5">
      <ScreenHeader title={t('support.problem')} onBack={back} />
      <p className="text-[17px] text-ink-2 break-soft">
        Tell us what happened. Your counsellor gets it straight away, with the legal steps they can take for you.
      </p>

      {safety && <SafetyCard onDismiss={() => setSafety(false)} />}
      {sent && (
        <div role="status" className="rounded-card bg-surface border border-line px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-coral shrink-0" aria-hidden />
          <p className="text-[15px] text-ink">Sent. Thank you for telling us - you did the right thing.</p>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <section className="flex flex-col gap-3">
        {categories.state.status === 'loading' ? (
          <Placeholder className="h-64" />
        ) : categories.state.status === 'error' ? (
          <Notice tone="offline" action={<Button variant="ghost" onClick={categories.reload}>{t('common.tryAgain')}</Button>}>
            {t('offline.title')}
          </Notice>
        ) : (
          <ChoiceGroup label="What happened?">
            {(categories.data ?? []).map((c) => (
              <Choice
                key={c.category}
                accent="coral"
                selected={picked === c.category}
                onSelect={() => {
                  setPicked(c.category);
                  setSent(false);
                }}
              >
                <span className="text-[16px]">{c.label}</span>
              </Choice>
            ))}
          </ChoiceGroup>
        )}
      </section>

      {picked && (
        <section className="flex flex-col gap-3 settle">
          <TextArea
            label="What happened, and when? (optional - only what feels okay)"
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="accent" accent="coral" size="lg" full icon={Send} busy={sending} onClick={send}>
            Send to my counsellor
          </Button>
        </section>
      )}

      {!!mine.data?.length && (
        <section aria-labelledby="told" className="rounded-card bg-surface border border-line p-4 flex flex-col gap-3">
          <h2 id="told" className="text-[16px] font-semibold">What you’ve told us</h2>
          <ul className="flex flex-col gap-2.5">
            {mine.data.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 text-[15px]">
                <span className="text-ink break-soft">{r.label}</span>
                <span className="shrink-0 text-ink-2 text-right">{STATUS[r.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-ink-2">If you’re in danger right now, call 112.</p>
    </Stack>
  );
};
