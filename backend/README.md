# Backend

Self-contained voice emotion detection backend. Everything under this
folder — the FastAPI app, the ML pipeline (VAD, classifiers, arousal/valence,
ASR, speaker calibration), the fallback CNN weights, and the eval harness —
has no dependency on anything outside `backend/`. It can be copied as a whole
folder into another project and wired up to that project's own frontend.

See the [root README](../README.md) for the full feature list, architecture
diagram, and how the pipeline was built.

## Integrating into another project

1. Copy this entire `backend/` folder into the target project (e.g. as
   `<project>/backend/`).
2. Install dependencies and run the server:

   ```bash
   cd backend
   python3.12 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
   ```

   or use the bundled launcher (`./start.sh` / `start.bat`), which does the
   same thing and opens a browser.

3. Point the target project's frontend at:
   - `POST /predict` — upload a `.wav`/`.mp3` file, get back emotion +
     probabilities + prosody (see the root README for the response shape).
   - `WS /ws/predict` — stream raw Float32 PCM for live analysis.
   - `GET /health` — liveness plus which models loaded
     (`{"status", "engine", "dimensional", "transcription", "chat"}`), for
     showing an offline state in the UI.
   - `POST /chat` — `{"messages": [{"role": "user", "content": "..."}], "tone": "sad"}`
     → `{"reply", "crisis", "crisis_message", "model"}`. Empathetic chat
     model (Apple Silicon only; returns 503 elsewhere). `tone` is an optional
     emotion from the voice pipeline. Train it with `./train_chat.sh`; see
     [`chat_training/README.md`](chat_training/README.md).
   - `POST /auth/register`, `POST /auth/login` — accounts and sign-in; the
     token they return goes in `Authorization: Bearer <token>` on every
     `/me/*` and `/counsellor/*` call. See **Auth** below.

   Without a token the emotion API still works and stores nothing.

4. Set `CORS_ORIGINS` to the frontend's actual origin(s) instead of the
   permissive local default:

   ```bash
   CORS_ORIGINS="https://app.example.com,http://localhost:5173" ./venv/bin/uvicorn main:app --port 8000
   ```

   Comma-separate multiple origins. Omit it (or leave unset) to allow any
   origin, which is fine for local development but not for production.

5. Decide where recordings go. The default needs no setup: encrypted
   files under `data/bucket/`. To use a bucket instead, see **Storage**
   below.

6. `static/` and the `GET /` / `GET /app` routes are this project's own demo
   UI (orb + waveform), kept only as a reference implementation of a
   WebSocket client. They are optional — delete `static/` entirely if the
   target project's frontend is what serves the UI; `main.py` detects its
   absence and skips mounting it instead of failing to start. `/predict` and
   `/ws/predict` work either way.

## Auth

Two kinds of bearer credential, both stored only as hashes
(`monitoring/auth.py`):

- **Access token** — returned once by `POST /auth/register` (and by
  `manage.py`). Long-lived and needs no username, so a victim can be
  monitored without creating an identity. `POST /me/token/rotate` replaces it.
- **Session token** — returned by `POST /auth/login` for accounts that set a
  username and password, so the same account can be reached from a new
  device. Expires after `SAHAAS_SESSION_DAYS` (default 30) and can be revoked
  per device via `GET /me/sessions` / `DELETE /me/sessions/{id}`.

The two are deliberately independent: signing out (even `all_devices`) ends
sessions but leaves the access token working, because that token is the
recovery credential the victim was shown at registration and may have written
down. `POST /me/token/rotate` is how that one is retired.

Username and password are optional at registration; `PUT /me/credentials`
adds them to an existing token-only account. Passwords are hashed with scrypt
and never leave the server; five wrong attempts start a doubling lockout (1,
2, 4 ... minutes, capped at an hour). Usernames are encrypted at rest and
looked up through a keyed HMAC, so the database alone doesn't reveal who has
an account. Changing a password signs every other device out.

    POST /auth/register  {"name", "consent", "username"?, "password"?}  -> {"user_id", "token", ...}
    POST /auth/login     {"username", "password"}                       -> {"token", "expires_at", ...}
    POST /auth/logout    {"all_devices": false}
    PUT  /me/credentials {"username", "password"}
    POST /me/password    {"current_password", "new_password"}
    GET  /me/sessions    DELETE /me/sessions/{id}    POST /me/token/rotate

