from datetime import datetime
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, ConfigDict

class MonitoringMetricResponse(BaseModel):
    id: int
    device_id: int
    timestamp: datetime
    metric_type: str
    status: str
    latency_ms: Optional[float] = None
    packet_loss_pct: Optional[float] = None
    details: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)

class SNMPMetricResponse(BaseModel):
    id: int
    device_id: int
    timestamp: datetime
    sys_descr: Optional[str] = None
    sys_uptime_seconds: Optional[int] = None
    sys_name: Optional[str] = None
    cpu_usage_pct: Optional[float] = None
    memory_usage_pct: Optional[float] = None
    interfaces_data: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class DeviceHealthSummary(BaseModel):
    device_id: int
    name: str
    status: str
    current_latency_ms: Optional[float] = None
    min_latency_ms: Optional[float] = None
    max_latency_ms: Optional[float] = None
    avg_latency_ms: Optional[float] = None
    current_packet_loss: Optional[float] = None
    checks_count: int = 0
