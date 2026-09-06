import React from 'react';
import {
  LayoutDashboard,
  Server,
  Activity,
  Network,
  Bell,
  FileText,
  ShieldAlert,
  LogOut,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ currentView, setCurrentView }) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'devices', label: 'Devices Inventory', icon: Server },
    { id: 'diagnostics', label: 'Diagnostics Engine', icon: Activity },
    { id: 'topology', label: 'Network Topology', icon: Network },
    { id: 'alerts', label: 'Alert Center', icon: Bell },
    { id: 'incidents', label: 'Incident Desk', icon: ShieldAlert },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge">
          <Radio size={22} />
        </div>
        <div>
          <div className="brand-title">NetOpsWatch</div>
          <div className="brand-subtitle">NOC Platform</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setCurrentView(item.id)}
            >
              <Icon size={18} />
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {user?.username?.slice(0, 2).toUpperCase() || 'OP'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.username || 'Operator'}</div>
            <div className="user-role">{user?.role || 'OPERATOR'}</div>
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={logout}
          title="Sign out"
          style={{ padding: '6px' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
