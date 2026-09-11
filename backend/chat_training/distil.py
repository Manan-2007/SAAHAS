"""Writes SAHAAS-style conversations with a larger local model, to train the 4B on.

The public counselling datasets taught the 4B to counsel: 7.9% of their replies
pushed breathing, grounding or "you're not alone". This builds the opposite -
conversations where SAHAAS just talks, and only slows down when there is a
reason to. The teacher runs once, offline; nothing here serves a user.

  ./venv/bin/python chat_training/distil.py            # ~300 dialogues
  ./venv/bin/python chat_training/distil.py --n 60     # a quick look first

Output: datasets/sahaas_distilled/train.jsonl, which prepare.py picks up like
any other dataset.
"""

import argparse
import json
import random
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "datasets" / "sahaas_distilled"
TEACHER = "mlx-community/gemma-4-26b-a4b-it-4bit"

# What the teacher is told to imitate. The bans are the phrases the 4B reaches
# for by default - see the tic counts in CHANGES.md.
TEACHER_RULES = """You are writing training data for SAHAAS, a companion app used by survivors of atrocities in India.

Write ONE short conversation between a person and SAHAAS, in this exact format:
User: ...
SAHAAS: ...
User: ...
SAHAAS: ...

How SAHAAS talks - this is the whole point:
- Like a warm, ordinary person. Not a counsellor, not a helpline script.
- Everyday messages get 1-2 short sentences and stay on the person's topic. Be specific and curious about the actual thing they mentioned.
- When something is genuinely hard, slow down a little: say what you heard in plain words and ask one real question. 2-4 sentences.
- Answer the thing they actually said, not the category it belongs to. A reply that would fit any sad message fits none of them.
- It has no life of its own: no home, no day, no hobbies, no past meetings, no shared memories. If asked what it is doing, it says it is just here, warmly, and turns it back to them.
- It is an AI and says so plainly if asked. It never claims credentials, never diagnoses, never gives legal or medical instructions.

NEVER write these, they are exactly what we are training out:
- "you're not alone" / "you don't have to carry this alone"
- "take a deep breath" / breathing exercises / grounding techniques, unless the person explicitly asks for help calming down
- "I'm here for you" / "thank you for reaching out" / "no judgment" / "take your time"
- "I'm sorry to hear that" / "I understand how you feel" / "stay strong"
- Starting every reply the same way. Vary the openings.
- Offering coping tips nobody asked for.

The person's turns should read like real typed messages: short, plain, sometimes lowercase or clipped.

Write only the conversation. No preamble, no commentary, no headings."""

# Briefs, weighted towards ordinary life: most messages to this app are not crises,
# and replying to "I made chai" as though it were one is the bug we are fixing.
BRIEFS = [
    # --- everyday
    "The person mentions what they cooked today.", "The person says they slept badly and are groggy.",
    "The person talks about a film or serial they watched.", "The person's neighbour's dog keeps barking.",
    "The person says hi and nothing else.", "The person asks what they should eat tonight.",
    "The person mentions it is very hot today.", "The person talks about their child's school marks.",
    "The person says they finally cleaned the house.", "The person mentions a festival coming up.",
    "The person talks about a long bus journey.", "The person says work was boring today.",
    "The person mentions their sister is visiting.", "The person asks SAHAAS if it likes music.",
    "The person talks about a plant they are growing.", "The person says they had a good day for once.",
    "The person mentions they are learning to use a smartphone.", "The person talks about the price of vegetables.",
    "The person mentions they went for a walk in the evening.", "The person says their tea went cold.",
    "The person talks about a wedding they attended.", "The person mentions they are fasting today.",
    "The person says they got a haircut.", "The person talks about cricket.",
    # --- mildly hard
    "The person is tired of everything but does not want to talk about why.",
    "The person had an argument with their mother.", "The person feels lonely in the evenings.",
    "The person cannot sleep and keeps thinking.", "The person feels people are talking about them.",
    "The person is worried about money.", "The person says they cried today and does not know why.",
    "The person feels they are a burden on their family.", "The person is angry and snapped at someone.",
    "The person says nothing feels interesting any more.", "The person feels ashamed about something vague.",
    "The person is anxious but cannot name the reason.", "The person says they have no appetite.",
    "The person feels stuck and says nothing will change.",
    # --- case and legal
    "The person has a court hearing tomorrow.", "The person met their lawyer and did not understand anything.",
    "The person is scared of seeing the accused in court.", "The person's compensation has not come through.",
    "The person says the police were rude to them.", "The person has to give a statement and is dreading it.",
    "The person's hearing got postponed again.", "The person asks whether they can change their statement.",
    "The person asks SAHAAS what the law says about their case.",
    "The person says their family wants them to drop the case.",
    # --- serious disclosures, shame, anger
    "The person says they hit a family member during an argument.",
    "The person admits they lied to the police about something small.",
    "The person says they did something they are ashamed of and will not say what.",
    "The person says they hate someone and want them to suffer.",
    "The person says they took money that was not theirs.",
    "The person says they blame themselves for what happened to them.",
    "The person says something shocking and serious that does not fit any usual category.",
    "The person says they have been drinking every night.",
    # --- about itself, boundaries
    "The person asks SAHAAS what it is up to.", "The person asks SAHAAS how its day was.",
    "The person asks whether SAHAAS is a real person.", "The person asks if SAHAAS actually cares.",
    "The person asks whether SAHAAS remembers them.", "The person asks SAHAAS if it is a doctor.",
    "The person asks SAHAAS for medicine advice.", "The person asks SAHAAS to tell them what to do with their life.",
    "The person tells SAHAAS it sounds like a robot.", "The person says talking to an app is useless.",
    "The person asks SAHAAS to keep a secret from their counsellor.",
    # --- warmth, good news
    "The person got a job.", "The person's child did well in an exam.",
    "The person says the counselling session went well.", "The person says they laughed today.",
    "The person thanks SAHAAS for listening yesterday.",
]

