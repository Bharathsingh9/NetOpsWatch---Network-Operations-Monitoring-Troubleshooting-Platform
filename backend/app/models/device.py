from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.base import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    hostname = Column(String(255), nullable=True)
    ip_address = Column(String(50), index=True, nullable=False)
    device_type = Column(String(50), default="SERVER", nullable=False)  # ROUTER, SWITCH, FIREWALL, SERVER, WORKSTATION, DB_SERVER, OTHER
    location = Column(String(100), default="Primary Datacenter", nullable=True)
    description = Column(Text, nullable=True)
    monitoring_enabled = Column(Boolean, default=True, nullable=False)
    check_interval = Column(Integer, default=30, nullable=False)  # seconds
    
    # State tracking
    status = Column(String(20), default="UNKNOWN", index=True, nullable=False)  # UP, DEGRADED, DOWN, UNKNOWN, DISABLED
    consecutive_failures = Column(Integer, default=0, nullable=False)
    current_latency_ms = Column(Float, nullable=True)
    current_packet_loss = Column(Float, nullable=True)
    last_check_at = Column(DateTime, nullable=True)
    
    # Topology parent/uplink (for topology visualization)
    parent_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    services = relationship("DeviceService", back_populates="device", cascade="all, delete-orphan")
    snmp_config = relationship("DeviceSNMPConfig", back_populates="device", uselist=False, cascade="all, delete-orphan")
    metrics = relationship("MonitoringMetric", back_populates="device", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="device", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="device")
    parent = relationship("Device", remote_side=[id], backref="children")

class DeviceService(Base):
    __tablename__ = "device_services"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    service_type = Column(String(20), nullable=False)  # TCP_PORT, HTTP_ENDPOINT
    port = Column(Integer, nullable=True)
    url = Column(String(255), nullable=True)
    name = Column(String(100), nullable=False)  # e.g. "SSH", "HTTP Web", "PostgreSQL"
    is_monitored = Column(Boolean, default=True, nullable=False)
    status = Column(String(20), default="UNKNOWN", nullable=False)  # UP, DOWN, UNKNOWN
    last_response_time_ms = Column(Float, nullable=True)
    last_status_code = Column(String(20), nullable=True)
    last_error = Column(Text, nullable=True)
    last_check_at = Column(DateTime, nullable=True)

    device = relationship("Device", back_populates="services")

class DeviceSNMPConfig(Base):
    __tablename__ = "device_snmp_configs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), unique=True, nullable=False)
    enabled = Column(Boolean, default=False, nullable=False)
    version = Column(String(10), default="2c", nullable=False)  # 2c, 3
    community = Column(String(100), default="public", nullable=False)
    port = Column(Integer, default=161, nullable=False)
    timeout_seconds = Column(Float, default=2.0, nullable=False)
    retries = Column(Integer, default=1, nullable=False)

    device = relationship("Device", back_populates="snmp_config")
