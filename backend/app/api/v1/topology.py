from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.device import Device
from app.models.alert import Alert
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/topology", tags=["Network Topology"])

@router.get("")
def get_network_topology(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    devices = db.query(Device).all()
    active_alerts = (
        db.query(Alert.device_id)
        .filter(Alert.status.in_(["OPEN", "ACKNOWLEDGED"]))
        .all()
    )
    alert_counts: Dict[int, int] = {}
    for (d_id,) in active_alerts:
        alert_counts[d_id] = alert_counts.get(d_id, 0) + 1

    nodes = []
    links = []

    # WAN / Internet Virtual Root Node
    nodes.append({
        "id": "wan-cloud",
        "name": "Internet / WAN Transit",
        "ip": "0.0.0.0/0",
        "device_type": "CLOUD",
        "status": "UP",
        "latency_ms": 0.0,
        "packet_loss_pct": 0.0,
        "active_alerts": 0,
        "is_root": True
    })

    for d in devices:
        nodes.append({
            "id": f"device-{d.id}",
            "device_id": d.id,
            "name": d.name,
            "hostname": d.hostname,
            "ip": d.ip_address,
            "device_type": d.device_type,
            "status": d.status,
            "latency_ms": d.current_latency_ms,
            "packet_loss_pct": d.current_packet_loss,
            "active_alerts": alert_counts.get(d.id, 0),
            "is_root": False
        })

        if d.parent_device_id:
            links.append({
                "source": f"device-{d.parent_device_id}",
                "target": f"device-{d.id}",
                "status": d.status
            })
        elif d.device_type == "ROUTER":
            # Gateway routers connect to WAN
            links.append({
                "source": "wan-cloud",
                "target": f"device-{d.id}",
                "status": d.status
            })
        else:
            # Fallback connection to first router or root
            links.append({
                "source": "wan-cloud",
                "target": f"device-{d.id}",
                "status": d.status
            })

    return {
        "nodes": nodes,
        "links": links
    }
