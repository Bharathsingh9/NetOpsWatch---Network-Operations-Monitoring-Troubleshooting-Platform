from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.session import get_db
from app.models.device import Device
from app.models.metric import MonitoringMetric, SNMPMetric
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.user import User
from app.schemas.metric import MonitoringMetricResponse, SNMPMetricResponse
from app.schemas.alert import AlertResponse
from app.schemas.incident import IncidentResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/monitoring", tags=["Monitoring & Metrics"])

@router.get("/dashboard-summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_devices = db.query(Device).count()
    devices_up = db.query(Device).filter(Device.status == "UP").count()
    devices_degraded = db.query(Device).filter(Device.status == "DEGRADED").count()
    devices_down = db.query(Device).filter(Device.status == "DOWN").count()
    devices_unknown = total_devices - (devices_up + devices_degraded + devices_down)

    active_alerts = db.query(Alert).filter(Alert.status.in_(["OPEN", "ACKNOWLEDGED"])).count()
    critical_alerts = db.query(Alert).filter(Alert.status.in_(["OPEN", "ACKNOWLEDGED"]), Alert.severity == "CRITICAL").count()
    open_incidents = db.query(Incident).filter(Incident.status.in_(["OPEN", "INVESTIGATING"])).count()

    # Calculate average network latency and packet loss across active devices
    avg_latency = db.query(func.avg(Device.current_latency_ms)).filter(Device.status == "UP").scalar()
    avg_loss = db.query(func.avg(Device.current_packet_loss)).filter(Device.monitoring_enabled == True).scalar()

    recent_alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(5).all()
    recent_incidents = db.query(Incident).order_by(Incident.created_at.desc()).limit(5).all()

    # Latency trend (last 20 ICMP checks)
    recent_metrics = (
        db.query(MonitoringMetric)
        .filter(MonitoringMetric.latency_ms.isnot(None))
        .order_by(MonitoringMetric.timestamp.desc())
        .limit(20)
        .all()
    )
    trend_data = [
        {
            "timestamp": m.timestamp.isoformat(),
            "latency_ms": round(m.latency_ms, 2) if m.latency_ms is not None else None,
            "packet_loss_pct": m.packet_loss_pct,
            "device_id": m.device_id
        }
        for m in reversed(recent_metrics)
    ]

    return {
        "kpis": {
            "total_devices": total_devices,
            "devices_up": devices_up,
            "devices_degraded": devices_degraded,
            "devices_down": devices_down,
            "devices_unknown": devices_unknown,
            "active_alerts": active_alerts,
            "critical_alerts": critical_alerts,
            "open_incidents": open_incidents,
            "average_latency_ms": round(avg_latency, 2) if avg_latency is not None else 0.0,
            "average_packet_loss_pct": round(avg_loss, 2) if avg_loss is not None else 0.0
        },
        "recent_alerts": [
            {
                "id": a.id,
                "device_id": a.device_id,
                "device_name": a.device.name if a.device else f"#{a.device_id}",
                "alert_type": a.alert_type,
                "severity": a.severity,
                "status": a.status,
                "message": a.message,
                "created_at": a.created_at
            }
            for a in recent_alerts
        ],
        "recent_incidents": [
            {
                "id": inc.id,
                "incident_number": inc.incident_number,
                "title": inc.title,
                "severity": inc.severity,
                "status": inc.status,
                "device_name": inc.device.name if inc.device else "N/A",
                "created_at": inc.created_at
            }
            for inc in recent_incidents
        ],
        "latency_trend": trend_data
    }

@router.get("/device/{device_id}/metrics", response_model=List[MonitoringMetricResponse])
def get_device_metrics(
    device_id: int,
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    since_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    metrics = (
        db.query(MonitoringMetric)
        .filter(MonitoringMetric.device_id == device_id, MonitoringMetric.timestamp >= since_time)
        .order_by(MonitoringMetric.timestamp.asc())
        .all()
    )
    return metrics

@router.get("/device/{device_id}/snmp-metrics", response_model=List[SNMPMetricResponse])
def get_device_snmp_metrics(
    device_id: int,
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    snmp_records = (
        db.query(SNMPMetric)
        .filter(SNMPMetric.device_id == device_id)
        .order_by(SNMPMetric.timestamp.desc())
        .limit(limit)
        .all()
    )
    return snmp_records
