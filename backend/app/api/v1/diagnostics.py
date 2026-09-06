from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.diagnostic import DiagnosticRun
from app.models.user import User
from app.schemas.diagnostic import DiagnosticRequest, DiagnosticResponse
from app.networking.diagnostic_engine import run_full_diagnostics
from app.networking.ping import run_ping
from app.networking.traceroute import run_traceroute
from app.networking.dns_probe import probe_dns
from app.networking.tcp_probe import probe_tcp_port
from app.networking.http_probe import probe_http
from app.api.deps import get_current_user, require_roles
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/diagnostics", tags=["Diagnostics"])

class QuickPingRequest(BaseModel):
    target: str
    count: int = 4

class QuickTracerouteRequest(BaseModel):
    target: str
    max_hops: int = 15

class QuickDNSRequest(BaseModel):
    hostname: str
    record_type: str = "A"

class QuickTCPRequest(BaseModel):
    host: str
    port: int

class QuickHTTPRequest(BaseModel):
    url: str

@router.post("/run", response_model=DiagnosticResponse)
async def run_diagnostics_suite(
    diag_in: DiagnosticRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "OPERATOR"]))
):
    started_at = datetime.now(timezone.utc)
    raw_results = await run_full_diagnostics(
        target_host=diag_in.target_host,
        ports=diag_in.ports,
        http_url=diag_in.http_url
    )
    completed_at = datetime.now(timezone.utc)

    # Persist DiagnosticRun record
    run_record = DiagnosticRun(
        target_host=diag_in.target_host,
        device_id=diag_in.device_id,
        started_at=started_at,
        completed_at=completed_at,
        overall_status=raw_results["assessment"]["overall_status"],
        summary_assessment=raw_results["assessment"]["summary_assessment"],
        possible_causes=raw_results["assessment"]["possible_causes"],
        suggested_actions=raw_results["assessment"]["suggested_actions"],
        results={
            "ping": raw_results["ping"],
            "dns": raw_results["dns"],
            "tcp": raw_results["tcp"],
            "http": raw_results["http"],
            "traceroute": raw_results["traceroute"]
        }
    )
    db.add(run_record)
    db.commit()
    db.refresh(run_record)

    log_audit_event(db, current_user.username, "DIAGNOSTIC_RUN", "TARGET", diag_in.target_host, {"overall_status": run_record.overall_status})

    return {
        "id": run_record.id,
        "target": diag_in.target_host,
        "device_id": diag_in.device_id,
        "started_at": started_at,
        "completed_at": completed_at,
        "assessment": raw_results["assessment"],
        "ping": raw_results["ping"],
        "dns": raw_results["dns"],
        "tcp": raw_results["tcp"],
        "http": raw_results["http"],
        "traceroute": raw_results["traceroute"]
    }

@router.post("/ping")
async def quick_ping(req: QuickPingRequest, current_user: User = Depends(get_current_user)):
    res = await run_ping(req.target, count=req.count)
    return res.to_dict()

@router.post("/traceroute")
async def quick_traceroute(req: QuickTracerouteRequest, current_user: User = Depends(get_current_user)):
    res = await run_traceroute(req.target, max_hops=req.max_hops)
    return res.to_dict()

@router.post("/dns")
async def quick_dns(req: QuickDNSRequest, current_user: User = Depends(get_current_user)):
    res = await probe_dns(req.hostname, record_type=req.record_type)
    return res.to_dict()

@router.post("/tcp")
async def quick_tcp(req: QuickTCPRequest, current_user: User = Depends(get_current_user)):
    res = await probe_tcp_port(req.host, req.port)
    return res.to_dict()

@router.post("/http")
async def quick_http(req: QuickHTTPRequest, current_user: User = Depends(get_current_user)):
    res = await probe_http(req.url)
    return res.to_dict()

@router.get("/history")
def get_diagnostic_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    runs = db.query(DiagnosticRun).order_by(DiagnosticRun.started_at.desc()).limit(limit).all()
    return runs
