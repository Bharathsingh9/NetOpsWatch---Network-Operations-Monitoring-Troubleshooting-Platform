import time
import dns.resolver
import dns.asyncresolver
from typing import Dict, Any, List, Optional
from app.core.logging import logger

class DNSProbeResult:
    def __init__(
        self,
        query_name: str,
        record_type: str,
        status: str,  # PASS, FAILED
        resolved_ips: List[str],
        response_time_ms: Optional[float] = None,
        nameserver_used: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        self.query_name = query_name
        self.record_type = record_type
        self.status = status
        self.resolved_ips = resolved_ips
        self.response_time_ms = response_time_ms
        self.nameserver_used = nameserver_used
        self.error_message = error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query_name": self.query_name,
            "record_type": self.record_type,
            "status": self.status,
            "resolved_ips": self.resolved_ips,
            "response_time_ms": round(self.response_time_ms, 2) if self.response_time_ms is not None else None,
            "nameserver_used": self.nameserver_used,
            "error_message": self.error_message
        }

async def probe_dns(
    hostname: str,
    record_type: str = "A",
    custom_nameserver: Optional[str] = None,
    timeout_seconds: float = 3.0
) -> DNSProbeResult:
    """
    Performs an asynchronous DNS query using dnspython.
    Measures response time and accurately classifies resolution outcomes (NXDOMAIN, Timeout, NoAnswer).
    """
    resolver = dns.asyncresolver.Resolver()
    resolver.timeout = timeout_seconds
    resolver.lifetime = timeout_seconds

    if custom_nameserver:
        resolver.nameservers = [custom_nameserver]

    nameserver = resolver.nameservers[0] if resolver.nameservers else "system"
    start_time = time.perf_counter()

    try:
        answers = await resolver.resolve(hostname, record_type)
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        resolved_records = [rdata.to_text() for rdata in answers]

        return DNSProbeResult(
            query_name=hostname,
            record_type=record_type,
            status="PASS",
            resolved_ips=resolved_records,
            response_time_ms=elapsed_ms,
            nameserver_used=nameserver
        )

    except dns.resolver.NXDOMAIN:
        return DNSProbeResult(
            query_name=hostname,
            record_type=record_type,
            status="FAILED",
            resolved_ips=[],
            nameserver_used=nameserver,
            error_message=f"NXDOMAIN: The domain name '{hostname}' does not exist."
        )

    except dns.resolver.NoAnswer:
        return DNSProbeResult(
            query_name=hostname,
            record_type=record_type,
            status="FAILED",
            resolved_ips=[],
            nameserver_used=nameserver,
            error_message=f"NoAnswer: Domain exists, but has no '{record_type}' records."
        )

    except dns.resolver.Timeout:
        return DNSProbeResult(
            query_name=hostname,
            record_type=record_type,
            status="FAILED",
            resolved_ips=[],
            nameserver_used=nameserver,
            error_message=f"Timeout: DNS server '{nameserver}' did not respond within {timeout_seconds}s."
        )

    except dns.resolver.NoNameservers:
        return DNSProbeResult(
            query_name=hostname,
            record_type=record_type,
            status="FAILED",
            resolved_ips=[],
            nameserver_used=nameserver,
            error_message="NoNameservers: All configured nameservers failed or refused to answer."
        )

    except Exception as e:
        return DNSProbeResult(
            query_name=hostname,
            record_type=record_type,
            status="FAILED",
            resolved_ips=[],
            nameserver_used=nameserver,
            error_message=f"DNS Resolution Error: {str(e)}"
        )
