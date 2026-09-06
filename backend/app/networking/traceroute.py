import asyncio
import platform
import re
from typing import Dict, Any, List, Optional
from app.core.logging import logger

class TracerouteHop:
    def __init__(
        self,
        hop_num: int,
        ip: Optional[str],
        rtts: List[Optional[float]],
        timed_out: bool = False
    ):
        self.hop_num = hop_num
        self.ip = ip
        self.rtts = rtts
        self.timed_out = timed_out

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hop": self.hop_num,
            "ip": self.ip,
            "rtts": [round(r, 2) if r is not None else None for r in self.rtts],
            "timed_out": self.timed_out
        }

class TracerouteResult:
    def __init__(
        self,
        target: str,
        hops: List[TracerouteHop],
        completed: bool,
        raw_output: str = "",
        error_message: Optional[str] = None
    ):
        self.target = target
        self.hops = hops
        self.completed = completed
        self.raw_output = raw_output
        self.error_message = error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target": self.target,
            "total_hops": len(self.hops),
            "completed": self.completed,
            "hops": [h.to_dict() for h in self.hops],
            "raw_output": self.raw_output,
            "error_message": self.error_message
        }

async def run_traceroute(target: str, max_hops: int = 15, timeout_per_hop_sec: int = 1) -> TracerouteResult:
    """
    Executes cross-platform traceroute asynchronously and parses each hop.
    On Windows uses tracert -d (no DNS resolution for fast tracing).
    On Linux uses traceroute -n.
    """
    is_windows = platform.system().lower() == "windows"

    if is_windows:
        cmd = ["tracert", "-d", "-h", str(max_hops), "-w", str(timeout_per_hop_sec * 1000), target]
    else:
        cmd = ["traceroute", "-n", "-m", str(max_hops), "-w", str(timeout_per_hop_sec), target]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        # Timeout the entire traceroute if it hangs
        overall_timeout = (max_hops * timeout_per_hop_sec * 1.5) + 5.0
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=overall_timeout)
        raw_output = stdout.decode("utf-8", errors="replace") + stderr.decode("utf-8", errors="replace")
    except asyncio.TimeoutError:
        return TracerouteResult(
            target=target,
            hops=[],
            completed=False,
            error_message=f"Traceroute process exceeded maximum run timeout ({overall_timeout}s)."
        )
    except Exception as e:
        logger.error(f"Error running traceroute for {target}: {str(e)}")
        return TracerouteResult(
            target=target,
            hops=[],
            completed=False,
            error_message=str(e)
        )

    hops: List[TracerouteHop] = []
    lines = raw_output.splitlines()

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        # Match Windows: "  1     2 ms     2 ms     2 ms  192.168.1.1" or "  2     *        *        *     Request timed out."
        # Or Linux: " 1  192.168.1.1  1.2 ms  1.1 ms  1.1 ms" or " 2  * * *"
        # General pattern: Starts with a hop number 1-99
        hop_match = re.match(r"^(\d{1,2})\s+(.+)$", line_clean)
        if not hop_match:
            continue

        hop_num = int(hop_match.group(1))
        remainder = hop_match.group(2)

        # Check for request timed out
        if "request timed out" in remainder.lower() or remainder.strip() == "* * *":
            hops.append(TracerouteHop(hop_num=hop_num, ip=None, rtts=[None, None, None], timed_out=True))
            continue

        # Extract IPv4 address
        ip_match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", remainder)
        ip_addr = ip_match.group(1) if ip_match else None

        # Extract ms values
        ms_matches = re.findall(r"(<?\d+(?:\.\d+)?)\s*ms", remainder, re.IGNORECASE)
        rtts: List[Optional[float]] = []
        for ms_str in ms_matches:
            try:
                cleaned = ms_str.replace("<", "").strip()
                rtts.append(float(cleaned))
            except ValueError:
                rtts.append(None)

        # Pad or trim to 3 rtts
        while len(rtts) < 3:
            rtts.append(None)
        rtts = rtts[:3]

        hops.append(TracerouteHop(
            hop_num=hop_num,
            ip=ip_addr,
            rtts=rtts,
            timed_out=(ip_addr is None)
        ))

    completed = len(hops) > 0 and (
        "trace complete" in raw_output.lower() or
        (hops and hops[-1].ip == target)
    )

    return TracerouteResult(
        target=target,
        hops=hops,
        completed=completed,
        raw_output=raw_output
    )
