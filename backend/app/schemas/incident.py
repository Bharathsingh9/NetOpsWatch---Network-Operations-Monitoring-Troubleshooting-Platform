from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class IncidentNoteBase(BaseModel):
    note: str

class IncidentNoteCreate(IncidentNoteBase):
    pass

class IncidentNoteResponse(IncidentNoteBase):
    id: int
    incident_id: int
    author: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class IncidentBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str
    device_id: Optional[int] = None
    alert_id: Optional[int] = None
    severity: str = "MEDIUM"
    assigned_to: Optional[str] = None

class IncidentCreate(IncidentBase):
    pass

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None

class IncidentResponse(IncidentBase):
    id: int
    incident_number: str
    status: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    device_name: Optional[str] = None
    notes: List[IncidentNoteResponse] = []
    model_config = ConfigDict(from_attributes=True)
