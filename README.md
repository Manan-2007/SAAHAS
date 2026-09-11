# SAHAAS - Empathetic Sanctuary

A trauma-informed sanctuary app (React frontend) with a local voice emotion
analysis service (FastAPI backend) behind its Voice Companion check-in.

```
user/
├── frontend/   # SAHAAS React + Vite + Tailwind app
├── backend/    # Voice emotion detection service (FastAPI + PyTorch)
├── start.sh    # runs both (macOS / Linux)
└── start.bat   # runs both (Windows)
```

## Quick start

Requirements: Python 3.12 and Node.js.

```bash
./start.sh
```

Then open http://localhost:3000. The first run creates `backend/venv`,
installs both sides' dependencies, and downloads ~3.5 GB of model
checkpoints from Hugging Face. Until the backend finishes loading, the Voice
Companion shows "Voice analysis is offline" with a Retry button.

Manual setup, in two terminals:

```bash
cd backend
python3.12 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

## How they're wired

- **Voice Companion** (`frontend/src/components/VoiceCompanion.tsx`) streams
  the microphone as raw Float32 PCM to `WS /ws/predict` and shows the live
  tone. When the 60-second check-in ends (or "Finish Early"), it flushes
  trailing silence so the backend finalizes the last utterance, then builds
  the reflection from the real results.
- **Voice notes**: "Or share a voice note" uploads a `.wav`/`.mp3` to
  `POST /predict`.
- **Well-being trends**: a check-in with at least 2 s of speech updates
  Stress / Energy / Fatigue, which the Home Dashboard renders.
- **Safe Chat**: SAHAAS AI replies come from a local language model
  (`POST /chat`, Qwen3-4B on Apple Silicon via MLX) with a trauma-informed
  system prompt. Chat voice notes go through the voice emotion model, and
  the detected tone gently informs the reply. Messages suggesting self-harm
  or danger show a helpline banner with a "call your counsellor" button. If
  the chat model is unavailable, the chat falls back to scripted replies.
- **Training the chat**: drop datasets into
  `backend/chat_training/datasets/` and run `backend/train_chat.sh`. See
  [`backend/chat_training/README.md`](backend/chat_training/README.md) for
  where to get data and how to judge the results.
- **API client**: `frontend/src/lib/emotionApi.ts` wraps every backend call.
- **Health**: `GET /health` reports whether the service is up and which
  models loaded; the frontend uses it to show the offline state.

In dev and `vite preview`, Vite proxies `/health`, `/predict` and `/ws` to
the backend, so the browser only talks to one origin and needs no CORS
setup.

### Configuration

| Where | Variable | Purpose |
|---|---|---|
| `frontend/.env.local` | `BACKEND_URL` | Backend the Vite proxy targets (default `http://127.0.0.1:8000`) |
| `frontend/.env.local` | `VITE_API_URL` | Production only: backend origin when it's hosted separately from the built frontend |
| backend env | `CORS_ORIGINS` | Comma-separated frontend origins allowed to call the backend (default `*`) |
| backend env | `SAHAAS_DATA_DIR` | Where the database, encryption key and local bucket live (default `backend/data`) |
| backend env | `SAHAAS_DATA_KEY` | Fernet key encrypting personal data and recordings. Generated into `data/secret.key` if unset - **back it up** |
| backend env | `SAHAAS_SESSION_DAYS` | How long a sign-in session lasts (default `30`) |
| backend env | `SAHAAS_STORAGE` | Recordings bucket: `local` (default, encrypted files) or `s3` (Supabase / MinIO / R2 / AWS) |

Accounts, sign-in and the recordings bucket are documented in
[`backend/README.md`](backend/README.md) under **Auth** and **Storage**.

For a production deploy with separate hosts, build the frontend with
`VITE_API_URL=https://your-backend` and start the backend with
`CORS_ORIGINS=https://your-frontend`. Alternatively, put both behind one
reverse proxy that forwards `/health`, `/predict` and `/ws` to the backend
(remember WebSocket upgrade headers for `/ws`).

The microphone only works on `localhost` or over HTTPS.

See [`backend/README.md`](backend/README.md) for the backend's API, models,
and evaluation harness.
