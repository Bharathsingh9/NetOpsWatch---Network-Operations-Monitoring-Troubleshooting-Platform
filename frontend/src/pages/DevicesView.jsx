import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Search,
  Filter,
  Play,
  Eye,
  Power,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export function DevicesView({ onSelectDevice, onOpenAddDevice }) {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [pollingId, setPollingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.device_type = typeFilter;
      const res = await api.getDevices(params);
      setDevices(res);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handlePollNow = async (device, e) => {
    e.stopPropagation();
    setPollingId(device.id);
    setActionMessage(`Polling ${device.name}...`);
    try {
      await api.pollDeviceNow(device.id);
      await fetchDevices();
      setActionMessage(`Successfully polled ${device.name}`);
    } catch (err) {
      setActionMessage(`Polling failed: ${err.message}`);
    } finally {
      setPollingId(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleToggleMonitoring = async (device, e) => {
    e.stopPropagation();
    try {
      await api.toggleMonitoring(device.id);
      await fetchDevices();
    } catch (err) {
      alert(`Failed to toggle monitoring: ${err.message}`);
    }
  };

  const handleDeleteDevice = async (device, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${device.name}? This will remove all associated service and metric history.`)) {
      return;
    }
    try {
      await api.deleteDevice(device.id);
      await fetchDevices();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div>
      {actionMessage && (
        <div style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--primary)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.85rem'
        }}>
          <RefreshCw size={15} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flex: 1, minWidth: '260px', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="input-control"
                placeholder="Search device by name, IP, hostname or location..."
                style={{ paddingLeft: '36px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              className="input-control"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="UP">Online (UP)</option>
              <option value="DEGRADED">Degraded</option>
              <option value="DOWN">Unreachable (DOWN)</option>
              <option value="DISABLED">Monitoring Disabled</option>
            </select>

            <select
              className="input-control"
              style={{ width: 'auto' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Device Types</option>
              <option value="ROUTER">Router / Gateway</option>
              <option value="SWITCH">Switch</option>
              <option value="FIREWALL">Firewall</option>
              <option value="SERVER">Server</option>
              <option value="DB_SERVER">Database Server</option>
            </select>

            <button className="btn btn-primary" onClick={onOpenAddDevice}>
              <Plus size={16} />
              <span>Add Device</span>
            </button>
          </div>
        </div>
      </div>

      {/* Devices Inventory Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Server size={18} color="var(--primary)" />
            <span>Monitored Device Inventory ({devices.length})</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Scanning inventory...
          </div>
        ) : devices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No devices found matching current filters.
          </div>
        ) : (
          <div className="table-container">
            <table className="noc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Device Name</th>
                  <th>Type</th>
                  <th>IP / Hostname</th>
                  <th>Location</th>
                  <th>Latency (RTT)</th>
                  <th>Packet Loss</th>
                  <th>Last Inspected</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const isPollingThis = pollingId === device.id;
                  return (
                    <tr
                      key={device.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectDevice(device.id)}
                    >
                      <td>
                        <StatusBadge status={device.status} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{device.name}</div>
                        {device.description && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                            {device.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'rgba(255,255,255,0.06)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {device.device_type}
                        </span>
                      </td>
                      <td className="mono-cell">
                        <div>{device.ip_address}</div>
                        {device.hostname && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                            {device.hostname}
                          </div>
                        )}
                      </td>
                      <td>{device.location || 'N/A'}</td>
                      <td className="mono-cell">
                        {device.current_latency_ms !== null ? (
                          <span style={{ color: device.current_latency_ms > 100 ? 'var(--degraded)' : 'var(--text-main)' }}>
                            {device.current_latency_ms} ms
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="mono-cell">
                        {device.current_packet_loss !== null ? (
                          <span style={{ color: device.current_packet_loss > 0 ? 'var(--down)' : 'var(--text-main)' }}>
                            {device.current_packet_loss}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="mono-cell">
                        {device.last_check_at ? (
                          new Date(device.last_check_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        ) : (
                          'Pending'
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Poll Device On-Demand Now"
                            disabled={isPollingThis}
                            onClick={(e) => handlePollNow(device, e)}
                          >
                            <Play size={13} fill={isPollingThis ? 'none' : 'currentColor'} color="var(--primary)" />
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            title="Inspect Telemetry & Services"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDevice(device.id);
                            }}
                          >
                            <Eye size={13} />
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            title={device.monitoring_enabled ? "Disable Polling" : "Enable Polling"}
                            onClick={(e) => handleToggleMonitoring(device, e)}
                          >
                            <Power size={13} color={device.monitoring_enabled ? 'var(--up)' : 'var(--text-dim)'} />
                          </button>

                          {user?.role === 'ADMIN' && (
                            <button
                              className="btn btn-danger btn-sm"
                              title="Delete Device"
                              onClick={(e) => handleDeleteDevice(device, e)}
                            >
                              <Trash2 size={13} />
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
