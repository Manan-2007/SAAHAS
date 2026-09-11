"""HTTP routes for victim monitoring.

  public       GET  /questionnaires, /questionnaires/{id}
  accounts     POST /auth/register, /auth/login, /auth/logout
  victims      /me/*   (profile, consent, check-ins, sessions, recordings)
  counsellors  /counsellor/*   (accounts created with `python manage.py create-counsellor`)

Every authenticated route takes `Authorization: Bearer <token>`, where the
token is either the access token from /auth/register (or manage.py) or a
session token from /auth/login. See monitoring.auth for the difference.
"""

import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field

from . import auth, questionnaires, service, storage

router = APIRouter(tags=["monitoring"])
Language = Literal["en", "hi", "pa"]


class Consent(BaseModel):
    data_storage: bool = Field(description="Required: store check-ins so trends can be tracked")
    voice_analysis: bool = True
    store_messages: bool = False
    store_recordings: bool = Field(default=False,
                                   description="Keep the audio of voice check-ins in the storage bucket")


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    language: Language = "en"
    phone: str | None = Field(default=None, max_length=20)
    case_ref: str | None = Field(default=None, max_length=60)
    consent: Consent
    # Optional: without them the account exists only behind the access token
    # returned by this call, which is the anonymous path.
    username: str | None = Field(default=None, min_length=3, max_length=60)
    password: str | None = Field(default=None, min_length=auth.MIN_PASSWORD_LENGTH,
                                 max_length=auth.MAX_PASSWORD_LENGTH)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=auth.MAX_PASSWORD_LENGTH)


class CredentialsRequest(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=auth.MIN_PASSWORD_LENGTH, max_length=auth.MAX_PASSWORD_LENGTH)
    # Required once the account has a password: replacing it needs the old one
    current_password: str | None = Field(default=None, max_length=auth.MAX_PASSWORD_LENGTH)


class ProfileRequest(BaseModel):
    """Onboarding answers: the person's own normal, to read later check-ins against."""
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    language: Language | None = None
    coping: str | None = Field(default=None, max_length=80)
    low_time: str | None = Field(default=None, max_length=80)
    channel: str | None = Field(default=None, max_length=80)
    baseline_mood: int | None = Field(default=None, ge=1, le=5)
    comfort: str | None = Field(default=None, max_length=80)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=auth.MAX_PASSWORD_LENGTH)
    new_password: str = Field(min_length=auth.MIN_PASSWORD_LENGTH, max_length=auth.MAX_PASSWORD_LENGTH)


class LogoutRequest(BaseModel):
    all_devices: bool = False


class ConsentUpdate(BaseModel):
    voice_analysis: bool | None = None
    store_messages: bool | None = None
    store_recordings: bool | None = None


class AnswersRequest(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=20)
    channel: Literal["app", "chat", "ivrs", "sms", "counsellor"] = "app"


class EventRequest(BaseModel):
    kind: Literal[service.EVENT_KINDS]
    date: dt.date
    title: str = Field(min_length=1, max_length=200)
    # s.15A: mandatory notice before a bail or parole hearing. None means nobody
    # recorded it either way, which the watchdog treats as missing.
    notice_given: bool | None = None


class ReliefFromScheduleRequest(BaseModel):
    section: str = Field(min_length=1, max_length=60)


class EntitlementRequest(BaseModel):
    stage: Literal[service.ENTITLEMENT_STAGES]
    amount: float | None = Field(default=None, ge=0)
    due_on: dt.date | None = None
    note: str | None = Field(default=None, max_length=2000)


class EntitlementUpdate(BaseModel):
    status: Literal[service.ENTITLEMENT_STATUS] | None = None
    amount: float | None = Field(default=None, ge=0)
    due_on: dt.date | None = None
    note: str | None = Field(default=None, max_length=2000)


class EntitlementAnswer(BaseModel):
    status: Literal[service.ENTITLEMENT_STATUS]


class ResolveRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


def _or_404(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except service.NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


def _or_auth_error(fn, *args, **kwargs):
    """auth.AuthError carries its own status: 401 wrong, 409 taken, 429 locked."""
    try:
        return fn(*args, **kwargs)
    except auth.AuthError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc))


def _audio_response(data, content_type, filename):
    # attachment, private, no-store: a recording should never sit in a shared
    # cache or be rendered inline by a browser that guessed the type.
    return Response(content=data, media_type=content_type, headers={
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store, private",
    })


# ---------------------------------------------------------------- public

@router.get("/questionnaires")
def list_questionnaires():
    return questionnaires.catalog()


