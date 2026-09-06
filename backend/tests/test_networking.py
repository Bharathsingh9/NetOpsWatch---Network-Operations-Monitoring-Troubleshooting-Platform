import pytest
import asyncio
from app.networking.ping import run_ping
from app.networking.tcp_probe import probe_tcp_port
from app.networking.dns_probe import probe_dns
from app.networking.http_probe import probe_http
from app.networking.diagnostic_engine import analyze_diagnostic_results

@pytest.mark.asyncio
async def test_ping_localhost():
    res = await run_ping("127.0.0.1", count=2, timeout_ms=1000)
    assert res.target == "127.0.0.1"
    assert res.success is True
    assert res.status == "UP"
    assert res.packet_loss_pct == 0.0
    assert res.packets_received > 0

@pytest.mark.asyncio
async def test_ping_unreachable():
    # RFC 5737 TEST-NET-1 (non-routable)
    res = await run_ping("192.0.2.1", count=1, timeout_ms=500)
    assert res.target == "192.0.2.1"
    assert res.status == "DOWN"
    assert res.packet_loss_pct == 100.0

@pytest.mark.asyncio
async def test_tcp_probe_closed_port():
    # An unused high port on localhost should return CLOSED (RST) or FILTERED
    res = await probe_tcp_port("127.0.0.1", 59998, timeout_seconds=1.0)
    assert res.host == "127.0.0.1"
    assert res.port == 59998
    assert res.status in ["CLOSED", "FILTERED"]

@pytest.mark.asyncio
async def test_dns_probe_valid():
    res = await probe_dns("google.com", record_type="A", timeout_seconds=3.0)
    assert res.query_name == "google.com"
    assert res.status == "PASS"
    assert len(res.resolved_ips) > 0

@pytest.mark.asyncio
async def test_dns_probe_nxdomain():
    res = await probe_dns("non-existent-subdomain-test-xyz-987654.com", record_type="A", timeout_seconds=3.0)
    assert res.status == "FAILED"
    assert "NXDOMAIN" in (res.error_message or "")

def test_diagnostic_reasoning_host_down():
    ping_res = {"success": False, "packet_loss_pct": 100.0, "avg_latency_ms": None}
    dns_res = {"status": "PASS", "resolved_ips": ["1.2.3.4"]}
    tcp_results = [{"port": 80, "status": "FILTERED"}]
    trace_res = {"completed": False, "hops": []}

    assessment = analyze_diagnostic_results(
        target="srv-01",
        ping_res=ping_res,
        dns_res=dns_res,
        tcp_results=tcp_results,
        http_res=None,
        trace_res=trace_res
    )
    assert assessment.overall_status == "CRITICAL_FAILURE"
    assert "unreachable" in assessment.summary_assessment.lower()
    assert len(assessment.possible_causes) > 0

def test_diagnostic_reasoning_service_closed():
    ping_res = {"success": True, "packet_loss_pct": 0.0, "avg_latency_ms": 12.0}
    dns_res = {"status": "PASS", "resolved_ips": ["10.0.0.1"]}
    tcp_results = [{"port": 443, "status": "CLOSED"}]
    trace_res = {"completed": True, "hops": []}

    assessment = analyze_diagnostic_results(
        target="srv-web",
        ping_res=ping_res,
        dns_res=dns_res,
        tcp_results=tcp_results,
        http_res=None,
        trace_res=trace_res
    )
    assert assessment.overall_status == "CRITICAL_FAILURE"
    assert "service ports" in assessment.summary_assessment.lower()
