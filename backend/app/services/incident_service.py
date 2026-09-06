from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.incident import Incident, IncidentNote
from app.models.alert import Alert
from app.core.logging import logger

def generate_next_incident_number(db: Session) -> str:
    count = db.query(func.count(Incident.id)).scalar() or 0
    return f"INC-{1001 + count}"

def create_incident(
    db: Session,
    title: str,
    description: str,
    device_id: Optional[int] = None,
    alert_id: Optional[int] = None,
    severity: str = "MEDIUM",
    assigned_to: Optional[str] = None
) -> Incident:
    inc_num = generate_next_incident_number(db)
    incident = Incident(
        incident_number=inc_num,
        title=title,
        description=description,
        device_id=device_id,
        alert_id=alert_id,
        severity=severity,
        status="OPEN",
        assigned_to=assigned_to,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    logger.warning(f"INCIDENT CREATED: [{inc_num}] ({severity}) {title}")
    return incident

def auto_create_incident_from_critical_alert(db: Session, alert: Alert) -> Optional[Incident]:
    """
    Automatically escalates a critical alert into an incident if one doesn't exist.
    """
    existing_inc = db.query(Incident).filter(
        Incident.alert_id == alert.id,
        Incident.status.in_(["OPEN", "INVESTIGATING"])
    ).first()

    if existing_inc:
        return existing_inc

    device_name = alert.device.name if alert.device else f"Device #{alert.device_id}"
    title = f"{alert.alert_type} on {device_name}"
    description = f"Automated escalation from Alert #{alert.id}: {alert.message}"
    
    return create_incident(
        db=db,
        title=title,
        description=description,
        device_id=alert.device_id,
        alert_id=alert.id,
        severity="HIGH" if alert.severity == "CRITICAL" else "MEDIUM"
    )

def add_incident_note(
    db: Session,
    incident_id: int,
    author: str,
    note_text: str
) -> Optional[IncidentNote]:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return None

    note = IncidentNote(
        incident_id=incident_id,
        author=author,
        note=note_text,
        created_at=datetime.now(timezone.utc)
    )
    incident.updated_at = datetime.now(timezone.utc)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

def update_incident_status(
    db: Session,
    incident_id: int,
    status: str,
    resolution_notes: Optional[str] = None
) -> Optional[Incident]:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return None

    incident.status = status
    incident.updated_at = datetime.now(timezone.utc)
    if status in ["RESOLVED", "CLOSED"]:
        incident.resolved_at = datetime.now(timezone.utc)
        if resolution_notes:
            incident.resolution_notes = resolution_notes

    db.commit()
    db.refresh(incident)
    logger.info(f"Incident {incident.incident_number} status updated to {status}")
    return incident
