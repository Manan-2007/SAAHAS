# Training the SAHAAS chat model

The SAHAAS AI chat runs a local language model (default
`mlx-community/Qwen3-4B-Instruct-2507-4bit`) fine-tuned with LoRA on
emotional-support conversations, steered by `system_prompt.txt`. Everything
runs on your Mac with Apple's MLX - nothing is sent to a cloud API.

## Workflow

```bash
cd backend
./train_chat.sh fetch     # optional: download the recommended open datasets
# ...and/or drop your own files into chat_training/datasets/
./train_chat.sh           # prepare -> train -> print sample replies
```

- `./train_chat.sh --quick` - 20-iteration smoke test (a minute or two)
- `./train_chat.sh --iters 2000` - train longer
- `./train_chat.sh --resume` - keep training the current adapter on new data

The finished adapter lands in `chat_training/adapters/`. A running backend
hot-swaps it on the next chat message, so there's no need to restart. Before any
training, `/chat` still works using the base model and the system prompt.

## What to tune

| File | Controls |
|---|---|
| `system_prompt.txt` | Persona, therapeutic style, boundaries - also baked into every training example |
| `config.yaml` → `base_model` | Model size; `mlx-community/Qwen3-14B-4bit` is warmer and wiser but ~3x slower |
| `config.yaml` → `data` | Filters (reply length, supporters describing their own lives), per-dataset caps via `source_caps` |
| `config.yaml` → `training` | Iterations, learning rate, LoRA rank |
| `config.yaml` → `safety.crisis_message` | Helplines shown when a message suggests risk |

## Is training actually making it better?

Judge by the replies, not the loss. After training, `./train_chat.sh`
prints the untrained and trained replies side by side for the same
prompts. If the trained replies aren't clearly better, run
`./train_chat.sh revert`.

What we measured with the public sets (Sept 2026, 100 iterations): validation
loss fell from 3.85 to 1.57, yet replies got *worse*. They became short and
advice-first ("Have you tried deep breathing?") instead of reflecting feelings.
The untrained Qwen3-4B with `system_prompt.txt` already listens well, and
training on crowd-sourced support chats pulls it toward their average
style. A lower loss only means it sounds more like the dataset.

So:
- **Out of the box, the untrained model + system prompt is the recommended
  setup.** Edit `system_prompt.txt` first; it's the cheapest, strongest lever.
- **Train when you have your own data** in the exact voice you want
  (counsellor-written or reviewed SAHAAS conversations). Cap the public sets
  low with `source_caps`, or leave them out, so your data sets the style.
- Raise `min_reply_chars` (e.g. 120) if trained replies come out too terse.

## Where to get data

Checked on Hugging Face (Sept 2026). `./train_chat.sh fetch <id>` downloads any of them.

| Dataset | Size / content | License |
|---|---|---|
| `ShenLab/MentalChat16K` | ~16k mental-health counselling conversations | MIT |
| `thu-coai/esconv` | ~1.3k long emotional-support dialogs annotated with support strategies (reflection, validation, questions) - closest to real counselling technique | CC BY-NC 4.0 |
| `Estwld/empathetic_dialogues_llm` | ~25k everyday empathetic chats (EmpatheticDialogues in chat format) | tagged Apache-2.0; original data CC BY-NC 4.0 |
| `facebook/empathetic_dialogues` | Original EmpatheticDialogues | CC BY-NC 4.0 |
| `nbertagnolli/counsel-chat` | Licensed therapists answering real questions (long, advice-style) | no license tag - check before use |
| `Amod/mental_health_counseling_conversations` | Counsel-chat-derived Q&A pairs | gated (accept terms) |
| `EmoCareAI/Psych8k` | ~8k counselling dialogs from the ChatCounselor paper | CC BY-NC-SA 4.0, gated |
| `heliosbrahma/mental_health_chatbot_dataset` | Small mental-health FAQ | MIT |
| `Psychotherapy-LLM/CBT-Bench` | CBT exercises - good for evaluation | CC BY-NC 4.0 |

Gated sets: accept the terms on the dataset's page, run
`./venv/bin/hf auth login`, then fetch.

**Licensing:** CC BY-NC data means a model trained on it is for
non-commercial use. For a commercial SAHAAS, stick to MIT/Apache sources
plus your own data.

**The data that will matter most is your own.** Public sets are mostly
English, Western, and not specific to trauma or legal proceedings. A few
hundred conversations written or reviewed by trauma-informed counsellors,
covering SAHAAS situations (court anxiety, not being believed, safety at
home) and written in Hindi/Punjabi as well as English, will shape the
model more than 25k generic chats. Save them as `messages` JSONL in
`datasets/sahaas_own/`, and consider a lower `max_per_source` for the big
public sets so yours isn't drowned out.

## Safety

- The persona stays honest: it feels warm and human, but says it is an AI
  if asked and never claims credentials. Keep that in `system_prompt.txt`.
- Messages that suggest self-harm or danger trigger a safety banner with
  helplines and a "call your counsellor" button, independent of the model.
- A fine-tuned model is not clinically validated. Have counsellors review
  sample conversations before real users rely on it.
