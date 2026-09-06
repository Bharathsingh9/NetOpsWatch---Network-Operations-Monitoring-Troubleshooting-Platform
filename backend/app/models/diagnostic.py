from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from app.database.base import Base

class DiagnosticRun(Base):
    __tablename__ = "diagnostic_runs"

    id = Column(Integer, primary_key=True, index=True)
    target_host = Column(String(255), index=True, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    overall_status = Column(String(50), nullable=False)  # PASS, DEGRADED, FAILED
    summary_assessment = Column(Text, nullable=False)
    possible_causes = Column(JSON, nullable=True)
    suggested_actions = Column(JSON, nullable=True)
    results = Column(JSON, nullable=False)  # Contains ping, dns, tcp, http, traceroute sections
