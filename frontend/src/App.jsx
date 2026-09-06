import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { AddDeviceModal } from './components/AddDeviceModal';

// Views
import { LoginView } from './pages/LoginView';
import { DashboardView } from './pages/DashboardView';
import { DevicesView } from './pages/DevicesView';
import { DeviceDetailView } from './pages/DeviceDetailView';
import { DiagnosticsView } from './pages/DiagnosticsView';
import { TopologyView } from './pages/TopologyView';
import { AlertsView } from './pages/AlertsView';
import { IncidentsView } from './pages/IncidentsView';
import { AuditLogsView } from './pages/AuditLogsView';

function AuthenticatedApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [diagnosticTarget, setDiagnosticTarget] = useState(null);

  // Refresh Management
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // 30s default

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Auto Refresh Interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  const handleSelectDevice = (id) => {
    setSelectedDeviceId(id);
    setCurrentView('device-detail');
  };

  const handleOpenDiagnosticForDevice = (ip) => {
    setDiagnosticTarget(ip);
    setCurrentView('diagnostics');
  };

  const getPageMeta = () => {
    switch (currentView) {
      case 'dashboard':
        return { title: 'Network Operations Dashboard', subtitle: 'Live telemetry, anomaly alerts, and incident queue' };
      case 'devices':
        return { title: 'Device Inventory & Health', subtitle: 'Routers, switches, servers, and multi-protocol monitors' };
      case 'device-detail':
        return { title: 'Device Telemetry & Diagnostics', subtitle: `Inspecting node #${selectedDeviceId}` };
      case 'diagnostics':
        return { title: 'Multi-Protocol Diagnostic Workbench', subtitle: 'Rule-based root cause analysis & probe execution' };
      case 'topology':
        return { title: 'Network Topology & Mesh Status', subtitle: 'Interactive node graph with live reachability states' };
      case 'alerts':
        return { title: 'Real-Time Alert Feed', subtitle: 'Threshold breaches, packet loss warnings, and outages' };
      case 'incidents':
        return { title: 'NOC Incident Response Desk', subtitle: 'Escalation lifecycle, triaging notes, and resolution' };
      case 'audit':
        return { title: 'Operations Audit Log', subtitle: 'Security and operator activity audit trail' };
      default:
        return { title: 'NetOpsWatch Operations', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageMeta();

  return (
    <div className="app-container">
      <Sidebar
        currentView={currentView === 'device-detail' ? 'devices' : currentView}
        setCurrentView={(view) => {
          setSelectedDeviceId(null);
          setCurrentView(view);
        }}
      />

      <div className="main-wrapper">
        <Topbar
          title={title}
          subtitle={subtitle}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          autoRefreshInterval={autoRefreshInterval}
          setAutoRefreshInterval={setAutoRefreshInterval}
          onOpenAddDevice={() => setIsAddDeviceOpen(true)}
          onQuickDiagnostic={() => setCurrentView('diagnostics')}
        />

        <main className="content-body" key={refreshKey}>
          {currentView === 'dashboard' && (
            <DashboardView
              onSelectDevice={handleSelectDevice}
              onNavigate={(view) => setCurrentView(view)}
            />
          )}

          {currentView === 'devices' && (
            <DevicesView
              onSelectDevice={handleSelectDevice}
              onOpenAddDevice={() => setIsAddDeviceOpen(true)}
            />
          )}

          {currentView === 'device-detail' && (
            <DeviceDetailView
              deviceId={selectedDeviceId}
              onBack={() => setCurrentView('devices')}
              onRunDiagnostic={handleOpenDiagnosticForDevice}
            />
          )}

          {currentView === 'diagnostics' && (
            <DiagnosticsView initialTarget={diagnosticTarget} />
          )}

          {currentView === 'topology' && (
            <TopologyView onSelectDevice={handleSelectDevice} />
          )}

          {currentView === 'alerts' && (
            <AlertsView onSelectDevice={handleSelectDevice} />
          )}

          {currentView === 'incidents' && (
            <IncidentsView onSelectDevice={handleSelectDevice} />
          )}

          {currentView === 'audit' && (
            <AuditLogsView />
          )}
        </main>
      </div>

      <AddDeviceModal
        isOpen={isAddDeviceOpen}
        onClose={() => setIsAddDeviceOpen(false)}
        onDeviceAdded={() => {
          setRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}

function AppRoot() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
        color: 'var(--text-muted)'
      }}>
        Initializing NetOpsWatch console...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <AuthenticatedApp />;
}