@router.get("/questionnaires/{instrument}")
def get_questionnaire(instrument: str, lang: Language = "en"):
    if instrument not in questionnaires.INSTRUMENTS:
        raise HTTPException(status_code=404, detail="Unknown questionnaire")
    return questionnaires.get(instrument, lang)


# ---------------------------------------------------------------- victims

@router.post("/auth/register")
def register(req: RegisterRequest):
    if not req.consent.data_storage:
        raise HTTPException(status_code=400, detail="Monitoring needs consent to store check-ins. "
                                                    "Without it the app can still be used anonymously.")
    if bool(req.username) != bool(req.password):
        raise HTTPException(status_code=422,
                            detail="Send a username and a password together, or neither")
    return _or_auth_error(service.register_victim, req.name, req.language, req.phone, req.case_ref,
                          req.consent.model_dump(), username=req.username, password=req.password)


@router.post("/auth/login")
def login(req: LoginRequest, user_agent: str | None = Header(default=None)):
    return _or_auth_error(service.login, req.username, req.password, user_agent)


@router.post("/auth/logout")
def logout(req: LogoutRequest | None = None, user=Depends(auth.current_user)):
    return service.sign_out(user, all_devices=bool(req and req.all_devices))


# ---------------------------------------------------------------- credentials

@router.put("/me/credentials")
def set_credentials(req: CredentialsRequest, user=Depends(auth.current_user)):
    """Attaches a username + password to a token-only account, or replaces them
    (send current_password; other devices are signed out)."""
    return _or_auth_error(service.set_credentials, user, req.username, req.password, req.current_password)


@router.post("/me/password")
def change_password(req: PasswordChangeRequest, user=Depends(auth.current_user)):
    return _or_auth_error(auth.change_password, user, req.current_password, req.new_password,
                          user.get("session_id"))


@router.post("/me/token/rotate")
def rotate_token(user=Depends(auth.current_user)):
    """New access token, shown once. The old one stops working immediately."""
    return service.rotate_token(user)


@router.get("/me/sessions")
def my_sessions(user=Depends(auth.current_user)):
    return service.list_sessions(user)


@router.delete("/me/sessions/{session_id}")
def revoke_session(session_id: int, user=Depends(auth.current_user)):
    return _or_404(service.revoke_session, user, session_id)


@router.get("/me")
def me(user=Depends(auth.current_user)):
    return service.profile(user)


@router.put("/me/profile")
def save_profile(req: ProfileRequest, user=Depends(auth.victim)):
    answers = req.model_dump(exclude={"display_name", "language"})
    return service.save_profile(user, answers, req.display_name, req.language)


@router.patch("/me/consent")
def update_consent(req: ConsentUpdate, user=Depends(auth.victim)):
    return {"consent": service.update_consent(user, req.model_dump())}


@router.delete("/me")
def delete_me(user=Depends(auth.current_user)):
    return service.delete_account(user)


# ---------------------------------------------------------------- recordings

@router.get("/me/conversation")
def my_conversation(limit: int = Query(default=service.CONVERSATION_TURNS, ge=1, le=100),
                    user=Depends(auth.victim)):
    """The last turns of the conversation, oldest first, so the chat screen and
    the voice call carry on from where they left off. Empty without the
    store_messages consent - nothing was kept in that case."""
    return {"turns": service.conversation(user["id"], limit),
            "stored": bool(user["consent"].get("store_messages"))}


@router.delete("/me/conversation")
def forget_my_conversation(user=Depends(auth.victim)):
    """Erases the stored conversation without touching the check-in timeline."""
    return {"deleted": service.forget_conversation(user["id"])}


@router.get("/me/recordings")
def my_recordings(user=Depends(auth.victim)):
    return service.list_recordings(user["id"])


@router.get("/me/recordings/{attachment_id}/audio")
def my_recording_audio(attachment_id: str, user=Depends(auth.victim)):
    found = storage.load_recording(user["id"], attachment_id)
    if found is None:
        raise HTTPException(status_code=404, detail="No such recording")
    return _audio_response(*found)


@router.delete("/me/recordings/{attachment_id}")
def delete_my_recording(attachment_id: str, user=Depends(auth.victim)):
    return _or_404(service.delete_recording, user, attachment_id)


@router.post("/me/questionnaires/{instrument}")
def submit_questionnaire(instrument: str, req: AnswersRequest, user=Depends(auth.victim)):
    if instrument not in questionnaires.INSTRUMENTS:
        raise HTTPException(status_code=404, detail="Unknown questionnaire")
    try:
        return service.submit_questionnaire(user, instrument, req.answers, req.channel)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/me/case")
