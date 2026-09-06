import asyncio
from typing import Dict, Any, List, Optional
from app.networking.ping import run_ping
from app.networking.dns_probe import probe_dns
from app.networking.tcp_probe import probe_tcp_port
from app.networking.http_probe import probe_http
from app.networking.traceroute import run_traceroute
from app.core.logging import logger

class DiagnosticAssessment:
    def __init__(
        self,
        overall_status: str,  # OPERATIONAL, DEGRADED, CRITICAL_FAILURE
        summary_assessment: str,
        possible_causes: List[str],
        suggested_actions: List[str]
    ):
        self.overall_status = overall_status
        self.summary_assessment = summary_assessment
        self.possible_causes = possible_causes
        self.suggested_actions = suggested_actions

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_status": self.overall_status,
            "summary_assessment": self.summary_assessment,
            "possible_causes": self.possible_causes,
            "suggested_actions": self.suggested_actions
        }

def analyze_diagnostic_results(
    target: str,
    ping_res: Dict[str, Any],
    dns_res: Dict[str, Any],
    tcp_results: List[Dict[str, Any]],
    http_res: Optional[Dict[str, Any]],
    trace_res: Dict[str, Any]
) -> DiagnosticAssessment:
    """
    Applies NOC expert reasoning rules across multi-protocol diagnostic telemetry.
    Distinguishes reachability, service, firewall, application, and path congestion issues.
    """
    ping_ok = ping_res.get("success", False) and ping_res.get("packet_loss_pct", 100) < 100
    packet_loss = ping_res.get("packet_loss_pct", 100)
    avg_latency = ping_res.get("avg_latency_ms")
    dns_ok = dns_res.get("status") == "PASS"

    open_ports = [t["port"] for t in tcp_results if t.get("status") == "OPEN"]
    closed_ports = [t["port"] for t in tcp_results if t.get("status") == "CLOSED"]
    filtered_ports = [t["port"] for t in tcp_results if t.get("status") == "FILTERED"]

    http_ok = http_res.get("status") == "HEALTHY" if http_res else None
    http_code = http_res.get("status_code") if http_res else None

    causes: List[str] = []
    actions: List[str] = []

    # Scenario 1: Total Host / Network Unreachability
    if not ping_ok and not open_ports:
        overall = "CRITICAL_FAILURE"
        if dns_ok:
            summary = f"Host '{target}' is completely unreachable over ICMP and TCP, but DNS resolves successfully."
            causes.extend([
                "Target host is powered off, OS crashed, or network interface is down.",
                "Intermediate gateway or routing table entry dropped the packets.",
                "Strict upstream border firewall or security group blocks ICMP and all probed ports."
            ])
            actions.extend([
                "Check physical switch port link status and device power.",
                "Review traceroute hops to identify where packets were dropped.",
                "Verify host interface IP configuration and default gateway."
            ])
        else:
            summary = f"Complete communication failure: DNS resolution failed and host '{target}' cannot be reached."
            causes.extend([
                "Invalid or unregistered hostname.",
                "DNS server outage or misconfigured local resolver.",
                "Total WAN or local network link outage."
            ])
            actions.extend([
                "Verify hostname spelling or test reachability using direct IP address.",
                "Check primary and secondary DNS server availability (e.g. 8.8.8.8 / 1.1.1.1)."
            ])

    # Scenario 2: Host Reachable, but Service / Port Closed (RST)
    elif ping_ok and closed_ports and not open_ports:
        overall = "CRITICAL_FAILURE"
        summary = f"Network reachability verified (Ping: {avg_latency}ms), but service ports ({closed_ports}) actively rejected connection (TCP RST)."
        causes.extend([
            "Target application daemon (e.g. Web server / Database) is stopped or crashed.",
            "Service is listening on a different port or bound exclusively to localhost.",
            "Local OS firewall rejected connection on requested ports."
        ])
        actions.extend([
            "Inspect target host process status (`systemctl status <service>` or `Get-Service`).",
            "Verify listening sockets using `ss -tulpn` or `netstat -ano`.",
            "Check service application logs for crash or panic traces."
        ])

    # Scenario 3: Host Reachable, but Service Filtered / Dropped (Timeout)
    elif ping_ok and filtered_ports and not open_ports:
        overall = "DEGRADED"
        summary = f"Host '{target}' responds to ICMP, but TCP connection timed out on ports ({filtered_ports})."
        causes.extend([
            "Firewall (iptables / Windows Firewall / Network ACL) is dropping SYN packets.",
            "Security Group or cloud VPC route table lacks ingress allow rule for target ports."
        ])
        actions.extend([
            "Review firewall rules on the target host and network perimeter.",
            "Verify Security Group ingress rules for probed ports."
        ])

    # Scenario 4: Web Application Error (HTTP 5xx)
    elif ping_ok and (http_code is not None and http_code >= 500):
        overall = "CRITICAL_FAILURE"
        summary = f"Network and TCP ports are reachable, but the HTTP application returned Server Error {http_code}."
        causes.extend([
            f"Backend application runtime exception (HTTP {http_code}).",
            "Upstream reverse proxy (Nginx/HAProxy) failed to reach the application server (502/504).",
            "Database connection pool exhausted or backend dependency unavailable."
        ])
        actions.extend([
            "Check web server error logs (`/var/log/nginx/error.log` or app logs).",
            "Verify database connectivity and backend API dependencies.",
            "Inspect application CPU and memory utilization."
        ])

    # Scenario 5: Network Path Degraded / Packet Loss or High Latency
    elif ping_ok and (packet_loss > 10.0 or (avg_latency is not None and avg_latency > 150.0)):
        overall = "DEGRADED"
        summary = f"Target '{target}' is reachable but experiencing performance degradation ({packet_loss}% packet loss, {avg_latency}ms latency)."
        causes.extend([
            "Network path link congestion or bandwidth saturation.",
            "Suboptimal BGP routing or route flapping across transit providers.",
            "Intermediate router bufferbloat or duplex mismatch on physical interface."
        ])
        actions.extend([
            "Review traceroute RTT variance across intermediate hops.",
            "Check bandwidth utilization on core uplink interfaces.",
            "Inspect physical interfaces for CRC errors or input/output drops."
        ])

    # Scenario 6: Fully Operational
    else:
        overall = "OPERATIONAL"
        summary = f"All diagnostic checks passed. Host '{target}' is fully responsive over ICMP, TCP, and application protocols."
        causes.append("No abnormal symptoms detected.")
        actions.append("Maintain standard proactive monitoring schedule.")

    return DiagnosticAssessment(
        overall_status=overall,
        summary_assessment=summary,
        possible_causes=causes,
        suggested_actions=actions
    )

