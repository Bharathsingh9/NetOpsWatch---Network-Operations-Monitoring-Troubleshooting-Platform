from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database.base import Base

class MonitoringMetric(Base):
    __tablename__ = "monitoring_metrics"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    metric_type = Column(String(20), default="ICMP", nullable=False)  # ICMP, TCP, HTTP
    status = Column(String(20), nullable=False)  # PASS, FAIL, DEGRADED
    latency_ms = Column(Float, nullable=True)
    packet_loss_pct = Column(Float, nullable=True)
    details = Column(JSON, nullable=True)

    device = relationship("Device", back_populates="metrics")

class SNMPMetric(Base):
    __tablename__ = "snmp_metrics"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    sys_descr = Column(Text, nullable=True)
    sys_uptime_seconds = Column(Integer, nullable=True)
    sys_name = Column(String(100), nullable=True)
    cpu_usage_pct = Column(Float, nullable=True)
    memory_usage_pct = Column(Float, nullable=True)
    interfaces_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
