import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  ShieldAlert,
  Zap,
  Activity,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge, SeverityBadge } from '../components/StatusBadge';

export function DashboardView({ onSelectDevice, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const summary = await api.getDashboardSummary();
      setData(summary);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading NOC live telemetry...
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const recentAlerts = data?.recent_alerts || [];
  const recentIncidents = data?.recent_incidents || [];
  const latencyTrend = data?.latency_trend || [];

  return (
    <div>
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--down-bg)',
          border: '1px solid var(--down-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--down)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--primary)' }}>
            <Server size={24} />
          </div>
          <div>
            <div className="kpi-label">Total Devices</div>
            <div className="kpi-value">{kpis.total_devices || 0}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'var(--up-bg)', color: 'var(--up)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="kpi-label">Healthy / UP</div>
            <div className="kpi-value" style={{ color: 'var(--up)' }}>{kpis.devices_up || 0}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'var(--degraded-bg)', color: 'var(--degraded)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="kpi-label">Degraded</div>
            <div className="kpi-value" style={{ color: 'var(--degraded)' }}>{kpis.devices_degraded || 0}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'var(--down-bg)', color: 'var(--down)' }}>
            <XCircle size={24} />
          </div>
          <div>
            <div className="kpi-label">Unreachable / DOWN</div>
            <div className="kpi-value" style={{ color: 'var(--down)' }}>{kpis.devices_down || 0}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <Bell size={24} />
          </div>
          <div>
            <div className="kpi-label">Active Alerts</div>
            <div className="kpi-value" style={{ color: kpis.active_alerts > 0 ? '#ef4444' : 'var(--text-main)' }}>
              {kpis.active_alerts || 0}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a855f7' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="kpi-label">Open Incidents</div>
            <div className="kpi-value" style={{ color: '#a855f7' }}>{kpis.open_incidents || 0}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--primary)' }}>
            <Activity size={24} />
          </div>
          <div>
            <div className="kpi-label">Avg RTT Latency</div>
            <div className="kpi-value">{kpis.average_latency_ms || 0} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span></div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--degraded)' }}>
            <Zap size={24} />
          </div>
          <div>
            <div className="kpi-label">Avg Packet Loss</div>
            <div className="kpi-value">{kpis.average_packet_loss_pct || 0} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>%</span></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Latency Chart & Live Streams */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Latency History */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} color="var(--primary)" />
              <span>Real-Time ICMP Latency Sparkline</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Last 20 Probe Cycles
            </span>
          </div>

          <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '16px 8px 8px' }}>
            {latencyTrend.length === 0 ? (
              <div style={{ margin: 'auto', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Polling telemetry in progress...
              </div>
            ) : (
              latencyTrend.map((m, idx) => {
                const heightPct = Math.min(Math.max((m.latency_ms || 2) * 1.5, 8), 100);
                const isLoss = m.packet_loss_pct > 0;
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative'
                    }}
                    title={`Time: ${new Date(m.timestamp).toLocaleTimeString()} | RTT: ${m.latency_ms}ms | Loss: ${m.packet_loss_pct}%`}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        backgroundColor: isLoss ? 'var(--degraded)' : 'var(--primary)',
                        borderRadius: '4px 4px 0 0',
                        opacity: 0.85,
                        transition: 'height 0.3s ease'
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px 0', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span>Earlier Checks</span>
            <div style={{ display: 'flex', gap: '14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--primary)', borderRadius: '2px' }} />
                RTT (ms)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--degraded)', borderRadius: '2px' }} />
                Packet Loss Detected
              </span>
            </div>
            <span>Latest Probes</span>
          </div>
        </div>

        {/* Live Active Alerts */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Bell size={18} color="#ef4444" />
              <span>Active Alert Feed</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('alerts')}
            >
              <span>View All</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          {recentAlerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
              <CheckCircle2 size={32} color="var(--up)" style={{ margin: '0 auto 8px', opacity: 0.7 }} />
              <div>All monitored devices and ports operational.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentAlerts.map((alt) => (
                <div
                  key={alt.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <SeverityBadge severity={alt.severity} />
                      <strong style={{ fontSize: '0.85rem' }}>{alt.device_name}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alt.message}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                    {new Date(alt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Incidents Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={18} color="#a855f7" />
            <span>Active Incident Escalation Desk</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('incidents')}
          >
            <span>Open Incident Desk</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {recentIncidents.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            No open or investigating incidents.
          </div>
        ) : (
          <div className="table-container">
            <table className="noc-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title</th>
                  <th>Affected Device</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Reported At</th>
                </tr>
              </thead>
              <tbody>
                {recentIncidents.map((inc) => (
                  <tr key={inc.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('incidents')}>
                    <td className="mono-cell" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {inc.incident_number}
                    </td>
                    <td style={{ fontWeight: 500 }}>{inc.title}</td>
                    <td>{inc.device_name}</td>
                    <td><SeverityBadge severity={inc.severity} /></td>
                    <td><StatusBadge status={inc.status} /></td>
                    <td className="mono-cell">
                      {new Date(inc.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
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
