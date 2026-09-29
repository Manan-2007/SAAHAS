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

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import auth, case_issues, events, insights, outreach, questionnaires, service, storage, support

router = APIRouter(tags=["monitoring"])
Language = Literal["en", "hi", "pa"]


class Consent(BaseModel):
    data_storage: bool = Field(description="Required: store check-ins so trends can be tracked")
    voice_analysis: bool = True
    store_messages: bool = False
    store_recordings: bool = Field(default=False,
                                   description="Keep the audio of voice check-ins in the storage bucket")
    share_insights: bool = Field(default=True,
                                 description="Let the assistant tell the counsellor how conversations went "
                                             "(emotions, worries, case problems) - a summary, not the words")
    ivrs_calls: bool = Field(default=False, description="Phone me if I miss a check-in (needs a phone number)")


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
    gender: Literal[service.GENDERS] | None = None


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
    share_insights: bool | None = None
    ivrs_calls: bool | None = None


class SettingsUpdate(BaseModel):
    gender: Literal[service.GENDERS] | None = None
    ui_style: Literal[service.UI_STYLES] | None = None
    phone: str | None = Field(default=None, min_length=6, max_length=20, pattern=r"^\+?[0-9 ()-]{6,20}$")
    clear_phone: bool = False


class MoodRequest(BaseModel):
    mood: Literal[service.MOODS]


class ContactRequest(BaseModel):
    kind: Literal["callback", "talk_soon"] = "callback"
    preferred_time: Literal[support.PREFERRED_TIMES] = "asap"
    note: str | None = Field(default=None, max_length=1000)


class IssueReport(BaseModel):
    category: str = Field(min_length=1, max_length=40)
    note: str | None = Field(default=None, max_length=2000)


class IssueUpdate(BaseModel):
    status: Literal[case_issues.STATUSES] | None = None
    action: str | None = Field(default=None, max_length=60)
    note: str | None = Field(default=None, max_length=2000)


class RequestUpdate(BaseModel):
    status: Literal["acknowledged", "done"]
    response: str | None = Field(default=None, max_length=1000)