async def run_full_diagnostics(
    target_host: str,
    ports: Optional[List[int]] = None,
    http_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Orchestrates end-to-end multi-protocol diagnostic workflow asynchronously.
    """
    if not ports:
        ports = [80, 443, 22]

    # Run Ping and DNS concurrently
    ping_task = run_ping(target_host, count=4, timeout_ms=1000)
    dns_task = probe_dns(target_host, record_type="A")

    ping_res, dns_res = await asyncio.gather(ping_task, dns_task)

    # Run TCP port probes concurrently
    tcp_tasks = [probe_tcp_port(target_host, p, timeout_seconds=2.5) for p in ports]
    tcp_raw_results = await asyncio.gather(*tcp_tasks)
    tcp_results = [t.to_dict() for t in tcp_raw_results]

    # Run HTTP probe if requested or if 80/443 is open
    http_res_dict: Optional[Dict[str, Any]] = None
    if http_url:
        http_probe_res = await probe_http(http_url, timeout_seconds=4.0)
        http_res_dict = http_probe_res.to_dict()
    elif any(t["port"] in [80, 443] and t["status"] == "OPEN" for t in tcp_results):
        target_port = 443 if any(t["port"] == 443 and t["status"] == "OPEN" for t in tcp_results) else 80
        proto = "https" if target_port == 443 else "http"
        auto_url = f"{proto}://{target_host}:{target_port}"
        http_probe_res = await probe_http(auto_url, timeout_seconds=4.0)
        http_res_dict = http_probe_res.to_dict()

    # Run Traceroute
    trace_res = await run_traceroute(target_host, max_hops=12, timeout_per_hop_sec=1)

    # Analyze with reasoning engine
    assessment = analyze_diagnostic_results(
        target=target_host,
        ping_res=ping_res.to_dict(),
        dns_res=dns_res.to_dict(),
        tcp_results=tcp_results,
        http_res=http_res_dict,
        trace_res=trace_res.to_dict()
    )

    return {
        "target": target_host,
        "assessment": assessment.to_dict(),
        "ping": ping_res.to_dict(),
        "dns": dns_res.to_dict(),
        "tcp": tcp_results,
        "http": http_res_dict,
        "traceroute": trace_res.to_dict()
    }
