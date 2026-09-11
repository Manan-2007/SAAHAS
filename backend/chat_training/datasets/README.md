# Drop datasets here

Put any number of `.jsonl`, `.json`, `.csv` or `.parquet` files (or folders
of them) in this folder, then run `./train_chat.sh` from `backend/`.

Every file is read automatically. Supported shapes per record:

| Shape | Example |
|---|---|
| Chat | `{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}` |
| ShareGPT | `{"conversations": [{"from": "human", "value": "..."}, {"from": "gpt", "value": "..."}]}` |
| Dialog | `{"dialog": [{"speaker": "seeker", "text": "..."}, {"speaker": "supporter", "text": "..."}]}` |
| Pairs | columns/keys like `input`/`output`, `prompt`/`response`, `Context`/`Response`, `questionText`/`answerText` |
| Tagged text | `{"text": "<HUMAN>: ... <ASSISTANT>: ..."}` |
| One row per turn | `conv_id`, `utterance_idx`, `utterance` (EmpatheticDialogues CSV) |

The "user" side is the person seeking support; the "assistant" side is the
supporter/therapist whose style the model learns. Your own data (for example,
counsellor-approved example replies written for SAHAAS) is the most valuable
thing you can add - even a few hundred high-quality conversations help.

`./train_chat.sh fetch` downloads a recommended open set into this folder.
Contents here are git-ignored.
