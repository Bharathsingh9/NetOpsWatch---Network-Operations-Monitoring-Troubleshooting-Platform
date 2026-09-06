import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.device import Device, DeviceService
from app.models.metric import MonitoringMetric, SNMPMetric
from app.networking.ping import run_ping
from app.networking.tcp_probe import probe_tcp_port
from app.networking.http_probe import probe_http
from app.networking.snmp_client import probe_snmp
from app.services.alert_service import trigger_alert, resolve_alerts_by_type
from app.services.incident_service import auto_create_incident_from_critical_alert
from app.core.config import settings
from app.core.logging import logger

async def check_device(db: Session, device: Device) -> Dict[str, Any]:
    """
    Executes a comprehensive health check cycle for a single monitored device.
    Includes ICMP reachability, TCP service probes, HTTP health checks, and SNMP polling.
    Calculates device status using consecutive-failure damping and drives the alerting engine.
    """
    now = datetime.now(timezone.utc)
    target_host = device.ip_address or device.hostname

    # 1. ICMP Ping Reachability Check
    ping_result = await run_ping(
        target=target_host,
        count=settings.DEFAULT_PING_COUNT,
        timeout_ms=settings.DEFAULT_PING_TIMEOUT_MS,
        warning_latency_ms=settings.LATENCY_WARNING_THRESHOLD_MS,
        warning_loss_pct=settings.PACKET_LOSS_WARNING_THRESHOLD
    )

    avg_lat = ping_result.avg_latency_ms
    pkt_loss = ping_result.packet_loss_pct
    ping_down = (pkt_loss >= 100.0 or not ping_result.success)

    # 2. Check Monitored Services (TCP Ports & HTTP Endpoints)
    service_results = []
    service_down_count = 0
    total_monitored_services = 0

    for svc in device.services:
        if not svc.is_monitored:
            continue
        total_monitored_services += 1

        if svc.service_type == "TCP_PORT" and svc.port:
            port_res = await probe_tcp_port(target_host, svc.port, timeout_seconds=2.0)
            svc.status = "UP" if port_res.status == "OPEN" else "DOWN"
            svc.last_response_time_ms = port_res.response_time_ms
            svc.last_error = port_res.error_message
            svc.last_check_at = now
            service_results.append(port_res.to_dict())

            if svc.status == "DOWN":
                service_down_count += 1
                alt = trigger_alert(
                    db=db,
                    device_id=device.id,
                    alert_type="PORT_DOWN",
                    severity="CRITICAL",
                    message=f"Port {svc.port} ({svc.name}) on {device.name} is {port_res.status}: {port_res.error_message or 'No response'}",
                    current_value=port_res.status,
                    threshold_value="OPEN"
                )
                if alt:
                    auto_create_incident_from_critical_alert(db, alt)
            else:
                resolve_alerts_by_type(db, device.id, "PORT_DOWN")

        elif svc.service_type == "HTTP_ENDPOINT" and svc.url:
            http_res = await probe_http(svc.url, timeout_seconds=3.0)
            svc.status = "UP" if http_res.status == "HEALTHY" else "DOWN"
            svc.last_response_time_ms = http_res.response_time_ms
            svc.last_status_code = str(http_res.status_code) if http_res.status_code else None
            svc.last_error = http_res.error_message
            svc.last_check_at = now
            service_results.append(http_res.to_dict())

            if svc.status == "DOWN":
                service_down_count += 1
                alt = trigger_alert(
                    db=db,
                    device_id=device.id,
                    alert_type="HTTP_FAILURE",
                    severity="CRITICAL",
                    message=f"HTTP service {svc.name} ({svc.url}) returned {http_res.status}: {http_res.error_message or f'HTTP {http_res.status_code}'}",
                    current_value=f"HTTP {http_res.status_code or 'DOWN'}",
                    threshold_value="HTTP 2xx/3xx"
                )
                if alt:
                    auto_create_incident_from_critical_alert(db, alt)
            else:
                resolve_alerts_by_type(db, device.id, "HTTP_FAILURE")

    # 3. SNMP Polling (if enabled)
    snmp_data = None
    if device.snmp_config and device.snmp_config.enabled:
        snmp_res = await probe_snmp(
            host=target_host,
            community=device.snmp_config.community,
            port=device.snmp_config.port,
            timeout_seconds=device.snmp_config.timeout_seconds,
            retries=device.snmp_config.retries
        )
        snmp_data = snmp_res.to_dict()

        # Save SNMP Metric
        snmp_metric = SNMPMetric(
            device_id=device.id,
            timestamp=now,
            sys_descr=snmp_res.sys_descr,
            sys_uptime_seconds=snmp_res.sys_uptime_seconds,
            sys_name=snmp_res.sys_name,
            interfaces_data=[i.to_dict() for i in snmp_res.interfaces],
            error_message=snmp_res.error_message
        )
        db.add(snmp_metric)

        if not snmp_res.available:
            trigger_alert(
                db=db,
                device_id=device.id,
                alert_type="SNMP_DOWN",
                severity="WARNING",
                message=f"SNMP probe failed on {device.name}: {snmp_res.error_message}",
                current_value="UNAVAILABLE",
                threshold_value="AVAILABLE"
            )
        else:
            resolve_alerts_by_type(db, device.id, "SNMP_DOWN")

    # 4. Device State Calculation
    prev_status = device.status
    if ping_down:
        device.consecutive_failures += 1
        if device.consecutive_failures >= settings.CONSECUTIVE_FAILURES_BEFORE_DOWN:
            new_status = "DOWN"
            alt = trigger_alert(
                db=db,
                device_id=device.id,
                alert_type="HOST_UNREACHABLE",
                severity="CRITICAL",
                message=f"Device {device.name} ({target_host}) is UNREACHABLE after {device.consecutive_failures} consecutive failed checks.",
                current_value=f"100% Packet Loss",
                threshold_value=f"< {settings.PACKET_LOSS_CRITICAL_THRESHOLD}%"
            )
            if alt:
                auto_create_incident_from_critical_alert(db, alt)
        else:
            new_status = "DEGRADED"
    else:
        # Ping succeeded
        device.consecutive_failures = 0
        resolve_alerts_by_type(db, device.id, "HOST_UNREACHABLE")

        # Evaluate Packet Loss
        if pkt_loss >= settings.PACKET_LOSS_CRITICAL_THRESHOLD:
            new_status = "DEGRADED"
            trigger_alert(
                db=db,
                device_id=device.id,
                alert_type="PACKET_LOSS",
                severity="CRITICAL",
                message=f"Critical packet loss ({pkt_loss}%) detected on {device.name}.",
                current_value=f"{pkt_loss}%",
                threshold_value=f"{settings.PACKET_LOSS_CRITICAL_THRESHOLD}%"
            )
        elif pkt_loss >= settings.PACKET_LOSS_WARNING_THRESHOLD:
            new_status = "DEGRADED"
            trigger_alert(
                db=db,
                device_id=device.id,
                alert_type="PACKET_LOSS",
                severity="WARNING",
                message=f"High packet loss ({pkt_loss}%) detected on {device.name}.",
                current_value=f"{pkt_loss}%",
                threshold_value=f"{settings.PACKET_LOSS_WARNING_THRESHOLD}%"
            )
        else:
            resolve_alerts_by_type(db, device.id, "PACKET_LOSS")

        # Evaluate Latency
        if avg_lat is not None and avg_lat >= settings.LATENCY_CRITICAL_THRESHOLD_MS:
            new_status = "DEGRADED"
            trigger_alert(
                db=db,
                device_id=device.id,
                alert_type="HIGH_LATENCY",
                severity="CRITICAL",
                message=f"Severe latency spike ({avg_lat}ms) detected on {device.name}.",
                current_value=f"{avg_lat}ms",
                threshold_value=f"{settings.LATENCY_CRITICAL_THRESHOLD_MS}ms"
            )
        elif avg_lat is not None and avg_lat >= settings.LATENCY_WARNING_THRESHOLD_MS:
            new_status = "DEGRADED"
            trigger_alert(
                db=db,
                device_id=device.id,
                alert_type="HIGH_LATENCY",
                severity="WARNING",
                message=f"High latency ({avg_lat}ms) detected on {device.name}.",
                current_value=f"{avg_lat}ms",
                threshold_value=f"{settings.LATENCY_WARNING_THRESHOLD_MS}ms"
            )
        else:
            resolve_alerts_by_type(db, device.id, "HIGH_LATENCY")

        # Service Degradation Check
        if service_down_count > 0:
            new_status = "DEGRADED"
        elif pkt_loss < settings.PACKET_LOSS_WARNING_THRESHOLD and (avg_lat is None or avg_lat < settings.LATENCY_WARNING_THRESHOLD_MS):
            new_status = "UP"

    # Update device record
    device.status = new_status
    device.current_latency_ms = avg_lat
    device.current_packet_loss = pkt_loss
    device.last_check_at = now

    # 5. Persist Monitoring Metric Record
    metric = MonitoringMetric(
        device_id=device.id,
        timestamp=now,
        metric_type="ICMP",
        status="PASS" if ping_result.success else "FAIL",
        latency_ms=avg_lat,
        packet_loss_pct=pkt_loss,
        details={
            "min_latency_ms": ping_result.min_latency_ms,
            "avg_latency_ms": ping_result.avg_latency_ms,
            "max_latency_ms": ping_result.max_latency_ms,
            "packets_sent": ping_result.packets_sent,
            "packets_received": ping_result.packets_received,
            "services": service_results
        }
    )
    db.add(metric)
    db.commit()

    if prev_status != new_status:
        logger.info(f"STATE CHANGE: Device '{device.name}' transitioned {prev_status} -> {new_status}")

    return {
        "device_id": device.id,
        "name": device.name,
        "status": new_status,
        "ping": ping_result.to_dict(),
        "services": service_results,
        "snmp": snmp_data
    }
