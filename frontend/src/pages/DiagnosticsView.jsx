import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Zap,
  Globe,
  Radio,
  Server,
  Terminal,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

export function DiagnosticsView({ initialTarget }) {
  const [targetHost, setTargetHost] = useState(initialTarget || '127.0.0.1');
  const [portsInput, setPortsInput] = useState('80, 443, 22');
  const [httpUrlInput, setHttpUrlInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeQuickTab, setActiveQuickTab] = useState('full'); // full, ping, traceroute, dns, tcp, http

  // Standalone Quick Tools state
  const [quickResult, setQuickResult] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [dnsType, setDnsType] = useState('A');
  const [tcpPort, setTcpPort] = useState(80);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const hist = await api.getDiagnosticHistory(10);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load diagnostic history:', err);
    }
  };

  const handleRunFullDiagnostics = async (e) => {
    if (e) e.preventDefault();
    if (!targetHost) return;
    setIsRunning(true);
    setReport(null);
    try {
      const portList = portsInput
        .split(',')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p));

      const res = await api.runDiagnostics({
        target_host: targetHost,
        ports: portList.length > 0 ? portList : [80, 443, 22],
        http_url: httpUrlInput ? httpUrlInput : null,
      });
      setReport(res);
      await loadHistory();
    } catch (err) {
      alert(`Diagnostic run failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleQuickPing = async () => {
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res = await api.quickPing(targetHost);
      setQuickResult({ type: 'PING', data: res });
    } catch (err) {
      alert(`Ping failed: ${err.message}`);
    } finally {
      setQuickLoading(false);
    }
  };

  const handleQuickTraceroute = async () => {
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res = await api.quickTraceroute(targetHost);
      setQuickResult({ type: 'TRACEROUTE', data: res });
    } catch (err) {
      alert(`Traceroute failed: ${err.message}`);
    } finally {
      setQuickLoading(false);
    }
  };

  const handleQuickDNS = async () => {
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res = await api.quickDNS(targetHost, dnsType);
      setQuickResult({ type: 'DNS', data: res });
    } catch (err) {
      alert(`DNS query failed: ${err.message}`);
    } finally {
      setQuickLoading(false);
    }
  };

  const handleQuickTCP = async () => {
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res = await api.quickTCP(targetHost, tcpPort);
      setQuickResult({ type: 'TCP', data: res });
    } catch (err) {
      alert(`TCP probe failed: ${err.message}`);
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <div>
      {/* Workbench Header & Target Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Activity size={20} color="var(--primary)" />
            <span>Network Troubleshooting & Diagnostic Workbench</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-sm ${activeQuickTab === 'full' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveQuickTab('full')}
            >
              Full Multi-Protocol Suite
            </button>
            <button
              className={`btn btn-sm ${activeQuickTab === 'ping' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveQuickTab('ping')}
            >
              ICMP Ping
            </button>
            <button
              className={`btn btn-sm ${activeQuickTab === 'traceroute' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveQuickTab('traceroute')}
            >
              Traceroute
            </button>
            <button
              className={`btn btn-sm ${activeQuickTab === 'dns' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveQuickTab('dns')}
            >
              DNS Query
            </button>
            <button
              className={`btn btn-sm ${activeQuickTab === 'tcp' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveQuickTab('tcp')}
            >
              TCP Port
            </button>
          </div>
        </div>

        {/* Target Form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Target Host / IP Address
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="e.g. 1.1.1.1, google.com, or internal IP"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
            />
          </div>

          {activeQuickTab === 'full' && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  TCP Ports to Probe
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="80, 443, 22"
                  value={portsInput}
                  onChange={(e) => setPortsInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  HTTP URL (Optional)
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="https://example.com"
                  value={httpUrlInput}
                  onChange={(e) => setHttpUrlInput(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleRunFullDiagnostics}
                disabled={isRunning}
                style={{ height: '42px' }}
              >
                <Play size={15} fill="currentColor" />
                <span>{isRunning ? 'Analyzing...' : 'Run Diagnostics'}</span>
              </button>
            </>
          )}

          {activeQuickTab === 'ping' && (
            <button
              className="btn btn-primary"
              onClick={handleQuickPing}
              disabled={quickLoading}
              style={{ height: '42px' }}
            >
              <Play size={15} fill="currentColor" />
              <span>{quickLoading ? 'Pinging...' : 'Send 4 ICMP Pings'}</span>
            </button>
          )}

          {activeQuickTab === 'traceroute' && (
            <button
              className="btn btn-primary"
              onClick={handleQuickTraceroute}
              disabled={quickLoading}
              style={{ height: '42px' }}
            >
              <Play size={15} fill="currentColor" />
              <span>{quickLoading ? 'Tracing...' : 'Run Traceroute'}</span>
            </button>
          )}

          {activeQuickTab === 'dns' && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Record Type
                </label>
                <select
                  className="input-control"
                  value={dnsType}
                  onChange={(e) => setDnsType(e.target.value)}
                >
                  <option value="A">A (IPv4)</option>
                  <option value="AAAA">AAAA (IPv6)</option>
                  <option value="MX">MX (Mail)</option>
                  <option value="TXT">TXT (Text/SPF)</option>
                  <option value="NS">NS (Name Server)</option>
                  <option value="CNAME">CNAME (Alias)</option>
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleQuickDNS}
                disabled={quickLoading}
                style={{ height: '42px' }}
              >
                <Play size={15} fill="currentColor" />
                <span>{quickLoading ? 'Querying...' : 'Resolve DNS'}</span>
              </button>
            </>
          )}

          {activeQuickTab === 'tcp' && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Port Number
                </label>
                <input
                  type="number"
                  className="input-control"
                  value={tcpPort}
                  onChange={(e) => setTcpPort(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleQuickTCP}
                disabled={quickLoading}
                style={{ height: '42px' }}
              >
                <Play size={15} fill="currentColor" />
                <span>{quickLoading ? 'Testing...' : 'Probe TCP Port'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Standalone Quick Tool Result */}
      {quickResult && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">
              <Terminal size={18} color="var(--primary)" />
              <span>{quickResult.type} Telemetry Output for {targetHost}</span>
            </div>
          </div>
          <pre style={{
            background: 'var(--bg-canvas)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-main)',
            overflowX: 'auto',
            maxHeight: '320px'
          }}>
            {JSON.stringify(quickResult.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Full Multi-Protocol Diagnostic Suite Report */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
          {/* Assessment Overview */}
          <div className="card" style={{
            borderLeft: `5px solid ${
              report.assessment.overall_status === 'OPERATIONAL'
                ? 'var(--up)'
                : report.assessment.overall_status === 'DEGRADED'
                ? 'var(--degraded)'
                : 'var(--down)'
            }`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <StatusBadge status={report.assessment.overall_status} />
                <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  Diagnostic Technical Assessment
                </span>
              </div>
              <span className="mono-cell" style={{ fontSize: '0.8rem' }}>
                Target: {report.target}
              </span>
            </div>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '20px', lineHeight: 1.6 }}>
              {report.assessment.summary_assessment}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Identified Probable Root Causes
                </h4>
                <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {report.assessment.possible_causes.map((c, i) => (
                    <li key={i} style={{ marginBottom: '6px' }}>{c}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Recommended Engineering Remediation
                </h4>
                <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--primary)' }}>
                  {report.assessment.suggested_actions.map((a, i) => (
                    <li key={i} style={{ marginBottom: '6px' }}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Protocols Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px' }}>
            {/* Ping Card */}
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600 }}>ICMP Reachability</span>
                <StatusBadge status={report.ping.status} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Avg Latency:</span>
                  <span className="mono-cell">{report.ping.avg_latency_ms !== null ? `${report.ping.avg_latency_ms} ms` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Packet Loss:</span>
                  <span className="mono-cell">{report.ping.packet_loss_pct}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Packets Sent/Recv:</span>
                  <span className="mono-cell">{report.ping.packets_sent} / {report.ping.packets_received}</span>
                </div>
              </div>
            </div>

            {/* DNS Card */}
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600 }}>DNS Resolution</span>
                <StatusBadge status={report.dns.status} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Response Time:</span>
                  <span className="mono-cell">{report.dns.query_time_ms} ms</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Resolved IPs:</span>
                  <div className="mono-cell" style={{ marginTop: '2px', wordBreak: 'break-all' }}>
                    {report.dns.resolved_ips?.join(', ') || report.dns.error_message || 'None'}
                  </div>
                </div>
              </div>
            </div>

            {/* TCP Card */}
            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600 }}>TCP Port Probes</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                {report.tcp?.map((t) => (
                  <div key={t.port} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="mono-cell">Port {t.port}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="mono-cell" style={{ fontSize: '0.78rem' }}>{t.response_time_ms ? `${t.response_time_ms}ms` : ''}</span>
                      <StatusBadge status={t.status === 'OPEN' ? 'UP' : 'DOWN'} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Traceroute Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '0.95rem' }}>
                Hop-by-Hop Path Telemetry (Traceroute)
              </div>
              <span className="mono-cell" style={{ fontSize: '0.78rem' }}>
                {report.traceroute?.hops?.length || 0} Hops Recorded
              </span>
            </div>

            <div className="table-container">
              <table className="noc-table">
                <thead>
                  <tr>
                    <th>Hop</th>
                    <th>Hostname</th>
                    <th>IP Address</th>
                    <th>RTT Probe 1</th>
                    <th>RTT Probe 2</th>
                    <th>RTT Probe 3</th>
                  </tr>
                </thead>
                <tbody>
                  {report.traceroute?.hops?.map((h) => (
                    <tr key={h.hop_number}>
                      <td className="mono-cell" style={{ fontWeight: 600 }}>{h.hop_number}</td>
                      <td>{h.hostname || '—'}</td>
                      <td className="mono-cell">{h.ip_address || '* (No response)'}</td>
                      <td className="mono-cell">{h.rtt_ms?.[0] !== undefined ? `${h.rtt_ms[0]} ms` : '*'}</td>
                      <td className="mono-cell">{h.rtt_ms?.[1] !== undefined ? `${h.rtt_ms[1]} ms` : '*'}</td>
                      <td className="mono-cell">{h.rtt_ms?.[2] !== undefined ? `${h.rtt_ms[2]} ms` : '*'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent Diagnostic History */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Clock size={18} color="var(--primary)" />
            <span>Recent Diagnostic Runs History</span>
          </div>
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
            No diagnostic history recorded yet.
          </div>
        ) : (
          <div className="table-container">
            <table className="noc-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Target Host</th>
                  <th>Outcome Status</th>
                  <th>Assessment Summary</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono-cell">
                      {new Date(h.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="mono-cell" style={{ fontWeight: 600 }}>{h.target_host}</td>
                    <td><StatusBadge status={h.overall_status} /></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{h.summary_assessment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
