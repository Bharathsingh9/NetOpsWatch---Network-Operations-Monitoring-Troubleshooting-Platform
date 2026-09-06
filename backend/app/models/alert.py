from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.base import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False)
    alert_type = Column(String(50), nullable=False)  # HOST_UNREACHABLE, HIGH_LATENCY, PACKET_LOSS, PORT_DOWN, HTTP_FAILURE, SNMP_DOWN
    severity = Column(String(20), default="WARNING", nullable=False)  # INFO, WARNING, CRITICAL
    status = Column(String(20), default="OPEN", index=True, nullable=False)  # OPEN, ACKNOWLEDGED, RESOLVED
    message = Column(Text, nullable=False)
    current_value = Column(String(100), nullable=True)
    threshold_value = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(50), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    device = relationship("Device", back_populates="alerts")
