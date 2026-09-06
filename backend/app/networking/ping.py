import asyncio
import platform
import re
import sys
from typing import Dict, Any, Optional
from app.core.logging import logger

class PingResult:
    def __init__(
        self,
        target: str,
        success: bool,
        status: str,
        packet_loss_pct: float,
        min_latency_ms: Optional[float] = None,
        avg_latency_ms: Optional[float] = None,
        max_latency_ms: Optional[float] = None,
        packets_sent: int = 0,
        packets_received: int = 0,
        raw_output: str = "",
        error_message: Optional[str] = None
    ):
        self.target = target
        self.success = success
        self.status = status  # UP, DEGRADED, DOWN
        self.packet_loss_pct = packet_loss_pct
        self.min_latency_ms = min_latency_ms
        self.avg_latency_ms = avg_latency_ms
        self.max_latency_ms = max_latency_ms
        self.packets_sent = packets_sent
        self.packets_received = packets_received
        self.raw_output = raw_output
        self.error_message = error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target": self.target,
            "success": self.success,
            "status": self.status,
            "packet_loss_pct": round(self.packet_loss_pct, 2),
            "min_latency_ms": round(self.min_latency_ms, 2) if self.min_latency_ms is not None else None,
            "avg_latency_ms": round(self.avg_latency_ms, 2) if self.avg_latency_ms is not None else None,
            "max_latency_ms": round(self.max_latency_ms, 2) if self.max_latency_ms is not None else None,
            "packets_sent": self.packets_sent,
            "packets_received": self.packets_received,
            "raw_output": self.raw_output,
            "error_message": self.error_message
        }

async def run_ping(
    target: str,
    count: int = 4,
    timeout_ms: int = 1000,
    warning_latency_ms: float = 150.0,
    warning_loss_pct: float = 15.0
) -> PingResult:
    """
    Executes actual ICMP ping asynchronously using the native operating system tool.
    Accurately calculates packet loss, min/avg/max latency, and classifies device reachability.
    """
    is_windows = platform.system().lower() == "windows"
    
    if is_windows:
        cmd = ["ping", "-n", str(count), "-w", str(timeout_ms), target]
    else:
        # Linux/macOS ping uses seconds for timeout
        timeout_sec = max(1, timeout_ms // 1000)
        cmd = ["ping", "-c", str(count), "-W", str(timeout_sec), target]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        # Add safety margin on overall process timeout
        overall_timeout = (count * (timeout_ms / 1000.0)) + 3.0
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=overall_timeout)
        raw_output = stdout.decode("utf-8", errors="replace") + stderr.decode("utf-8", errors="replace")
    except asyncio.TimeoutError:
        return PingResult(
            target=target,
            success=False,
            status="DOWN",
            packet_loss_pct=100.0,
            packets_sent=count,
            packets_received=0,
            raw_output="Subprocess timed out waiting for ping response.",
            error_message="ICMP ping timed out."
        )
    except Exception as e:
        logger.error(f"Error executing ping subprocess for {target}: {str(e)}")
        return PingResult(
            target=target,
            success=False,
            status="DOWN",
            packet_loss_pct=100.0,
            packets_sent=count,
            packets_received=0,
            raw_output="",
            error_message=str(e)
        )

    # Parse Windows Output
    if is_windows:
        # Sent = 4, Received = 4, Lost = 0 (0% loss)
        loss_match = re.search(r"Lost\s*=\s*\d+\s*\((\d+)%\s*loss\)", raw_output, re.IGNORECASE)
        sent_match = re.search(r"Sent\s*=\s*(\d+)", raw_output, re.IGNORECASE)
        recv_match = re.search(r"Received\s*=\s*(\d+)", raw_output, re.IGNORECASE)

        sent = int(sent_match.group(1)) if sent_match else count
        received = int(recv_match.group(1)) if recv_match else 0
        loss_pct = float(loss_match.group(1)) if loss_match else (100.0 if received == 0 else 0.0)

        # Minimum = 14ms, Maximum = 22ms, Average = 17ms (or <1ms)
        min_m = re.search(r"Minimum\s*=\s*(<?\d+)ms", raw_output, re.IGNORECASE)
        max_m = re.search(r"Maximum\s*=\s*(<?\d+)ms", raw_output, re.IGNORECASE)
        avg_m = re.search(r"Average\s*=\s*(<?\d+)ms", raw_output, re.IGNORECASE)

        def parse_ms(val_str: Optional[str]) -> Optional[float]:
            if not val_str:
                return None
            val_str = val_str.replace("<", "").strip()
            return float(val_str) if val_str else 0.0

        min_lat = parse_ms(min_m.group(1)) if min_m else None
        max_lat = parse_ms(max_m.group(1)) if max_m else None
        avg_lat = parse_ms(avg_m.group(1)) if avg_m else None

    else:
        # Parse Linux Output
        # 4 packets transmitted, 4 received, 0% packet loss
        pkt_match = re.search(r"(\d+)\s+(?:packets\s+)?transmitted,\s+(\d+)\s+(?:packets\s+)?received,\s+([0-9.]+)%\s+packet\s+loss", raw_output)
        if pkt_match:
            sent = int(pkt_match.group(1))
            received = int(pkt_match.group(2))
            loss_pct = float(pkt_match.group(3))
        else:
            sent = count
            received = 0
            loss_pct = 100.0

        # rtt min/avg/max/mdev = 0.040/0.057/0.076/0.015 ms
        rtt_match = re.search(r"min/avg/max/(?:mdev|stddev)\s*=\s*([0-9.]+)/([0-9.]+)/([0-9.]+)", raw_output)
        if rtt_match:
            min_lat = float(rtt_match.group(1))
            avg_lat = float(rtt_match.group(2))
            max_lat = float(rtt_match.group(3))
        else:
            min_lat = avg_lat = max_lat = None

    # State Classification based on real NetOps logic
    if received == 0 or loss_pct >= 100.0:
        status = "DOWN"
        success = False
    elif loss_pct > warning_loss_pct or (avg_lat is not None and avg_lat >= warning_latency_ms):
        status = "DEGRADED"
        success = True
    else:
        status = "UP"
        success = True

    return PingResult(
        target=target,
        success=success,
        status=status,
        packet_loss_pct=loss_pct,
        min_latency_ms=min_lat,
        avg_latency_ms=avg_lat,
        max_latency_ms=max_lat,
        packets_sent=sent,
        packets_received=received,
        raw_output=raw_output
    )