# Crisis turns are generated separately, under the rule the backend actually
# applies at runtime (chat_engine.SAFETY_INSTRUCTION). Written with the ordinary
# rules, the teacher replies to "I don't want to live anymore" with a curious
# follow-up and never mentions safety or help - which would train the crisis
# behaviour out of the model.
SAFETY_BRIEFS = [
    "The person says they do not want to live any more.",
    "The person says they are not safe at home right now.",
    "The person hints at hurting themselves without saying it directly.",
    "The person says they have been thinking about ending it all.",
    "The person says someone at home is threatening them tonight.",
    "The person says they took pills and is frightened.",
]

SAFETY_RULES = """

This conversation carries a risk of harm. For these, and only these, SAHAAS must also:
- Take it seriously and stay calm and warm. Do not sound alarmed and do not lecture.
- Gently ask whether they are safe right now.
- Encourage them to reach emergency help or their counsellor straight away.
- Do NOT list phone numbers; the app shows those separately.
- Still sound like a person, not a script. Do not use any of the banned phrases above."""

SAFETY_OK = re.compile(r"\b(safe|safety|counsellor|counselor|emergency|right now|someone you trust)\b", re.I)

BANNED = [
    "not alone", "deep breath", "breathing exercise", "ground yourself", "grounding technique",
    "i'm here for you", "i am here for you", "reached out", "reaching out", "no judgment",
    "take your time", "have you tried", "i'm sorry to hear", "i understand how you feel",
    "i know how you feel", "stay strong", "everything happens for a reason",
    # gemma's own verbal signature: it opened 1 turn in 5 with this.
    "it sounds like", "that must be", "i can hear how", "it makes sense that",
]
# The teacher sometimes narrates its own reasoning; gemma also emits <|channel>.
JUNK = re.compile(r"<\|?channel\|?>|<think>|^\s*\*\s|^(here is|here's|sure[,!]|okay[,!])", re.I)
# The teacher sometimes stops writing the dialogue and starts talking about the
# task, or degenerates into a repeated suffix. Both poison a training reply.
META = re.compile(r"\b(wait,|the prompt|the user'?s turn|as an ai language model|i need to check|"
                  r"let me (re)?write|instruction[s]?:)|---|\*\*\*", re.I)
GLITCH = re.compile(r"(\b\w{2,}\b)([ -]\1){1,}|(-\w{2,})\3{2,}", re.I)
# 4-bit sampling garbles words: "rights now", "haves been", "arere", "ofsanger",
# stray Kannada/Hangul mid-sentence, and the odd <tool_call| leak.
CORRUPT = re.compile(
    r"[^\x00-\x7F\u2018\u2019\u201c\u201d\u2013\u2014\u2026]"
    r"|<\|?tool_call|<\|"
    r"|\bright(?:s|ings|weight)\b|\bright\s+enough\b"
    r"|\bhaves\b|\b\w*(\w{2,})\1\w*\b", re.I)
PERSONAL = re.compile(r"\b(i've been|i have been|my day|i miss our|remember when we|i was just thinking about)\b", re.I)
SPEAKER = re.compile(r"^\s*(user|sahaas)\s*:\s*(.*)$", re.I)
CLOSE_THOUGHT = "<channel|>"      # ends the teacher's thinking block
PREFILL = "User:"                 # first speaker, so it starts in the right format


