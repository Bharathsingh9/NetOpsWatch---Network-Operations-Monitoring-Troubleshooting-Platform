from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class AlertBase(BaseModel):
    device_id: int
    alert_type: str
    severity: str = "WARNING"
    message: str
    current_value: Optional[str] = None
    threshold_value: Optional[str] = None

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    status: Optional[str] = None

class AlertResponse(AlertBase):
    id: int
    status: str
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    device_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
