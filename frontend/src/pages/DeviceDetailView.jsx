import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Server,
  Activity,
  Radio,
  Globe,
  Play,
  Plus,
  Trash2,
  Clock,
  ShieldAlert,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

export function DeviceDetailView({ deviceId, onBack, onRunDiagnostic }) {
  const [device, setDevice] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [snmpMetrics, setSnmpMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, services, snmp, diagnostics
  const [pollLoading, setPollLoading] = useState(false);

  // New Service Form
  const [newSvcType, setNewSvcType] = useState('TCP_PORT');
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcPort, setNewSvcPort] = useState(80);
  const [newSvcUrl, setNewSvcUrl] = useState('');
  const [svcLoading, setSvcLoading] = useState(false);

  // On-demand Diagnostic state
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState(null);

  const fetchDeviceData = useCallback(async () => {
    try {
      const dev = await api.getDevice(deviceId);
      setDevice(dev);
      const met = await api.getDeviceMetrics(deviceId, 24);
      setMetrics(met);
      const snmp = await api.getDeviceSNMPMetrics(deviceId, 5);
      setSnmpMetrics(snmp);
    } catch (err) {
      console.error('Error fetching device data:', err);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDeviceData();
  }, [fetchDeviceData]);

  const handlePollNow = async () => {
    setPollLoading(true);
    try {
      await api.pollDeviceNow(deviceId);
      await fetchDeviceData();
    } catch (err) {
      alert(`Poll failed: ${err.message}`);
    } finally {
      setPollLoading(false);
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newSvcName) return;
    setSvcLoading(true);
    try {
      await api.addDeviceService(deviceId, {
        service_type: newSvcType,
        name: newSvcName,
        port: newSvcType === 'TCP_PORT' ? Number(newSvcPort) : null,
        url: newSvcType === 'HTTP_ENDPOINT' ? newSvcUrl : null,
        is_monitored: true,
      });
      setNewSvcName('');
      setNewSvcUrl('');
      await fetchDeviceData();
    } catch (err) {
      alert(`Failed to add service: ${err.message}`);
    } finally {
      setSvcLoading(false);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Delete this monitored service?')) return;
    try {
      await api.deleteDeviceService(deviceId, serviceId);
      await fetchDeviceData();
    } catch (err) {
      alert(`Failed to delete service: ${err.message}`);
    }
  };

  const handleRunDiagnostic = async () => {
    setDiagRunning(true);
    setDiagResult(null);
    try {
      const openPorts = (device.services || [])
        .filter((s) => s.service_type === 'TCP_PORT' && s.port)
        .map((s) => s.port);
      const httpSvc = (device.services || []).find((s) => s.service_type === 'HTTP_ENDPOINT');

      const result = await api.runDiagnostics({
        target_host: device.ip_address,
        device_id: device.id,
        ports: openPorts.length > 0 ? openPorts : [80, 443, 22],
        http_url: httpSvc?.url || null,
      });
      setDiagResult(result);
    } catch (err) {
      alert(`Diagnostic run failed: ${err.message}`);
    } finally {
      setDiagRunning(false);
    }
  };

  if (loading || !device) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading device details...
      </div>
    );
  }

  const latestSnmp = snmpMetrics.length > 0 ? snmpMetrics[0] : null;

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Inventory</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{device.name}</h1>
              <StatusBadge status={device.status} />
              <span style={{
                fontSize: '0.75rem',
                background: 'rgba(255,255,255,0.06)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)'
              }}>
                {device.device_type}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>IP: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{device.ip_address}</strong></span>
              {device.hostname && <span>FQDN: <span style={{ fontFamily: 'var(--font-mono)' }}>{device.hostname}</span></span>}
              <span>Location: {device.location || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handlePollNow}
            disabled={pollLoading}
          >
            <Play size={14} fill="currentColor" />
            <span>{pollLoading ? 'Polling...' : 'Poll Now'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={16} />
          <span>Telemetry & Metrics</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <Globe size={16} />
          <span>Services ({device.services?.length || 0})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'snmp' ? 'active' : ''}`}
          onClick={() => setActiveTab('snmp')}
        >
          <Radio size={16} />
          <span>SNMP MIB-II</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          <Zap size={16} />
          <span>Multi-Protocol Diagnostics</span>
        </button>
      </div>

      {/* Tab 1: Overview & Metrics */}
      {activeTab === 'overview' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: '24px' }}>
            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--primary)' }}>
                <Activity size={22} />
              </div>
              <div>
                <div className="kpi-label">Current Latency</div>
                <div className="kpi-value">
                  {device.current_latency_ms !== null ? `${device.current_latency_ms} ms` : '—'}
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'var(--down-bg)', color: 'var(--down)' }}>
                <Zap size={22} />
              </div>
              <div>
                <div className="kpi-label">Packet Loss</div>
                <div className="kpi-value">
                  {device.current_packet_loss !== null ? `${device.current_packet_loss}%` : '0%'}
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'var(--degraded-bg)', color: 'var(--degraded)' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="kpi-label">Consecutive Failures</div>
                <div className="kpi-value">{device.consecutive_failures}</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                <Clock size={22} />
              </div>
              <div>
                <div className="kpi-label">Check Interval</div>
                <div className="kpi-value">{device.check_interval}s</div>
              </div>
            </div>
          </div>

          {/* Historical Metrics Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Activity size={18} color="var(--primary)" />
                <span>ICMP Reachability & Latency Log (Last 24 Hours)</span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {metrics.length} data points recorded
              </span>
            </div>

            {metrics.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                No metric samples recorded yet for this device.
              </div>
            ) : (
              <div className="table-container">
                <table className="noc-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Status</th>
                      <th>RTT Latency</th>
                      <th>Packet Loss</th>
                      <th>Packets Sent / Recv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.slice(-15).reverse().map((m) => (
                      <tr key={m.id}>
                        <td className="mono-cell">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td>
                          <StatusBadge status={m.status === 'PASS' ? 'UP' : 'DOWN'} />
                        </td>
                        <td className="mono-cell">
                          {m.latency_ms !== null ? `${m.latency_ms} ms` : '—'}
                        </td>
                        <td className="mono-cell">
                          {m.packet_loss_pct}%
                        </td>
                        <td className="mono-cell">
                          {m.details?.packets_sent || '4'} / {m.details?.packets_received || '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Monitored Services */}
      {activeTab === 'services' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Globe size={18} color="var(--primary)" />
                <span>Configured Application & Port Probes</span>
              </div>
            </div>

            {(!device.services || device.services.length === 0) ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                No services or ports registered for this device yet.
              </div>
            ) : (
              <div className="table-container">
                <table className="noc-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Service Name</th>
                      <th>Protocol / Target</th>
                      <th>Response Time</th>
                      <th>HTTP Code / Info</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {device.services.map((svc) => (
                      <tr key={svc.id}>
                        <td>
                          <StatusBadge status={svc.status} />
                        </td>
                        <td style={{ fontWeight: 600 }}>{svc.name}</td>
                        <td className="mono-cell">
                          {svc.service_type === 'TCP_PORT' ? `TCP :${svc.port}` : svc.url}
                        </td>
                        <td className="mono-cell">
                          {svc.last_response_time_ms !== null ? `${svc.last_response_time_ms} ms` : '—'}
                        </td>
                        <td className="mono-cell">
                          {svc.last_status_code ? `HTTP ${svc.last_status_code}` : svc.last_error || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteService(svc.id)}
                            title="Delete service probe"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Service Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Plus size={18} color="var(--primary)" />
                <span>Add Monitored Service</span>
              </div>
            </div>

            <form onSubmit={handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Probe Type
                </label>
                <select
                  className="input-control"
                  value={newSvcType}
                  onChange={(e) => setNewSvcType(e.target.value)}
                >
                  <option value="TCP_PORT">TCP Port Handshake (SYN/ACK)</option>
                  <option value="HTTP_ENDPOINT">HTTP / HTTPS Health Check</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Service Label
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. HTTPS Web or MySQL"
                  required
                  value={newSvcName}
                  onChange={(e) => setNewSvcName(e.target.value)}
                />
              </div>

              {newSvcType === 'TCP_PORT' ? (
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Port Number
                  </label>
                  <input
                    type="number"
                    className="input-control"
                    min={1}
                    max={65535}
                    value={newSvcPort}
                    onChange={(e) => setNewSvcPort(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Full URL
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="https://192.168.1.1:8443/healthz"
                    value={newSvcUrl}
                    onChange={(e) => setNewSvcUrl(e.target.value)}
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={svcLoading}>
                {svcLoading ? 'Adding...' : 'Add Service'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: SNMP Telemetry */}
      {activeTab === 'snmp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Radio size={18} color="var(--primary)" />
                <span>SNMP MIB-II Real Hardware Telemetry</span>
              </div>
              <span className="mono-cell" style={{ fontSize: '0.8rem' }}>
                Status: {device.snmp_config?.enabled ? 'ENABLED (v2c)' : 'DISABLED'}
              </span>
            </div>

            {!latestSnmp ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {device.snmp_config?.enabled
                  ? 'No SNMP poll records yet. Click "Poll Now" to execute live SNMP walk.'
                  : 'SNMP is currently disabled for this device.'}
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>System Hostname (sysName)</div>
                    <div style={{ fontWeight: 600, marginTop: '4px' }}>{latestSnmp.sys_name || 'N/A'}</div>
                  </div>

                  <div style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>System Uptime (sysUpTime)</div>
                    <div style={{ fontWeight: 600, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                      {latestSnmp.sys_uptime_seconds
                        ? `${Math.floor(latestSnmp.sys_uptime_seconds / 86400)}d ${Math.floor((latestSnmp.sys_uptime_seconds % 86400) / 3600)}h ${Math.floor((latestSnmp.sys_uptime_seconds % 3600) / 60)}m`
                        : 'N/A'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Last Polled</div>
                    <div style={{ fontWeight: 600, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                      {new Date(latestSnmp.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px' }}>System Description (sysDescr)</div>
                  <pre style={{
                    padding: '12px',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {latestSnmp.sys_descr || 'No response or SNMP agent down'}
                  </pre>
                </div>

                {latestSnmp.error_message && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--down-bg)',
                    border: '1px solid var(--down-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--down)',
                    fontSize: '0.82rem'
                  }}>
                    SNMP Error: {latestSnmp.error_message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Multi-Protocol Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Zap size={18} color="var(--primary)" />
                <span>Multi-Protocol Diagnostic Workbench</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRunDiagnostic}
                disabled={diagRunning}
              >
                <Play size={14} fill="currentColor" />
                <span>{diagRunning ? 'Running Multi-Protocol Suite...' : 'Execute Diagnostics Now'}</span>
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Executes live ICMP Ping, DNS resolution, TCP port handshakes, HTTP application tests, and Traceroute. Analyzes all results using rule-based NOC troubleshooting logic to isolate the root cause.
            </p>
          </div>

          {diagRunning && (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <Activity size={32} color="var(--primary)" className="spin-icon" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 600 }}>Executing Multi-Protocol Telemetry Probes...</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                Testing ICMP RTT, DNS queries, TCP handshakes, HTTP responses, and traceroute hops.
              </div>
            </div>
          )}

          {diagResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Assessment Card */}
              <div className="card" style={{
                borderLeft: `4px solid ${
                  diagResult.assessment.overall_status === 'OPERATIONAL'
                    ? 'var(--up)'
                    : diagResult.assessment.overall_status === 'DEGRADED'
                    ? 'var(--degraded)'
                    : 'var(--down)'
                }`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <StatusBadge status={diagResult.assessment.overall_status} />
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Root Cause & NOC Assessment</span>
                </div>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', marginBottom: '16px' }}>
                  {diagResult.assessment.summary_assessment}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Identified Probable Causes
                    </h4>
                    <ul style={{ paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {diagResult.assessment.possible_causes.map((cause, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{cause}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Recommended Engineering Actions
                    </h4>
                    <ul style={{ paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--primary)' }}>
                      {diagResult.assessment.suggested_actions.map((act, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Protocol Telemetry Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Ping & DNS */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title" style={{ fontSize: '0.95rem' }}>
                      ICMP Ping & DNS Resolution
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>ICMP Status:</span>
                      <StatusBadge status={diagResult.ping.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Packet Loss:</span>
                      <span className="mono-cell">{diagResult.ping.packet_loss_pct}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Avg Latency:</span>
                      <span className="mono-cell">{diagResult.ping.avg_latency_ms || '—'} ms</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--text-dim)' }}>DNS Query:</span>
                      <span className="mono-cell">{diagResult.dns.status} ({diagResult.dns.query_time_ms} ms)</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Resolved IPs: </span>
                      <span className="mono-cell">{diagResult.dns.resolved_ips?.join(', ') || 'None'}</span>
                    </div>
                  </div>
                </div>

                {/* TCP & HTTP */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title" style={{ fontSize: '0.95rem' }}>
                      TCP Ports & HTTP Endpoint
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    {diagResult.tcp?.map((t) => (
                      <div key={t.port} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Port {t.port}:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="mono-cell">{t.response_time_ms !== null ? `${t.response_time_ms}ms` : ''}</span>
                          <StatusBadge status={t.status === 'OPEN' ? 'UP' : 'DOWN'} />
                        </div>
                      </div>
                    ))}
                    {diagResult.http && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>HTTP Health:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="mono-cell">HTTP {diagResult.http.status_code || 'N/A'}</span>
                          <StatusBadge status={diagResult.http.status} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Traceroute Output */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title" style={{ fontSize: '0.95rem' }}>
                    Traceroute Hop-by-Hop Path Telemetry
                  </div>
                </div>
                <div className="table-container">
                  <table className="noc-table">
                    <thead>
                      <tr>
                        <th>Hop #</th>
                        <th>Host / Router</th>
                        <th>IP Address</th>
                        <th>RTT 1</th>
                        <th>RTT 2</th>
                        <th>RTT 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagResult.traceroute?.hops?.map((h) => (
                        <tr key={h.hop_number}>
                          <td className="mono-cell" style={{ fontWeight: 600 }}>{h.hop_number}</td>
                          <td>{h.hostname || '—'}</td>
                          <td className="mono-cell">{h.ip_address || '* (Timed out)'}</td>
                          <td className="mono-cell">{h.rtt_ms?.[0] !== undefined ? `${h.rtt_ms[0]}ms` : '*'}</td>
                          <td className="mono-cell">{h.rtt_ms?.[1] !== undefined ? `${h.rtt_ms[1]}ms` : '*'}</td>
                          <td className="mono-cell">{h.rtt_ms?.[2] !== undefined ? `${h.rtt_ms[2]}ms` : '*'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
