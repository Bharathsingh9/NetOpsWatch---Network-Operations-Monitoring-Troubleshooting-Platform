import React from 'react';

export function StatusBadge({ status }) {
  const normalized = (status || 'UNKNOWN').toUpperCase();
  
  let badgeClass = 'badge-unknown';
  let label = normalized;

  if (normalized === 'UP' || normalized === 'PASS' || normalized === 'HEALTHY' || normalized === 'RESOLVED') {
    badgeClass = 'badge-up';
  } else if (normalized === 'DEGRADED' || normalized === 'WARNING' || normalized === 'INVESTIGATING') {
    badgeClass = 'badge-degraded';
  } else if (normalized === 'DOWN' || normalized === 'CRITICAL' || normalized === 'FAIL' || normalized === 'FAILED') {
    badgeClass = 'badge-down';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const normalized = (severity || 'INFO').toUpperCase();
  let badgeClass = 'badge-info';

  if (normalized === 'CRITICAL') {
    badgeClass = 'badge-critical';
  } else if (normalized === 'WARNING' || normalized === 'HIGH' || normalized === 'MEDIUM') {
    badgeClass = 'badge-warning';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      {normalized}
    </span>
  );
}
