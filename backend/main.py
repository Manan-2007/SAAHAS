import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import json
import time
from fastapi import FastAPI , UploadFile , File , HTTPException , WebSocket
from fastapi.responses import JSONResponse , FileResponse
from starlette.websockets import WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
import tensorflow as tf
import pickle
import numpy as np
import librosa
from analysis import analyze_window , reweight_by_affect , speech_segments , TARGET_SR
import emotion_engine
from emotion_engine import load_engine , load_wavlm_engine , synthesize_calm , pick_headline
from dimensional import load_dimensional_engine
from text_emotion import load_text_engine , fuse_text
from speaker_session import SpeakerSession
from tempfile import NamedTemporaryFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model = tf.keras.models.load_model(os.path.join(BASE_DIR, "voice_emotion_model.h5"))

enc_path = os.path.join(BASE_DIR, "label_encoder.pkl")
with open(enc_path , 'rb') as f:
    encoder = pickle.load(f)

EMOTIONS = emotion_engine.EMOTIONS

# Primary classifier: emotion2vec+ (42,500h of real speech); falls back to the
# RAVDESS CNN when FunASR / the checkpoint is unavailable.
engine = load_engine(cnn_model=model , encoder_classes=encoder.classes_)
IS_FOUNDATION = isinstance(engine , emotion_engine.Emotion2VecEngine)
# The CNN's softmax spikes to 99.9% on garbage and needs heavy smoothing;
# emotion2vec+ is already sane, so it keeps more of its own opinion.
CAL_TEMPERATURE = 1.5 if IS_FOUNDATION else 2.0
CAL_BLEND = 0.06 if IS_FOUNDATION else 0.12
CAL_STRENGTH = 1.2 if IS_FOUNDATION else 1.2
print(f"[emotion-engine] active engine: {engine.name}")

# Learned arousal/valence (audeering wav2vec2, trained on natural speech).
# When available it replaces the heuristic prosody arousal in the fusion;
# when not (offline first run), the heuristic remains the fallback.
dim_engine = load_dimensional_engine()
if dim_engine is not None:
    print(f"[emotion-engine] dimensional engine: {dim_engine.name}")

# Second classifier for the ensemble (MSP-Podcast-trained WavLM). Too slow
# for every interim cycle, so it joins only on finalized utterances and
# uploads - the "slow lane" that production streaming systems use.
wavlm_engine = load_wavlm_engine()
if wavlm_engine is not None:
    print(f"[emotion-engine] ensemble engine: {wavlm_engine.name}")

# ASR + text-emotion branch (what is said). Slow lane only, self-gated by
# how much emotional content the transcript actually carries.
text_engine = load_text_engine()
if text_engine is not None:
    print(f"[emotion-engine] text engine: {text_engine.name}")

# Human-readable description of the classifiers actually loaded, surfaced in
# the UI and API so the reported stack matches what is really running.
ENGINE_LABEL = " + ".join([e.name for e in (engine , wavlm_engine) if e is not None])

# Warm up torch/TF graphs so the first live prediction isn't slow
try:
    engine.predict(np.zeros(16000 , dtype=np.float32) , 16000)
    if dim_engine is not None:
        dim_engine.predict(np.zeros(16000 , dtype=np.float32) , 16000)
    if wavlm_engine is not None:
        wavlm_engine.predict(np.zeros(16000 , dtype=np.float32) , 16000)
except Exception:
    pass

# Live-stream tuning. The stream is segmented into UTTERANCES at speech
# pauses (the pattern production systems use): while an utterance is open,
# cheap interim predictions go out every PREDICT_INTERVAL; when a pause
# closes it, one final prediction runs on the complete utterance - the
# conditions emotion2vec+ was trained on - and the buffer resets so two
# utterances can never blur into one window.
MIN_SECONDS = 1.0         # don't predict until at least this much audio has arrived
PREDICT_INTERVAL = 0.5    # seconds between interim analysis cycles
END_SILENCE_S = 0.5       # trailing silence that closes an utterance (industry 300-500ms)
UTTERANCE_MAX_SECONDS = 12.0    # force-finalize cap; emotion2vec+ is reliable to ~15s
SILENCE_KEEP_S = 2.0      # audio kept while idle so an onset is never clipped
SMOOTHING_ALPHA = 0.4     # EMA weight of an interim probability vector
FINAL_ALPHA = 0.7         # EMA weight of a finalized-utterance vector
CONFIDENT_TOP = 0.40      # smoothed top prob needed to report with certainty
CONFIDENT_MARGIN = 0.12   # lead over the runner-up needed for certainty
RELIABLE_VOICED_SECONDS = 3.0   # emotion2vec+ hallucinates below ~3s of speech
                                # (github.com/ddlBoJack/emotion2vec issue #41);
                                # shorter spans get reduced EMA weight + low certainty

app = FastAPI()

