const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('netopswatch_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('netopswatch_token');
    localStorage.removeItem('netopswatch_user');
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Session expired or unauthorized');
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.detail || (typeof data === 'string' ? data : 'API Request Failed');
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: (username, password) =>
    request('/auth/login-json', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => request('/auth/me'),

  // Dashboard & Monitoring
  getDashboardSummary: () => request('/monitoring/dashboard-summary'),
  getDeviceMetrics: (deviceId, hours = 24) =>
    request(`/monitoring/device/${deviceId}/metrics?hours=${hours}`),
  getDeviceSNMPMetrics: (deviceId, limit = 30) =>
    request(`/monitoring/device/${deviceId}/snmp-metrics?limit=${limit}`),

  // Devices
  getDevices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/devices${query ? `?${query}` : ''}`);
  },
  getDevice: (id) => request(`/devices/${id}`),
  createDevice: (data) =>
    request('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDevice: (id, data) =>
    request(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDevice: (id) =>
    request(`/devices/${id}`, {
      method: 'DELETE',
    }),
  toggleMonitoring: (id) =>
    request(`/devices/${id}/toggle-monitoring`, {
      method: 'POST',
    }),
  pollDeviceNow: (id) =>
    request(`/devices/${id}/poll-now`, {
      method: 'POST',
    }),
  addDeviceService: (deviceId, serviceData) =>
    request(`/devices/${deviceId}/services`, {
      method: 'POST',
      body: JSON.stringify(serviceData),
    }),
  deleteDeviceService: (deviceId, serviceId) =>
    request(`/devices/${deviceId}/services/${serviceId}`, {
      method: 'DELETE',
    }),
  updateSNMPConfig: (deviceId, snmpData) =>
    request(`/devices/${deviceId}/snmp`, {
      method: 'PUT',
      body: JSON.stringify(snmpData),
    }),

  // Diagnostics
  runDiagnostics: (payload) =>
    request('/diagnostics/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  quickPing: (target, count = 4) =>
    request('/diagnostics/ping', {
      method: 'POST',
      body: JSON.stringify({ target, count }),
    }),
  quickTraceroute: (target, max_hops = 15) =>
    request('/diagnostics/traceroute', {
      method: 'POST',
      body: JSON.stringify({ target, max_hops }),
    }),
  quickDNS: (hostname, record_type = 'A') =>
    request('/diagnostics/dns', {
      method: 'POST',
      body: JSON.stringify({ hostname, record_type }),
    }),
  quickTCP: (host, port) =>
    request('/diagnostics/tcp', {
      method: 'POST',
      body: JSON.stringify({ host, port: Number(port) }),
    }),
  quickHTTP: (url) =>
    request('/diagnostics/http', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  getDiagnosticHistory: (limit = 20) =>
    request(`/diagnostics/history?limit=${limit}`),

  // Alerts
  getAlerts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/alerts${query ? `?${query}` : ''}`);
  },
  acknowledgeAlert: (id) =>
    request(`/alerts/${id}/acknowledge`, {
      method: 'POST',
    }),
  resolveAlert: (id) =>
    request(`/alerts/${id}/resolve`, {
      method: 'POST',
    }),

  // Incidents
  getIncidents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/incidents${query ? `?${query}` : ''}`);
  },
  getIncident: (id) => request(`/incidents/${id}`),
  createIncident: (data) =>
    request('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateIncident: (id, data) =>
    request(`/incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  addIncidentNote: (id, note) =>
    request(`/incidents/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  // Topology
  getTopology: () => request('/topology'),

  // Audit Logs
  getAuditLogs: (limit = 50, skip = 0) =>
    request(`/audit?limit=${limit}&skip=${skip}`),
};
