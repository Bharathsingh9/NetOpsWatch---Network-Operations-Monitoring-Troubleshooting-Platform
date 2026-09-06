import React, { useState } from 'react';
import { X, Server, Plus, Check } from 'lucide-react';
import { api } from '../services/api';

export function AddDeviceModal({ isOpen, onClose, onDeviceAdded }) {
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [deviceType, setDeviceType] = useState('SERVER');
  const [location, setLocation] = useState('Primary Datacenter');
  const [checkInterval, setCheckInterval] = useState(30);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);

  // Initial Service
  const [addService, setAddService] = useState(true);
  const [serviceType, setServiceType] = useState('TCP_PORT');
  const [serviceName, setServiceName] = useState('SSH Management');
  const [servicePort, setServicePort] = useState(22);
  const [serviceUrl, setServiceUrl] = useState('');

  // SNMP
  const [enableSnmp, setEnableSnmp] = useState(false);
  const [snmpCommunity, setSnmpCommunity] = useState('public');
  const [snmpPort, setSnmpPort] = useState(161);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name,
        hostname: hostname || null,
        ip_address: ipAddress,
        device_type: deviceType,
        location,
        check_interval: Number(checkInterval),
        monitoring_enabled: monitoringEnabled,
      };

      if (addService) {
        payload.services = [
          {
            service_type: serviceType,
            name: serviceName,
            port: serviceType === 'TCP_PORT' ? Number(servicePort) : null,
            url: serviceType === 'HTTP_ENDPOINT' ? serviceUrl : null,
            is_monitored: true,
          },
        ];
      }

      if (enableSnmp) {
        payload.snmp_config = {
          enabled: true,
          version: '2c',
          community: snmpCommunity,
          port: Number(snmpPort),
          timeout_seconds: 2.0,
          retries: 1,
        };
      }

      const created = await api.createDevice(payload);
      onDeviceAdded(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Register Network Device</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: 'var(--down-bg)',
            border: '1px solid var(--down-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--down)',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Device Name *
              </label>
              <input
                className="input-control"
                type="text"
                placeholder="e.g. Core-SW-01"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Device Type *
              </label>
              <select
                className="input-control"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
              >
                <option value="ROUTER">Router / Gateway</option>
                <option value="SWITCH">Managed Switch</option>
                <option value="FIREWALL">Firewall Appliance</option>
                <option value="SERVER">Application Server</option>
                <option value="DB_SERVER">Database Server</option>
                <option value="WORKSTATION">Workstation</option>
                <option value="OTHER">Other Network Node</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                IP Address *
              </label>
              <input
                className="input-control"
                type="text"
                placeholder="e.g. 192.168.1.1 or 8.8.8.8"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Hostname / FQDN (Optional)
              </label>
              <input
                className="input-control"
                type="text"
                placeholder="e.g. router1.corp.internal"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Location / Rack
              </label>
              <input
                className="input-control"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Check Interval (seconds)
              </label>
              <input
                className="input-control"
                type="number"
                min={10}
                max={300}
                value={checkInterval}
                onChange={(e) => setCheckInterval(e.target.value)}
              />
            </div>
          </div>

          {/* Initial Monitored Service Section */}
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={addService}
                onChange={(e) => setAddService(e.target.checked)}
              />
              <span>Attach Initial Service Check (TCP/HTTP)</span>
            </label>

            {addService && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Service Protocol</label>
                  <select
                    className="input-control"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="TCP_PORT">TCP Port Handshake</option>
                    <option value="HTTP_ENDPOINT">HTTP/HTTPS Healthcheck</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Service Name</label>
                  <input
                    className="input-control"
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                {serviceType === 'TCP_PORT' ? (
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>TCP Port</label>
                    <input
                      className="input-control"
                      type="number"
                      value={servicePort}
                      onChange={(e) => setServicePort(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                ) : (
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Full URL</label>
                    <input
                      className="input-control"
                      type="text"
                      placeholder="https://example.com/health"
                      value={serviceUrl}
                      onChange={(e) => setServiceUrl(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SNMP Section */}
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={enableSnmp}
                onChange={(e) => setEnableSnmp(e.target.checked)}
              />
              <span>Enable SNMP v2c Telemetry Polling</span>
            </label>

            {enableSnmp && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Community String</label>
                  <input
                    className="input-control"
                    type="text"
                    value={snmpCommunity}
                    onChange={(e) => setSnmpCommunity(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>SNMP UDP Port</label>
                  <input
                    className="input-control"
                    type="number"
                    value={snmpPort}
                    onChange={(e) => setSnmpPort(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
