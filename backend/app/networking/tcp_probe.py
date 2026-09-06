import asyncio
import time
import socket
from typing import Dict, Any, Optional
from app.core.logging import logger

WELL_KNOWN_PORTS = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    143: "IMAP",
    161: "SNMP",
    389: "LDAP",
    443: "HTTPS",
    445: "SMB",
    1433: "MSSQL",
    1521: "Oracle",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    6379: "Redis",
    8000: "HTTP-Alt / Dev",
    8080: "HTTP-Proxy / Alt",
    8443: "HTTPS-Alt"
}

class TCPProbeResult:
    def __init__(
        self,
        host: str,
        port: int,
        status: str,  # OPEN, CLOSED, FILTERED, ERROR
        service_name: str,
        response_time_ms: Optional[float] = None,
        error_message: Optional[str] = None
    ):
        self.host = host
        self.port = port
        self.status = status
        self.service_name = service_name
        self.response_time_ms = response_time_ms
        self.error_message = error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "status": self.status,
            "service_name": self.service_name,
            "response_time_ms": round(self.response_time_ms, 2) if self.response_time_ms is not None else None,
            "error_message": self.error_message
        }

async def probe_tcp_port(host: str, port: int, timeout_seconds: float = 3.0) -> TCPProbeResult:
    """
    Performs an asynchronous TCP socket probe.
    Measures the 3-way handshake round trip time and distinguishes between
    Connection Refused (RST), Timeout (Filtered/Blackholed), and Resolution failure.
    """
    service_name = WELL_KNOWN_PORTS.get(port, f"TCP/{port}")
    start_time = time.perf_counter()

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout_seconds
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

        return TCPProbeResult(
            host=host,
            port=port,
            status="OPEN",
            service_name=service_name,
            response_time_ms=elapsed_ms
        )

    except ConnectionRefusedError:
        # RST packet received: host is reachable, kernel rejected connection
        return TCPProbeResult(
            host=host,
            port=port,
            status="CLOSED",
            service_name=service_name,
            error_message="Connection refused: Host reachable, but port is closed (TCP RST received)."
        )

    except asyncio.TimeoutError:
        # SYN packet sent, no reply received: packets dropped or host unreachable
        return TCPProbeResult(
            host=host,
            port=port,
            status="FILTERED",
            service_name=service_name,
            error_message=f"Connection timed out after {timeout_seconds}s: Packets dropped by firewall or host unreachable."
        )

    except socket.gaierror as e:
        return TCPProbeResult(
            host=host,
            port=port,
            status="ERROR",
            service_name=service_name,
            error_message=f"Hostname resolution failed for {host}: {str(e)}"
        )

    except OSError as e:
        # e.g. Network unreachable, no route to host
        return TCPProbeResult(
            host=host,
            port=port,
            status="FILTERED",
            service_name=service_name,
            error_message=f"Socket error ({e.errno or 'OS'}): {str(e)}"
        )

    except Exception as e:
        return TCPProbeResult(
            host=host,
            port=port,
            status="ERROR",
            service_name=service_name,
            error_message=str(e)
        )
