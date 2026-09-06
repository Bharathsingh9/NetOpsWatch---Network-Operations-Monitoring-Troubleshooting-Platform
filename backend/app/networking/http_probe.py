import time
import httpx
from typing import Dict, Any, Optional
from app.core.logging import logger

class HTTPProbeResult:
    def __init__(
        self,
        url: str,
        status: str,  # HEALTHY, DEGRADED, UNHEALTHY, DOWN
        status_code: Optional[int] = None,
        response_time_ms: Optional[float] = None,
        content_length: Optional[int] = None,
        ssl_valid: Optional[bool] = None,
        error_message: Optional[str] = None
    ):
        self.url = url
        self.status = status
        self.status_code = status_code
        self.response_time_ms = response_time_ms
        self.content_length = content_length
        self.ssl_valid = ssl_valid
        self.error_message = error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "status": self.status,
            "status_code": self.status_code,
            "response_time_ms": round(self.response_time_ms, 2) if self.response_time_ms is not None else None,
            "content_length": self.content_length,
            "ssl_valid": self.ssl_valid,
            "error_message": self.error_message
        }

async def probe_http(
    url: str,
    method: str = "GET",
    timeout_seconds: float = 5.0,
    verify_ssl: bool = True
) -> HTTPProbeResult:
    """
    Performs an asynchronous HTTP/HTTPS health probe.
    Accurately measures response time and captures status codes, connection errors, and SSL validation.
    """
    # Ensure URL has protocol
    if not (url.startswith("http://") or url.startswith("https://")):
        url = "http://" + url

    start_time = time.perf_counter()
    try:
        async with httpx.AsyncClient(verify=verify_ssl, follow_redirects=True, timeout=timeout_seconds) as client:
            resp = await client.request(method, url)
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            
            status_code = resp.status_code
            content_length = len(resp.content)
            ssl_valid = True if url.startswith("https://") else None

            # Classification
            if 200 <= status_code < 400:
                status = "HEALTHY"
                err = None
            elif 400 <= status_code < 500:
                status = "DEGRADED"
                err = f"Client Error: HTTP {status_code}"
            else:  # 500+
                status = "UNHEALTHY"
                err = f"Server Error: HTTP {status_code}"

            return HTTPProbeResult(
                url=url,
                status=status,
                status_code=status_code,
                response_time_ms=elapsed_ms,
                content_length=content_length,
                ssl_valid=ssl_valid,
                error_message=err
            )

    except httpx.ConnectTimeout:
        return HTTPProbeResult(
            url=url,
            status="DOWN",
            error_message=f"Connection Timeout: Server did not respond within {timeout_seconds}s."
        )

    except httpx.ConnectError as e:
        return HTTPProbeResult(
            url=url,
            status="DOWN",
            error_message=f"Connection Refused or Host Unreachable: {str(e)}"
        )

    except httpx.HTTPStatusError as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return HTTPProbeResult(
            url=url,
            status="UNHEALTHY",
            status_code=e.response.status_code,
            response_time_ms=elapsed_ms,
            error_message=f"HTTP Status Error: {str(e)}"
        )

    except Exception as e:
        error_str = str(e)
        ssl_issue = "certificate" in error_str.lower() or "ssl" in error_str.lower()
        return HTTPProbeResult(
            url=url,
            status="DOWN",
            ssl_valid=False if ssl_issue else None,
            error_message=f"HTTP Check Failed: {error_str}"
        )
