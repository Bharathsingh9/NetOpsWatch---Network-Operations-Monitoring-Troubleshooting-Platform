from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alert import AlertResponse, AlertUpdate
from app.api.deps import get_current_user, require_roles
from app.services.alert_service import acknowledge_alert, resolve_alert_manually
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertResponse])
def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    device_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status.upper())
    if severity:
        query = query.filter(Alert.severity == severity.upper())
    if device_id:
        query = query.filter(Alert.device_id == device_id)

    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    # Enrich with device name
    for a in alerts:
        if a.device:
            a.device_name = a.device.name
    return alerts

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert_endpoint(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    alert = acknowledge_alert(db, alert_id, current_user.username)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    log_audit_event(db, current_user.username, "ALERT_ACKNOWLEDGED", "ALERT", str(alert_id))
    if alert.device:
        alert.device_name = alert.device.name
    return alert

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert_endpoint(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    alert = resolve_alert_manually(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    log_audit_event(db, current_user.username, "ALERT_RESOLVED_MANUAL", "ALERT", str(alert_id))
    if alert.device:
        alert.device_name = alert.device.name
    return alert