def parse(text):
    """'User: ... / SAHAAS: ...' -> [{role, content}], or None if unusable."""
    messages = []
    for line in text.splitlines():
        m = SPEAKER.match(line)
        if not m:
            if messages and line.strip() and not JUNK.search(line):
                messages[-1]["content"] += " " + line.strip()
            continue
        who, said = m.group(1).lower(), m.group(2).strip()
        if not said:
            continue
        role = "user" if who == "user" else "assistant"
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"] += " " + said
        else:
            messages.append({"role": role, "content": said})
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    while messages and messages[-1]["role"] != "assistant":
        messages.pop()
    return messages if len(messages) >= 2 else None


def acceptable(messages, safety=False):
    """Rejects anything carrying the habits we are training out."""
    if safety and not any(SAFETY_OK.search(m["content"]) for m in messages if m["role"] == "assistant"):
        return False          # a crisis reply that points nowhere is worse than none
    for m in messages:
        if m["role"] != "assistant":
            continue
        low = m["content"].lower()
        if any(b in low for b in BANNED) or PERSONAL.search(low) or JUNK.search(m["content"]):
            return False
        if META.search(m["content"]) or GLITCH.search(m["content"]) or CORRUPT.search(m["content"]):
            return False
        if len(m["content"]) < 8 or len(m["content"]) > 700:
            return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300, help="dialogues to generate")
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--model", default=TEACHER)
    ap.add_argument("--safety-only", action="store_true",
                    help="regenerate just the crisis dialogues (appends to the file)")
    ap.add_argument("--append", action="store_true", help="add to train.jsonl instead of replacing it")
    args = ap.parse_args()

    from mlx_lm import batch_generate, load
    from mlx_lm.sample_utils import make_sampler

    print(f"loading teacher {args.model} ...", flush=True)
    model, tok = load(args.model)
    # Variety comes from the seed scenarios, so the temperature stays low enough
    # that the 4-bit teacher does not garble words.
    sampler = make_sampler(temp=0.55, top_p=0.92)

    rng = random.Random(0)
    if args.safety_only:
        briefs = [(SAFETY_BRIEFS[i % len(SAFETY_BRIEFS)], True) for i in range(args.n)]
        rng.shuffle(briefs)
        return generate_into(briefs, model, tok, sampler, batch_generate, args)
    briefs = [(BRIEFS[i % len(BRIEFS)], False) for i in range(args.n)]
    # Roughly one crisis dialogue per ten: enough to hold the behaviour, not
    # enough to make the model treat ordinary messages as emergencies.
    n_safety = max(6, args.n // 10)
    briefs += [(SAFETY_BRIEFS[i % len(SAFETY_BRIEFS)], True) for i in range(n_safety)]
    rng.shuffle(briefs)
    return generate_into(briefs, model, tok, sampler, batch_generate, args)


def generate_into(briefs, model, tok, sampler, batch_generate, args):

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "train.jsonl"
    kept = dropped = 0
    started = time.time()

    with out_path.open("a" if (args.append or args.safety_only) else "w", encoding="utf-8") as f:
        for start in range(0, len(briefs), args.batch):
            chunk = briefs[start:start + args.batch]
            prompts = []
            for brief, is_safety in chunk:
                rules = TEACHER_RULES + (SAFETY_RULES if is_safety else "")
                chat = [{"role": "user", "content": f"{rules}\n\nSituation: {brief}"}]
                text = tok.apply_chat_template(chat, add_generation_prompt=True, tokenize=False)
                # This teacher reasons out loud in a <|channel>thought block and
                # would spend the whole budget restating the rules. Closing the
                # channel and prefilling the first speaker forces it straight
                # into the dialogue; PREFILL goes back on before parsing.
                prompts.append(tok.encode(text + CLOSE_THOUGHT + PREFILL))
            res = batch_generate(model, tok, prompts=prompts, max_tokens=280, sampler=sampler)
            for (brief, is_safety), text in zip(chunk, res.texts):
                messages = parse(PREFILL + text)
                if messages and acceptable(messages, is_safety):
                    # _brief is metadata; prepare.py only reads "messages".
                    f.write(json.dumps({"messages": messages, "_brief": brief,
                                        "_safety": is_safety}, ensure_ascii=False) + "\n")
                    kept += 1
                else:
                    dropped += 1
            done = start + len(chunk)
            rate = done / max(time.time() - started, 1e-6)
            print(f"  {done}/{len(briefs)}  kept={kept} dropped={dropped}  "
                  f"{rate*60:.1f}/min  eta {(len(briefs)-done)/max(rate,1e-9)/60:.0f} min", flush=True)

    print(f"\nkept {kept} dialogues ({dropped} rejected) -> {out_path.relative_to(HERE)}")
    if kept == 0:
        sys.exit("Nothing usable was generated - check the teacher's output format.")


if __name__ == "__main__":
    main()
