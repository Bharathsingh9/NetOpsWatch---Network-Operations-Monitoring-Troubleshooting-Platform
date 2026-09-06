import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Filter,
  RefreshCw,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge, SeverityBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export function AlertsView({ onSelectDevice }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const fetchAlerts = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;
      const res = await api.getAlerts(params);
      setAlerts(res);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      await fetchAlerts();
    } catch (err) {
      alert(`Acknowledgement failed: ${err.message}`);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await api.resolveAlert(alertId);
      await fetchAlerts();
    } catch (err) {
      alert(`Resolution failed: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Filter size={16} color="var(--text-dim)" />
            <select
              className="input-control"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Alert Statuses</option>
              <option value="OPEN">Open Only</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved History</option>
            </select>

            <select
              className="input-control"
              style={{ width: 'auto' }}
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={fetchAlerts}>
            <RefreshCw size={14} />
            <span>Refresh Alerts</span>
          </button>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Bell size={18} color="#ef4444" />
            <span>Operational Alert Stream ({alerts.length})</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading alert feeds...
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No alerts matching current filters. All systems are operating within thresholds.
          </div>
        ) : (
          <div className="table-container">
            <table className="noc-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Device</th>
                  <th>Alert Type</th>
                  <th>Message / Threshold Details</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alt) => {
                  const isOpen = alt.status === 'OPEN';
                  const isAck = alt.status === 'ACKNOWLEDGED';

                  return (
                    <tr key={alt.id}>
                      <td><SeverityBadge severity={alt.severity} /></td>
                      <td><StatusBadge status={alt.status} /></td>
                      <td>
                        <strong
                          style={{ cursor: 'pointer', color: 'var(--primary)' }}
                          onClick={() => onSelectDevice(alt.device_id)}
                        >
                          {alt.device_name || `#${alt.device_id}`}
                        </strong>
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)'
                        }}>
                          {alt.alert_type}
                        </span>
                      </td>
                      <td>
                        <div>{alt.message}</div>
                        {(alt.current_value || alt.threshold_value) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                            Value: <span style={{ color: 'var(--text-main)' }}>{alt.current_value}</span> | Threshold: {alt.threshold_value}
                          </div>
                        )}
                        {alt.acknowledged_by && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                            Ack by {alt.acknowledged_by} at {new Date(alt.acknowledged_at).toLocaleTimeString()}
                          </div>
                        )}
                      </td>
                      <td className="mono-cell">
                        {new Date(alt.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {isOpen && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleAcknowledge(alt.id)}
                              title="Acknowledge Alert"
                            >
                              <Check size={13} />
                              <span>Ack</span>
                            </button>
                          )}
                          {(isOpen || isAck) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleResolve(alt.id)}
                              title="Manually Resolve Alert"
                              style={{ color: 'var(--up)' }}
                            >
                              <CheckCheck size={13} />
                              <span>Resolve</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
