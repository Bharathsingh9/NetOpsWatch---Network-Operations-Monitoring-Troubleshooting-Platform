import React from 'react';
import { RefreshCw, Clock, Plus, Zap } from 'lucide-react';

export function Topbar({
  title,
  subtitle,
  onRefresh,
  isRefreshing,
  autoRefreshInterval,
  setAutoRefreshInterval,
  onOpenAddDevice,
  onQuickDiagnostic
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div>
          <h1 className="page-heading">{title}</h1>
          {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{subtitle}</p>}
        </div>
      </div>

      <div className="topbar-right">
        <div className="pulse-indicator">
          <span className="pulse-dot" />
          <span>ENGINE ARMED</span>
        </div>

        {/* Auto Refresh Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Clock size={15} />
          <select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value={0}>Auto: Off</option>
            <option value={10}>Auto: 10s</option>
            <option value={30}>Auto: 30s</option>
            <option value={60}>Auto: 60s</option>
          </select>
        </div>

        {/* Manual Refresh Button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh view data"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
          <span>Refresh</span>
        </button>

        {onQuickDiagnostic && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onQuickDiagnostic}
            style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: 'var(--primary)' }}
          >
            <Zap size={14} />
            <span>Diagnostics</span>
          </button>
        )}

        {onOpenAddDevice && (
          <button className="btn btn-primary btn-sm" onClick={onOpenAddDevice}>
            <Plus size={15} />
            <span>Add Device</span>
          </button>
        )}
      </div>

      <style>{`
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
}
