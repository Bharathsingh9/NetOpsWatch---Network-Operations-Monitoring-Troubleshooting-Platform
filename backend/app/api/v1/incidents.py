from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.incident import Incident, IncidentNote
from app.models.user import User
from app.schemas.incident import (
    IncidentResponse,
    IncidentCreate,
    IncidentUpdate,
    IncidentNoteCreate,
    IncidentNoteResponse
)
from app.api.deps import get_current_user, require_roles
from app.services.incident_service import create_incident, add_incident_note, update_incident_status
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("", response_model=List[IncidentResponse])
def get_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    device_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status.upper())
    if severity:
        query = query.filter(Incident.severity == severity.upper())
    if device_id:
        query = query.filter(Incident.device_id == device_id)

    incidents = query.order_by(Incident.created_at.desc()).offset(skip).limit(limit).all()
    for inc in incidents:
        if inc.device:
            inc.device_name = inc.device.name
    return incidents

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_new_incident(
    inc_in: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    inc = create_incident(
        db=db,
        title=inc_in.title,
        description=inc_in.description,
        device_id=inc_in.device_id,
        alert_id=inc_in.alert_id,
        severity=inc_in.severity,
        assigned_to=inc_in.assigned_to or current_user.username
    )
    log_audit_event(db, current_user.username, "INCIDENT_CREATED", "INCIDENT", inc.incident_number, {"title": inc.title})
    if inc.device:
        inc.device_name = inc.device.name
    return inc

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident_detail(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if inc.device:
        inc.device_name = inc.device.name
    return inc

@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: int,
    inc_in: IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    update_dict = inc_in.model_dump(exclude_unset=True)
    if "status" in update_dict:
        update_incident_status(db, incident_id, update_dict["status"], update_dict.get("resolution_notes"))
        del update_dict["status"]
        if "resolution_notes" in update_dict:
            del update_dict["resolution_notes"]

    for field, val in update_dict.items():
        setattr(inc, field, val)

    db.commit()
    db.refresh(inc)
    log_audit_event(db, current_user.username, "INCIDENT_UPDATED", "INCIDENT", inc.incident_number, inc_in.model_dump(exclude_unset=True))
    if inc.device:
        inc.device_name = inc.device.name
    return inc

@router.post("/{incident_id}/notes", response_model=IncidentNoteResponse, status_code=status.HTTP_201_CREATED)
def add_note_to_incident(
    incident_id: int,
    note_in: IncidentNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    note = add_incident_note(
        db=db,
        incident_id=incident_id,
        author=current_user.username,
        note_text=note_in.note
    )
    if not note:
        raise HTTPException(status_code=404, detail="Incident not found")
    log_audit_event(db, current_user.username, "INCIDENT_NOTE_ADDED", "INCIDENT", str(incident_id))
    return note
