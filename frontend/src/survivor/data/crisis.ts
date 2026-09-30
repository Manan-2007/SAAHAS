// Crisis handling that must never be weakened (CLAUDE.md). The backend is the
// source of truth - any crisis: true shows the banner - and this is the same
// client-side safety net Safe Chat has always had, so the banner still shows
// when the chat model is offline. It runs on what the person wrote, only.

export const DEFAULT_CRISIS_MESSAGE =
  "If you're thinking about harming yourself or you're in danger right now, please reach out immediately: Emergency 112 · Women Helpline 181 · Tele-MANAS 14416 (24x7 mental health support).";

export const CRISIS_RE =
  /\b(suicid\w*|kill(ing)? myself|end(ing)? (my life|it all)|want(ed)? to die|wanna die|don'?t want to (live|be alive|be here)|better off dead|no reason to live|self[- ]?harm\w*|hurt(ing)? myself|cut(ting)? myself|overdos\w*|(going|gonna|trying) to (kill|hurt) me|not safe (at home|right now|here)|in danger)\b/i;

export const looksLikeCrisis = (text: string) => CRISIS_RE.test(text);
