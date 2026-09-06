from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.device import Device
from app.core.logging import logger

def trigger_alert(
    db: Session,
    device_id: int,
    alert_type: str,
    severity: str,
    message: str,
    current_value: Optional[str] = None,
    threshold_value: Optional[str] = None
) -> Optional[Alert]:
    """
    Creates an alert if an active (OPEN or ACKNOWLEDGED) alert of the same type
    does not already exist for this device, preventing alert storms.
    """
    existing_alert = (
        db.query(Alert)
        .filter(
            Alert.device_id == device_id,
            Alert.alert_type == alert_type,
            Alert.status.in_(["OPEN", "ACKNOWLEDGED"])
        )
        .first()
    )

    if existing_alert:
        # Update current value if changed
        existing_alert.current_value = current_value
        db.commit()
        return existing_alert

    new_alert = Alert(
        device_id=device_id,
        alert_type=alert_type,
        severity=severity,
        status="OPEN",
        message=message,
        current_value=current_value,
        threshold_value=threshold_value,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    logger.warning(f"ALERT CREATED: [{severity}] Device {device_id} - {message}")
    return new_alert

def resolve_alerts_by_type(
    db: Session,
    device_id: int,
    alert_type: str,
    resolution_note: str = "Condition recovered automatically."
) -> List[Alert]:
    """
    Auto-resolves open alerts when metrics return below thresholds.
    """
    active_alerts = (
        db.query(Alert)
        .filter(
            Alert.device_id == device_id,
            Alert.alert_type == alert_type,
            Alert.status.in_(["OPEN", "ACKNOWLEDGED"])
        )
        .all()
    )

    resolved: List[Alert] = []
    now = datetime.now(timezone.utc)
    for alert in active_alerts:
        alert.status = "RESOLVED"
        alert.resolved_at = now
        resolved.append(alert)
        logger.info(f"ALERT RESOLVED: Device {device_id} - {alert.alert_type} ({resolution_note})")

    if resolved:
        db.commit()
    return resolved

def acknowledge_alert(db: Session, alert_id: int, username: str) -> Optional[Alert]:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        return None

    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = username
    db.commit()
    db.refresh(alert)
    logger.info(f"Alert {alert_id} acknowledged by {username}")
    return alert

def resolve_alert_manually(db: Session, alert_id: int) -> Optional[Alert]:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        return None

    alert.status = "RESOLVED"
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    logger.info(f"Alert {alert_id} manually resolved")
    return alert
