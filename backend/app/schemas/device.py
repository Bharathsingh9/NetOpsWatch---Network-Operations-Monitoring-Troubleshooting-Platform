from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class DeviceServiceBase(BaseModel):
    service_type: str  # TCP_PORT, HTTP_ENDPOINT
    port: Optional[int] = None
    url: Optional[str] = None
    name: str
    is_monitored: bool = True

class DeviceServiceCreate(DeviceServiceBase):
    pass

class DeviceServiceResponse(DeviceServiceBase):
    id: int
    device_id: int
    status: str
    last_response_time_ms: Optional[float] = None
    last_status_code: Optional[str] = None
    last_error: Optional[str] = None
    last_check_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class DeviceSNMPConfigBase(BaseModel):
    enabled: bool = False
    version: str = "2c"
    community: str = "public"
    port: int = 161
    timeout_seconds: float = 2.0
    retries: int = 1

class DeviceSNMPConfigCreate(DeviceSNMPConfigBase):
    pass

class DeviceSNMPConfigResponse(BaseModel):
    id: int
    device_id: int
    enabled: bool
    version: str
    port: int
    timeout_seconds: float
    retries: int
    model_config = ConfigDict(from_attributes=True)

class DeviceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    hostname: Optional[str] = None
    ip_address: str
    device_type: str = "SERVER"
    location: Optional[str] = "Primary Datacenter"
    description: Optional[str] = None
    monitoring_enabled: bool = True
    check_interval: int = 30
    parent_device_id: Optional[int] = None

class DeviceCreate(DeviceBase):
    services: Optional[List[DeviceServiceCreate]] = None
    snmp_config: Optional[DeviceSNMPConfigCreate] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    monitoring_enabled: Optional[bool] = None
    check_interval: Optional[int] = None
    parent_device_id: Optional[int] = None

class DeviceResponse(DeviceBase):
    id: int
    status: str
    consecutive_failures: int
    current_latency_ms: Optional[float] = None
    current_packet_loss: Optional[float] = None
    last_check_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DeviceDetailResponse(DeviceResponse):
    services: List[DeviceServiceResponse] = []
    snmp_config: Optional[DeviceSNMPConfigResponse] = None
    model_config = ConfigDict(from_attributes=True)