Counsellor accounts come from the CLI:

```bash
./venv/bin/python manage.py create-counsellor "Dr. Ananya Sharma" --username ananya
./venv/bin/python manage.py set-password --username ananya    # lost-password reset
./venv/bin/python manage.py sign-out --user-id <id>           # revoke every session
```

## Storage

Voice notes and live check-in audio go to a bucket, but **only** for victims
who turned on the `store_recordings` consent - it defaults to off, and
`storage.save_recording()` is what enforces it, so no caller can bypass it.
The audio is saved as part of recording a check-in, so turning
`voice_analysis` off stops the recordings too.
Every object is encrypted with the same key as the database fields before it
is written, so an S3 provider only ever holds ciphertext. Keys are
`<user_id>/<attachment_id>.<ext>`, which is what makes `DELETE /me` able to
empty one victim's audio in a single call.

| `SAHAAS_STORAGE` | Where recordings go |
|---|---|
| `local` (default) | Encrypted files under `data/bucket/` (`SAHAAS_BUCKET_DIR` to move them) |
| `s3` | Any S3-compatible bucket: Supabase Storage, MinIO, Cloudflare R2, AWS S3 |

```bash
SAHAAS_STORAGE=s3 \
SAHAAS_S3_BUCKET=sahaas-recordings \
SAHAAS_S3_ENDPOINT=https://<project>.supabase.co/storage/v1/s3 \
SAHAAS_S3_REGION=ap-south-1 \
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
./venv/bin/uvicorn main:app --port 8000
```

`s3` needs `boto3` (`pip install boto3`); omit `SAHAAS_S3_ENDPOINT` for AWS.
`GET /health` and `manage.py storage-status` report the active driver, so a
misconfigured bucket shows up before the first upload.

    GET    /me/recordings                  -> [{id, at, kind, bytes, duration_s, detail}]
    GET    /me/recordings/{id}/audio       -> the audio file
    DELETE /me/recordings/{id}
    GET    /counsellor/victims/{vid}/recordings[/{id}/audio]   # assigned victims only

## Requirements

Python 3.12 (TensorFlow, used only for the fallback CNN, does not yet support
3.13/3.14). On first start, ML checkpoints (~3.5 GB) download from Hugging
Face automatically; without network access the app still runs on the bundled
RAVDESS CNN fallback (`voice_emotion_model.h5` + `label_encoder.pkl`).

## Layout

```
backend/
├── main.py                  # FastAPI app: routes + live WebSocket pipeline
├── analysis.py              # Silero VAD, prosody, calibration, affect fusion
├── emotion_engine.py        # emotion2vec+ and WavLM engines, ensemble, headline policy
├── dimensional.py           # learned arousal / valence (audeering wav2vec2)
├── wavlm_ser.py             # native port of the Odyssey 2024 WavLM baseline
├── text_emotion.py          # ASR (faster-whisper) + text-emotion branch
├── speaker_session.py       # per-session speaker calibration
├── extract_feature.py       # MFCC extraction for the fallback CNN
├── monitoring/              # accounts, auth, storage, Distress Score, alerts
│   ├── auth.py              # passwords (scrypt), sessions, bearer-token deps
│   ├── storage.py           # recordings bucket: local encrypted files or S3
│   ├── crypto.py            # field encryption + keyed blind index for lookups
│   └── db.py                # SQLite schema
├── eval/                    # two-corpus accuracy harness (CREMA-D, MELD)
├── static/                  # optional demo UI, see step 5 above
├── voice_emotion_model.h5   # CNN trained on RAVDESS (fallback)
├── label_encoder.pkl        # emotion label encoder (fallback)
├── requirements.txt
├── start.sh                 # one-command launcher (macOS / Linux)
└── start.bat                # one-command launcher (Windows)
```
