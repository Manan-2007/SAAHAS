"""HTTP routes for victim monitoring.

  public       GET  /questionnaires, /questionnaires/{id}
  victims      POST /auth/register, /me/*
  counsellors  /counsellor/*   (accounts created with `python manage.py create-counsellor`)

Send the token from /auth/register (or manage.py) as `Authorization: Bearer <token>`.
"""

import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from . import auth, questionnaires, service

router = APIRouter(tags=["monitoring"])
Language = Literal["en", "hi", "pa"]


class Consent(BaseModel):
    data_storage: bool = Field(description="Required: store check-ins so trends can be tracked")
    voice_analysis: bool = True
    store_messages: bool = False


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    language: Language = "en"
    phone: str | None = Field(default=None, max_length=20)
    case_ref: str | None = Field(default=None, max_length=60)
    consent: Consent


class ConsentUpdate(BaseModel):
    voice_analysis: bool | None = None
    store_messages: bool | None = None


class AnswersRequest(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=20)
    channel: Literal["app", "chat", "ivrs", "sms", "counsellor"] = "app"


class EventRequest(BaseModel):
    kind: Literal[service.EVENT_KINDS]
    date: dt.date
    title: str = Field(min_length=1, max_length=200)


class ResolveRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


def _or_404(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except service.NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


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
    return service.register_victim(req.name, req.language, req.phone, req.case_ref, req.consent.model_dump())


@router.get("/me")
def me(user=Depends(auth.current_user)):
    return service.profile(user)


@router.patch("/me/consent")
def update_consent(req: ConsentUpdate, user=Depends(auth.victim)):
    return {"consent": service.update_consent(user, req.model_dump())}


@router.delete("/me")
def delete_me(user=Depends(auth.current_user)):
    service.delete_account(user)
    return {"deleted": True}


@router.post("/me/questionnaires/{instrument}")
def submit_questionnaire(instrument: str, req: AnswersRequest, user=Depends(auth.victim)):
    if instrument not in questionnaires.INSTRUMENTS:
        raise HTTPException(status_code=404, detail="Unknown questionnaire")
    try:
        return service.submit_questionnaire(user, instrument, req.answers, req.channel)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


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
    return _or_404(service.add_event, user, victim_id, req.kind, req.date.isoformat(), req.title)


@router.delete("/counsellor/events/{event_id}")
def delete_event(event_id: int, user=Depends(auth.counsellor)):
    _or_404(service.delete_event, user, event_id)
    return {"deleted": True}


@router.get("/counsellor/alerts")
def alerts(status: Literal["open", "acknowledged", "resolved", "all"] = "open", user=Depends(auth.counsellor)):
    return service.list_alerts(user, status)


@router.post("/counsellor/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, user=Depends(auth.counsellor)):
    return _or_404(service.update_alert, user, alert_id, "acknowledged")


@router.post("/counsellor/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, req: ResolveRequest, user=Depends(auth.counsellor)):
    return _or_404(service.update_alert, user, alert_id, "resolved", req.note)
