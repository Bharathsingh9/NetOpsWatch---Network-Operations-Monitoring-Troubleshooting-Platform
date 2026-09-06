import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"

def test_auth_login():
    response = client.post("/api/v1/auth/login-json", json={
        "username": "admin",
        "password": "Admin@NetOps123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "ADMIN"

def test_get_devices_authenticated():
    # Login
    auth_resp = client.post("/api/v1/auth/login-json", json={
        "username": "admin",
        "password": "Admin@NetOps123"
    })
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List devices
    resp = client.get("/api/v1/devices", headers=headers)
    assert resp.status_code == 200
    devices = resp.json()
    assert isinstance(devices, list)
    assert len(devices) >= 5

def test_create_and_delete_device():
    auth_resp = client.post("/api/v1/auth/login-json", json={
        "username": "admin",
        "password": "Admin@NetOps123"
    })
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create
    new_dev = {
        "name": "Test-Switch-Integration",
        "hostname": "test-sw.netops.internal",
        "ip_address": "127.0.0.1",
        "device_type": "SWITCH",
        "location": "Test Lab",
        "description": "Integration test switch",
        "monitoring_enabled": True,
        "check_interval": 30
    }
    create_resp = client.post("/api/v1/devices", json=new_dev, headers=headers)
    assert create_resp.status_code == 201
    created_id = create_resp.json()["id"]

    # Retrieve
    get_resp = client.get(f"/api/v1/devices/{created_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Test-Switch-Integration"

    # Delete
    del_resp = client.delete(f"/api/v1/devices/{created_id}", headers=headers)
    assert del_resp.status_code == 204

def test_dashboard_summary():
    auth_resp = client.post("/api/v1/auth/login-json", json={
        "username": "admin",
        "password": "Admin@NetOps123"
    })
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/monitoring/dashboard-summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "kpis" in data
    assert "total_devices" in data["kpis"]
    assert data["kpis"]["total_devices"] >= 5

def test_topology():
    auth_resp = client.post("/api/v1/auth/login-json", json={
        "username": "admin",
        "password": "Admin@NetOps123"
    })
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/topology", headers=headers)
    assert resp.status_code == 200
    topo = resp.json()
    assert "nodes" in topo
    assert "links" in topo
    assert len(topo["nodes"]) >= 5

def test_incident_lifecycle():
    auth_resp = client.post("/api/v1/auth/login-json", json={
        "username": "admin",
        "password": "Admin@NetOps123"
    })
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create incident
    inc_payload = {
        "title": "Integration Test Packet Loss Spike",
        "description": "Observed high RTT on border router uplink",
        "severity": "HIGH"
    }
    create_resp = client.post("/api/v1/incidents", json=inc_payload, headers=headers)
    assert create_resp.status_code == 201
    inc = create_resp.json()
    inc_id = inc["id"]
    assert inc["status"] == "OPEN"
    assert "INC-" in inc["incident_number"]

    # Add Note
    note_resp = client.post(f"/api/v1/incidents/{inc_id}/notes", json={"note": "Investigating fiber interface CRC counters"}, headers=headers)
    assert note_resp.status_code == 201

    # Update to INVESTIGATING
    update_resp = client.put(f"/api/v1/incidents/{inc_id}", json={"status": "INVESTIGATING"}, headers=headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "INVESTIGATING"

    # Resolve
    resolve_resp = client.put(f"/api/v1/incidents/{inc_id}", json={
        "status": "RESOLVED",
        "resolution_notes": "SFP transceiver cleaned and reseated. Signal restored."
    }, headers=headers)
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "RESOLVED"
    assert resolve_resp.json()["resolution_notes"] is not None
