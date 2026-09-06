from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class DiagnosticRequest(BaseModel):
    target_host: str
    device_id: Optional[int] = None
    ports: Optional[List[int]] = None
    http_url: Optional[str] = None

class DiagnosticAssessmentSchema(BaseModel):
    overall_status: str
    summary_assessment: str
    possible_causes: List[str]
    suggested_actions: List[str]

class DiagnosticResponse(BaseModel):
    id: Optional[int] = None
    target: str
    device_id: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assessment: DiagnosticAssessmentSchema
    ping: Dict[str, Any]
    dns: Dict[str, Any]
    tcp: List[Dict[str, Any]]
    http: Optional[Dict[str, Any]] = None
    traceroute: Dict[str, Any]
