from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.device import Device, DeviceService, DeviceSNMPConfig
from app.models.user import User
from app.schemas.device import (
    DeviceResponse,
    DeviceDetailResponse,
    DeviceCreate,
    DeviceUpdate,
    DeviceServiceCreate,
    DeviceServiceResponse,
    DeviceSNMPConfigCreate,
    DeviceSNMPConfigResponse
)
from app.api.deps import get_current_user, require_roles
from app.services.monitoring_service import check_device
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/devices", tags=["Devices"])

@router.get("", response_model=List[DeviceResponse])
def get_devices(
    search: Optional[str] = None,
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Device)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Device.name.ilike(search_filter)) |
            (Device.ip_address.ilike(search_filter)) |
            (Device.hostname.ilike(search_filter)) |
            (Device.location.ilike(search_filter))
        )
    if status:
        query = query.filter(Device.status == status.upper())
    if device_type:
        query = query.filter(Device.device_type == device_type.upper())

    return query.offset(skip).limit(limit).all()

@router.post("", response_model=DeviceDetailResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    device_in: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    existing = db.query(Device).filter(Device.name == device_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Device with name '{device_in.name}' already exists.")

    device_data = device_in.model_dump(exclude={"services", "snmp_config"})
    device = Device(**device_data)
    db.add(device)
    db.flush()

    # Add initial services if provided
    if device_in.services:
        for svc_in in device_in.services:
            svc = DeviceService(device_id=device.id, **svc_in.model_dump())
            db.add(svc)

    # Add SNMP config if provided
    if device_in.snmp_config:
        snmp = DeviceSNMPConfig(device_id=device.id, **device_in.snmp_config.model_dump())
        db.add(snmp)

    db.commit()
    db.refresh(device)
    log_audit_event(db, current_user.username, "DEVICE_CREATED", "DEVICE", str(device.id), {"name": device.name, "ip": device.ip_address})
    return device

@router.get("/{device_id}", response_model=DeviceDetailResponse)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.put("/{device_id}", response_model=DeviceDetailResponse)
def update_device(
    device_id: int,
    device_in: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = device_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(device, field, val)

    db.commit()
    db.refresh(device)
    log_audit_event(db, current_user.username, "DEVICE_UPDATED", "DEVICE", str(device.id), update_data)
    return device

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device_name = device.name
    db.delete(device)
    db.commit()
    log_audit_event(db, current_user.username, "DEVICE_DELETED", "DEVICE", str(device_id), {"name": device_name})
    return None

@router.post("/{device_id}/toggle-monitoring", response_model=DeviceResponse)
def toggle_monitoring(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.monitoring_enabled = not device.monitoring_enabled
    if not device.monitoring_enabled:
        device.status = "DISABLED"
    else:
        device.status = "UNKNOWN"

    db.commit()
    db.refresh(device)
    log_audit_event(db, current_user.username, "MONITORING_TOGGLED", "DEVICE", str(device_id), {"enabled": device.monitoring_enabled})
    return device

@router.post("/{device_id}/poll-now")
async def poll_device_now(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    result = await check_device(db, device)
    log_audit_event(db, current_user.username, "ON_DEMAND_POLL", "DEVICE", str(device_id))
    return result

@router.post("/{device_id}/services", response_model=DeviceServiceResponse)
def add_device_service(
    device_id: int,
    service_in: DeviceServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    service = DeviceService(device_id=device_id, **service_in.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    log_audit_event(db, current_user.username, "SERVICE_ADDED", "DEVICE_SERVICE", str(service.id), {"device_id": device_id, "name": service.name})
    return service

@router.delete("/{device_id}/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device_service(
    device_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    service = db.query(DeviceService).filter(DeviceService.id == service_id, DeviceService.device_id == device_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    db.delete(service)
    db.commit()
    log_audit_event(db, current_user.username, "SERVICE_DELETED", "DEVICE_SERVICE", str(service_id))
    return None

@router.put("/{device_id}/snmp", response_model=DeviceSNMPConfigResponse)
def update_snmp_config(
    device_id: int,
    snmp_in: DeviceSNMPConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    snmp = db.query(DeviceSNMPConfig).filter(DeviceSNMPConfig.device_id == device_id).first()
    if not snmp:
        snmp = DeviceSNMPConfig(device_id=device_id, **snmp_in.model_dump())
        db.add(snmp)
    else:
        for field, val in snmp_in.model_dump().items():
            setattr(snmp, field, val)

    db.commit()
    db.refresh(snmp)
    log_audit_event(db, current_user.username, "SNMP_CONFIG_UPDATED", "DEVICE", str(device_id))
    return snmp