# Set CORS_ORIGINS to a comma-separated list of allowed origins when
# integrating this backend into another project's frontend (e.g.
# "https://app.example.com,http://localhost:5173"). Defaults to "*" for
# local/standalone use.
_cors_origins_env = os.environ.get("CORS_ORIGINS", "*").strip()
CORS_ORIGINS = ["*"] if _cors_origins_env == "*" else [o.strip() for o in _cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# static/ ships this project's own demo UI. It's optional: when this backend
# is dropped into another project that brings its own frontend, static/ can
# be omitted entirely without breaking the API routes below.
STATIC_DIR = os.path.join(BASE_DIR, "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/static" , StaticFiles(directory=STATIC_DIR) , name = "static")

def analyze_and_predict(window , sr , require_recent=True , thorough=True , session=None ,
                        transcribe=True):
    """Runs in a worker thread: VAD -> speech extraction -> classifier(s) -> affect fusion.

    thorough=True adds the WavLM ensemble member (finalized utterances,
    uploads, eval); interim live cycles pass False to stay fast.
    session: optional SpeakerSession - recenters arousal/valence against
    this speaker's own resting baseline and is updated from finalized
    neutral utterances.
    transcribe=False skips the ASR pass entirely (Whisper here is pinned to
    English, so non-English speakers can turn it off; also saves ~250ms per
    final)."""
    result = analyze_window(window , sr , require_recent=require_recent)
    if result["status"] != "speech":
        return {"status" : "silence"}

    prosody = result["prosody"]

    # Learned arousal/valence when available; heuristic arousal otherwise.
    valence = None
    if dim_engine is not None:
        try:
            dims = dim_engine.predict(result["voiced"] , TARGET_SR)
            prosody["arousal_prosody"] = prosody["arousal"]   # keep heuristic for reference
            prosody["arousal"] = round(dims["arousal"] , 3)
            prosody["valence"] = round(dims["valence"] , 3)
            valence = dims["valence"]
        except Exception:
            pass
    arousal = prosody["arousal"]

    if session is not None and session.active:
        arousal , valence = session.adjust(arousal , valence)
        prosody["arousal_adjusted"] = round(arousal , 3)
        if valence is not None:
            prosody["valence_adjusted"] = round(valence , 3)

    engine_probs = engine.predict(result["voiced"] , TARGET_SR)
    blended = engine_probs
    if thorough and wavlm_engine is not None:
        try:
            wavlm_probs = wavlm_engine.predict(result["voiced"] , TARGET_SR)
            w = emotion_engine.ENSEMBLE_E2V_WEIGHT
            blended = w * engine_probs + (1.0 - w) * wavlm_probs
        except Exception:
            pass

    transcript = None
    if thorough and transcribe and text_engine is not None:
        try:
            transcript , text_probs = text_engine.analyze(result["voiced"] , TARGET_SR)
            blended = fuse_text(blended , text_probs)
        except Exception:
            pass

    probs = synthesize_calm(blended , arousal)
    probs = reweight_by_affect(probs , EMOTIONS , arousal , valence ,
                               temperature=CAL_TEMPERATURE , blend=CAL_BLEND , strength=CAL_STRENGTH)

    # Finalized utterances feed the speaker baseline (neutral ones only;
    # the update method applies its own confidence/duration gates)
    if session is not None and thorough:
        top = int(np.argmax(probs))
        session.update(EMOTIONS[top] , float(probs[top]) ,
                       prosody["arousal"] , prosody.get("valence") ,
                       result["voiced_seconds"])

    return {"status" : "speech" , "probs" : probs , "engine_probs" : engine_probs ,
            "prosody" : prosody , "voiced_seconds" : result["voiced_seconds"] ,
            "transcript" : transcript}

@app.websocket("/ws/predict")
async def live_predict(ws : WebSocket):
    await ws.accept()
    client_sr = 22050
    buffer = np.zeros(0 , dtype=np.float32)   # spans at most the CURRENT utterance
    last_predict = 0.0
    smoothed = None        # EMA over reweighted probability vectors
    silence_cycles = 0
    session = SpeakerSession()   # this connection's speaker baseline
    transcribe = True            # client toggle; flips via config frames mid-session
    try:
        while True:
            message = await ws.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if message.get("text") is not None:
                try:
                    config = json.loads(message["text"])
                    client_sr = int(config.get("sampleRate" , client_sr))
                    if "transcribe" in config:
                        transcribe = bool(config["transcribe"])
                except (ValueError , TypeError):
                    pass
                continue

            data = message.get("bytes")
            if not data:
                continue

            chunk = np.frombuffer(data , dtype=np.float32)
            buffer = np.concatenate([buffer , chunk])
            force_final = len(buffer) >= int(client_sr * UTTERANCE_MAX_SECONDS)

            now = time.monotonic()
            if not force_final and (now - last_predict < PREDICT_INTERVAL
                                    or len(buffer) < client_sr * MIN_SECONDS):
                continue
            last_predict = now

            # Cheap VAD pass to place the utterance boundary
            segments , _ = await run_in_threadpool(speech_segments , buffer.copy() , client_sr)

            if not segments:
                buffer = buffer[-int(client_sr * SILENCE_KEEP_S):]
                silence_cycles += 1
                if silence_cycles >= 6:       # ~3s quiet: forget the old utterance
                    smoothed = None
                await ws.send_json({"status" : "silence"})
                continue

            tail_silence = (len(buffer) - segments[-1][1]) / client_sr
            closed = tail_silence >= END_SILENCE_S or force_final

            result = await run_in_threadpool(
                analyze_and_predict , buffer.copy() , client_sr ,
                not closed ,        # interims require recent speech
                closed ,            # finals get the full ensemble (slow lane)
                session ,           # per-connection speaker baseline
                transcribe)         # client's transcription toggle
            if closed:
                # The utterance is consumed: the next one starts a fresh buffer
                buffer = buffer[segments[-1][1]:]

            if result["status"] != "speech":
                silence_cycles += 1
                if silence_cycles >= 6:
                    smoothed = None
                await ws.send_json({"status" : "silence"})
                continue
            silence_cycles = 0

            # Finals (complete utterances - the model's training condition)
            # dominate the EMA; interims are provisional and scale with how
            # much voiced audio they saw (short spans hallucinate).
            voiced_seconds = result["voiced_seconds"]
            reliability = min(1.0 , voiced_seconds / RELIABLE_VOICED_SECONDS)
            alpha = FINAL_ALPHA if closed else SMOOTHING_ALPHA * reliability
            if smoothed is None:
                smoothed = result["probs"]
            else:
                smoothed = (1 - alpha) * smoothed + alpha * result["probs"]

            index , demoted = pick_headline(smoothed , CONFIDENT_TOP)
            top = float(smoothed[index])
            second = float(max(smoothed[i] for i in range(len(EMOTIONS)) if i != index))
            certainty = "high" if (not demoted
                                   and reliability >= 1.0
                                   and top >= CONFIDENT_TOP
                                   and top - second >= CONFIDENT_MARGIN) else "low"

            await ws.send_json({
                "status" : "ok",
                "segment" : "final" if closed else "interim",
                "emotion" : EMOTIONS[index],
                "confidence" : float(top * 100),
                "certainty" : certainty,
                "probabilities" : {EMOTIONS[i] : float(smoothed[i] * 100) for i in range(len(EMOTIONS))},
                "prosody" : result["prosody"],
                "voiced_seconds" : voiced_seconds,
                "transcript" : result.get("transcript"),
                "engine" : ENGINE_LABEL,
            })
    except WebSocketDisconnect:
        pass

@app.post("/predict")
async def predict(file : UploadFile = File(...)):
        if not file.filename.lower().endswith((".wav" , ".mp3")):
            raise HTTPException(status_code=400 , detail="Only .wav and .mp3 audio files are supported")


        suffix = os.path.splitext(file.filename)[1].lower()
        with NamedTemporaryFile(delete=False , suffix=suffix) as tempfile:
            readfile = await file.read()
            tempfile.write(readfile)
            temp_path = tempfile.name

        try:
            audio , _ = librosa.load(temp_path , sr=TARGET_SR)
            result = analyze_and_predict(audio , TARGET_SR , require_recent=False)
            if result["status"] != "speech":
                raise HTTPException(status_code=422 , detail="No speech detected in the audio file")

            probs = result["probs"]
            prediction_index , _ = pick_headline(probs , CONFIDENT_TOP)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500 , detail=f"Failed To Process Audio: {e}")
        finally:
            os.unlink(temp_path)

        return JSONResponse({
             "Emotion" : EMOTIONS[prediction_index],
             "Confidence" : float(probs[prediction_index] * 100),
             "Probabilities" : {EMOTIONS[i] : float(probs[i] * 100) for i in range(len(EMOTIONS))},
             "Prosody" : result["prosody"],
             "VoicedSeconds" : result["voiced_seconds"],
             "Transcript" : result.get("transcript"),
             "Engine" : ENGINE_LABEL,
             "Status" : "Success"
        })

@app.get("/health")
async def health():
    return {
        "status" : "ok",
        "engine" : ENGINE_LABEL,
        "dimensional" : dim_engine.name if dim_engine is not None else None,
        "transcription" : text_engine is not None,
    }

@app.get("/")
async def main():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.isfile(index_path):
        raise HTTPException(status_code=404 , detail="No bundled UI in this deployment; use the API routes directly")
    return FileResponse(index_path)

@app.get("/app")
async def experience():
    app_path = os.path.join(STATIC_DIR, "app.html")
    if not os.path.isfile(app_path):
        raise HTTPException(status_code=404 , detail="No bundled UI in this deployment; use the API routes directly")
    return FileResponse(app_path)