def my_case(user=Depends(auth.victim)):
    """Dates and entitlements only - never a score, tier or amount."""
    return service.my_case(user)


@router.post("/me/entitlements/{entitlement_id}")
def answer_entitlement(entitlement_id: int, req: EntitlementAnswer, user=Depends(auth.victim)):
    return _or_404(service.answer_entitlement, user, entitlement_id, req.status)


@router.get("/me/due")
def due_checkins(user=Depends(auth.victim)):
    return service.due_checkins(user["id"])


@router.get("/me/wellbeing")
def wellbeing(user=Depends(auth.victim)):
    return service.wellbeing(user["id"], lang=user["language"])


@router.get("/me/events")
def my_events(user=Depends(auth.victim)):
    return service.list_events(user["id"])


# ---------------------------------------------------------------- counsellors

@router.get("/counsellor/victims")
def caseload(user=Depends(auth.counsellor)):
    return service.list_victims(user)


@router.get("/counsellor/victims/{victim_id}")
def victim_detail(victim_id: str, user=Depends(auth.counsellor)):
    return _or_404(service.victim_detail, user, victim_id)


@router.get("/counsellor/victims/{victim_id}/timeline")
def victim_timeline(victim_id: str, days: int = Query(30, ge=1, le=365), user=Depends(auth.counsellor)):
    return _or_404(service.timeline, user, victim_id, days)


@router.post("/counsellor/victims/{victim_id}/events")
def add_event(victim_id: str, req: EventRequest, user=Depends(auth.counsellor)):
    return _or_404(service.add_event, user, victim_id, req.kind, req.date.isoformat(), req.title,
                   req.notice_given)


@router.get("/counsellor/forecast")
def caseload_forecast(user=Depends(auth.counsellor)):
    """Who is predicted to climb because of what is on the calendar."""
    return service.caseload_forecast(user)


@router.get("/counsellor/victims/{victim_id}/entitlements")
def victim_entitlements(victim_id: str, user=Depends(auth.counsellor)):
    return _or_404(service.list_entitlements, user, victim_id)


@router.post("/counsellor/victims/{victim_id}/entitlements")
def add_entitlement(victim_id: str, req: EntitlementRequest, user=Depends(auth.counsellor)):
    return _or_404(service.add_entitlement, user, victim_id, req.stage, req.amount,
                   req.due_on.isoformat() if req.due_on else None, req.note)


@router.get("/counsellor/relief-schedule")
def relief_schedule(user=Depends(auth.counsellor)):
    """Annexure-I of the SC/ST (PoA) Rules as notified - amounts and stage splits."""
    return service.relief_schedule()


@router.post("/counsellor/victims/{victim_id}/relief")
def add_relief_from_schedule(victim_id: str, req: ReliefFromScheduleRequest,
                             user=Depends(auth.counsellor)):
    """Create the whole staged set for one offence from the Gazette schedule."""
    try:
        return _or_404(service.add_relief_from_schedule, user, victim_id, req.section)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.patch("/counsellor/entitlements/{entitlement_id}")
def update_entitlement(entitlement_id: int, req: EntitlementUpdate, user=Depends(auth.counsellor)):
    return _or_404(service.update_entitlement, user, entitlement_id, req.status, req.amount,
                   req.due_on.isoformat() if req.due_on else None, req.note)


@router.delete("/counsellor/events/{event_id}")
def delete_event(event_id: int, user=Depends(auth.counsellor)):
    _or_404(service.delete_event, user, event_id)
    return {"deleted": True}


@router.get("/counsellor/victims/{victim_id}/recordings")
def victim_recordings(victim_id: str, user=Depends(auth.counsellor)):
    return _or_404(service.victim_recordings, user, victim_id)


@router.get("/counsellor/victims/{victim_id}/recordings/{attachment_id}/audio")
def victim_recording_audio(victim_id: str, attachment_id: str, user=Depends(auth.counsellor)):
    return _audio_response(*_or_404(service.victim_recording_bytes, user, victim_id, attachment_id))


@router.get("/counsellor/alerts")
def alerts(status: Literal["open", "acknowledged", "resolved", "all"] = "open", user=Depends(auth.counsellor)):
    return service.list_alerts(user, status)


@router.post("/counsellor/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, user=Depends(auth.counsellor)):
    return _or_404(service.update_alert, user, alert_id, "acknowledged")


@router.post("/counsellor/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, req: ResolveRequest, user=Depends(auth.counsellor)):
    return _or_404(service.update_alert, user, alert_id, "resolved", req.note)