class CounsellorMessage(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class CounsellorContact(BaseModel):
    phone: str | None = Field(default=None, max_length=20)
    hours: str | None = Field(default=None, max_length=120)


class RescheduleRequest(BaseModel):
    option: Literal["1", "2"]


class IvrsEvent(BaseModel):
    call_id: int
    event: Literal["answered", "digits", "no_answer", "busy", "failed", "completed"]
    digits: str | None = Field(default=None, max_length=4)


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
    if req.consent.ivrs_calls and not req.phone:
        raise HTTPException(status_code=422, detail="Check-in calls need a phone number")
    return _or_auth_error(service.register_victim, req.name, req.language, req.phone, req.case_ref,
                          req.consent.model_dump(), username=req.username, password=req.password,
                          gender=req.gender)


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
    if req.ivrs_calls and not user.get("phone_enc"):
        raise HTTPException(status_code=422, detail="Add a phone number first to get check-in calls")
    if req.share_insights is False:
        insights.buffer.forget(user["id"])
    return {"consent": service.update_consent(user, req.model_dump())}


@router.patch("/me/settings")
def update_settings(req: SettingsUpdate, user=Depends(auth.victim)):
    try:
        result = service.update_settings(user, req.gender, req.ui_style, req.phone, req.clear_phone)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if req.clear_phone and user["consent"].get("ivrs_calls"):
        result["consent"] = service.update_consent(user, {"ivrs_calls": False})
    return result


@router.get("/me/progress")
def my_progress(user=Depends(auth.victim)):
    return service.progress(user)


@router.post("/me/mood")
def record_mood(req: MoodRequest, user=Depends(auth.victim)):
    return service.record_mood(user, req.mood)


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


# ---------------------------------------------------------------- live streams

def _stream(request, key):
    return StreamingResponse(events.sse(key, request.is_disconnected), media_type="text/event-stream",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@router.get("/counsellor/stream")
async def counsellor_stream(request: Request, user=Depends(auth.counsellor)):
    """Server-sent events for this counsellor's caseload: reading, score, alert,
    issue, insight, message, contact_request, outreach, mood."""
    return _stream(request, user["id"])


@router.get("/me/stream")
async def my_stream(request: Request, user=Depends(auth.victim)):
    """Server-sent events for the person: counsellor replies and request updates."""
    return _stream(request, user["id"])


# ---------------------------------------------------------------- support (victim side)

@router.get("/me/support")
def my_support(user=Depends(auth.victim)):
    return support.victim_support(user)


@router.post("/me/contact-requests")
def ask_for_contact(req: ContactRequest, user=Depends(auth.victim)):
    return support.request_contact(user, req.kind, req.preferred_time, req.note)


@router.get("/me/messages")
def my_messages(user=Depends(auth.victim)):
    return support.thread_for_victim(user)


@router.get("/me/issues/categories")
def issue_categories(user=Depends(auth.victim)):
    return case_issues.categories_for_victim(user["language"] or "en")


@router.get("/me/issues")
def my_issues(user=Depends(auth.victim)):
    return case_issues.victim_issues(user)


@router.post("/me/issues")
def report_issue(req: IssueReport, user=Depends(auth.victim)):
    try:
        return case_issues.victim_report(user, req.category, req.note)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/me/checkin-call")
def my_checkin_call(user=Depends(auth.victim)):
    return {"call": outreach.victim_call(user), "enabled": bool(user["consent"].get("ivrs_calls")),
            "max_reschedules": outreach.MAX_RESCHEDULES}


@router.post("/me/checkin-call/reschedule")
def reschedule_checkin_call(req: RescheduleRequest, user=Depends(auth.victim)):
    try:
        return {"call": outreach.reschedule_from_app(user, req.option)}
    except outreach.RescheduleRefused as exc:
        raise HTTPException(status_code=409, detail=str(exc))


# ---------------------------------------------------------------- support (counsellor side)

@router.get("/counsellor/feed")
def reading_feed(limit: int = Query(100, ge=1, le=500), user=Depends(auth.counsellor)):
    """Every message's distress reading across the caseload, newest first. No words."""
    return support.feed(user, limit)


@router.get("/counsellor/victims/{victim_id}/readings")
def victim_readings(victim_id: str, limit: int = Query(100, ge=1, le=500), user=Depends(auth.counsellor)):
    try:
        return support.readings_for(user, victim_id, limit)
    except support.NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/counsellor/victims/{victim_id}/insights")
def victim_insights(victim_id: str, limit: int = Query(20, ge=1, le=100), user=Depends(auth.counsellor)):
    found = insights.for_victim(user, victim_id, limit)
    if found is None:
        raise HTTPException(status_code=404, detail="No such client assigned to you")
    return found


@router.get("/counsellor/legal-actions")
def legal_actions(user=Depends(auth.counsellor)):
    return case_issues.legal_actions()


@router.get("/counsellor/issues")
def issues(status: str = Query("active"), victim_id: str | None = None, user=Depends(auth.counsellor)):
    return case_issues.counsellor_issues(user, status, victim_id)


@router.post("/counsellor/victims/{victim_id}/issues")
def log_issue(victim_id: str, req: IssueReport, user=Depends(auth.counsellor)):
    if req.category not in case_issues.categories():
        raise HTTPException(status_code=422, detail="Unknown category")
    try:
        return case_issues.log_by_counsellor(user, victim_id, req.category, req.note)
    except case_issues.IssueNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.patch("/counsellor/issues/{issue_id}")
def update_issue(issue_id: int, req: IssueUpdate, user=Depends(auth.counsellor)):
    try:
        return case_issues.update(user, issue_id, status=req.status, action=req.action, note=req.note)
    except case_issues.IssueNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/counsellor/contact-requests")
def contact_requests(status: Literal["open", "acknowledged", "done", "all"] = "open", user=Depends(auth.counsellor)):
    return support.counsellor_requests(user, status)


@router.post("/counsellor/contact-requests/{request_id}")
def handle_contact_request(request_id: int, req: RequestUpdate, user=Depends(auth.counsellor)):
    try:
        return support.handle_request(user, request_id, req.status, req.response)
    except support.NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/counsellor/messages")
def message_inbox(user=Depends(auth.counsellor)):
    return support.inbox(user)


@router.get("/counsellor/victims/{victim_id}/messages")
def victim_thread(victim_id: str, user=Depends(auth.counsellor)):
    try:
        return support.thread_for_counsellor(user, victim_id)
    except support.NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/counsellor/victims/{victim_id}/messages")
def reply_to_victim(victim_id: str, req: CounsellorMessage, user=Depends(auth.counsellor)):
    try:
        return support.send_from_counsellor(user, victim_id, req.text)
    except support.NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/counsellor/outreach")
def outreach_calls(status: Literal["active", "all"] = "active", user=Depends(auth.counsellor)):
    return outreach.counsellor_calls(user, status)


@router.get("/counsellor/me/contact")
def my_contact_card(user=Depends(auth.counsellor)):
    return support.counsellor_contact(user["id"])


@router.put("/counsellor/me/contact")
def set_my_contact_card(req: CounsellorContact, user=Depends(auth.counsellor)):
    return support.set_counsellor_contact(user, req.phone, req.hours)


# ---------------------------------------------------------------- IVRS webhooks

@router.post("/ivrs/webhook")
def ivrs_webhook(req: IvrsEvent, key: str = Query(...)):
    """Carrier-neutral: one step of the check-in call as JSON
    {say: [...], gather: n or null, hangup, language}. Adapt it to Exotel,
    Knowlarity or any IVR that can call a URL and speak text."""
    if not outreach.check_key(key):
        raise HTTPException(status_code=403, detail="Bad key")
    return outreach.respond(req.call_id, req.event, req.digits)


@router.post("/ivrs/simulate")
def ivrs_simulate(req: IvrsEvent, user=Depends(auth.counsellor)):
    """Walk a check-in call through its steps without a carrier (console mode)."""
    with_calls = {c["id"] for c in outreach.counsellor_calls(user, "all")}
    if req.call_id not in with_calls:
        raise HTTPException(status_code=404, detail="No such call for your clients")
    return outreach.respond(req.call_id, req.event, req.digits)


def _twilio_event(status, digits):
    if digits:
        return "digits"
    return {"in-progress": "answered", "ringing": "answered", "answered": "answered",
            "no-answer": "no_answer", "busy": "busy", "failed": "failed", "canceled": "failed",
            "completed": "completed"}.get(status or "", "answered")


@router.post("/ivrs/twilio/voice")
def twilio_voice(call_id: int, key: str, step: str | None = None, Digits: str | None = Form(default=None),
                 CallStatus: str | None = Form(default=None)):
    if not outreach.check_key(key):
        raise HTTPException(status_code=403, detail="Bad key")
    event = "digits" if step == "digits" else _twilio_event(CallStatus, None)
    result = outreach.respond(call_id, event, Digits)
    return Response(content=outreach.twiml(result, call_id), media_type="application/xml")


@router.post("/ivrs/twilio/status")
def twilio_status(call_id: int, key: str, CallStatus: str | None = Form(default=None)):
    if not outreach.check_key(key):
        raise HTTPException(status_code=403, detail="Bad key")
    outreach.respond(call_id, _twilio_event(CallStatus, None))
    return Response(status_code=204)
