import React, { useState, useEffect } from 'react';
import {
  Network,
  Server,
  Cloud,
  ArrowRight,
  Activity,
  AlertTriangle,
  Zap,
  Radio,
  Eye
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

export function TopologyView({ onSelectDevice }) {
  const [topology, setTopology] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    fetchTopology();
  }, []);

  const fetchTopology = async () => {
    try {
      const data = await api.getTopology();
      setTopology(data);
      if (data.nodes.length > 0 && !selectedNode) {
        setSelectedNode(data.nodes[1] || data.nodes[0]);
      }
    } catch (err) {
      console.error('Failed to load network topology:', err);
    } finally {
      setLoading(false);
    }
  };

  // Layout node positions hierarchically
  const nodes = topology.nodes || [];
  const links = topology.links || [];

  // Group nodes by tier
  const wanNodes = nodes.filter((n) => n.device_type === 'CLOUD');
  const routerNodes = nodes.filter((n) => n.device_type === 'ROUTER' || n.device_type === 'FIREWALL');
  const switchNodes = nodes.filter((n) => n.device_type === 'SWITCH');
  const endpointNodes = nodes.filter((n) => !['CLOUD', 'ROUTER', 'FIREWALL', 'SWITCH'].includes(n.device_type));

  const width = 860;
  const height = 480;

  // Compute node coords
  const nodePositions = {};

  // Tier 1: WAN (y = 50)
  wanNodes.forEach((n, i) => {
    nodePositions[n.id] = { x: width / 2, y: 50, node: n };
  });

  // Tier 2: Routers & Firewalls (y = 150)
  const rStep = width / (routerNodes.length + 1);
  routerNodes.forEach((n, i) => {
    nodePositions[n.id] = { x: rStep * (i + 1), y: 150, node: n };
  });

  // Tier 3: Switches (y = 270)
  const sStep = width / (switchNodes.length + 1 || 1);
  switchNodes.forEach((n, i) => {
    nodePositions[n.id] = { x: sStep * (i + 1), y: 270, node: n };
  });

  // Tier 4: Endpoints (Servers/DBs) (y = 390)
  const eStep = width / (endpointNodes.length + 1 || 1);
  endpointNodes.forEach((n, i) => {
    nodePositions[n.id] = { x: eStep * (i + 1), y: 390, node: n };
  });

  const getNodeColor = (status) => {
    if (status === 'UP') return '#10b981';
    if (status === 'DEGRADED') return '#f59e0b';
    if (status === 'DOWN') return '#ef4444';
    return '#64748b';
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* SVG Topology Canvas */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">
              <Network size={20} color="var(--primary)" />
              <span>Hierarchical Network Topology & Telemetry Mesh</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Interactive Topology Map
            </span>
          </div>

          <div className="topology-container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <div style={{ color: 'var(--text-muted)' }}>Mapping network links...</div>
            ) : (
              <svg
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: '100%', maxHeight: '520px' }}
              >
                <defs>
                  {/* Glowing Filter */}
                  <filter id="glow-up" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glow-down" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Connection Links */}
                {links.map((link, idx) => {
                  const src = nodePositions[link.source];
                  const tgt = nodePositions[link.target];
                  if (!src || !tgt) return null;
                  const isDegraded = link.status === 'DEGRADED';
                  const isDown = link.status === 'DOWN';
                  const strokeColor = isDown ? '#ef4444' : isDegraded ? '#f59e0b' : 'rgba(6, 182, 212, 0.4)';

                  return (
                    <g key={idx}>
                      <line
                        x1={src.x}
                        y1={src.y}
                        x2={tgt.x}
                        y2={tgt.y}
                        stroke={strokeColor}
                        strokeWidth={isDown ? 3 : 2}
                        strokeDasharray={isDown ? '6 4' : 'none'}
                        opacity={isDown ? 0.9 : 0.6}
                      />
                    </g>
                  );
                })}

                {/* Nodes */}
                {Object.entries(nodePositions).map(([id, pos]) => {
                  const n = pos.node;
                  const isSelected = selectedNode?.id === n.id;
                  const color = getNodeColor(n.status);
                  const isCloud = n.device_type === 'CLOUD';

                  return (
                    <g
                      key={id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => setSelectedNode(n)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Selection Ring */}
                      {isSelected && (
                        <circle
                          r={28}
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          opacity={0.9}
                        />
                      )}

                      {/* Main Node Shape */}
                      <circle
                        r={isCloud ? 24 : 20}
                        fill="#0e1726"
                        stroke={color}
                        strokeWidth={isCloud ? 3 : 2.5}
                        filter={n.status === 'DOWN' ? 'url(#glow-down)' : 'url(#glow-up)'}
                      />

                      {/* Icon */}
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#fff"
                        fontSize={11}
                        fontWeight={600}
                        fontFamily="var(--font-mono)"
                      >
                        {isCloud ? 'WAN' : n.device_type.slice(0, 2)}
                      </text>

                      {/* Label */}
                      <text
                        y={32}
                        textAnchor="middle"
                        fill="var(--text-main)"
                        fontSize={11}
                        fontWeight={600}
                        fontFamily="var(--font-sans)"
                      >
                        {n.name}
                      </text>

                      <text
                        y={46}
                        textAnchor="middle"
                        fill="var(--text-dim)"
                        fontSize={9.5}
                        fontFamily="var(--font-mono)"
                      >
                        {n.ip}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Selected Node Inspector Sidepanel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Eye size={18} color="var(--primary)" />
              <span>Node Inspector</span>
            </div>
          </div>

          {!selectedNode ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
              Click any device in the topology map to inspect its real-time telemetry.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedNode.name}</h3>
                  <StatusBadge status={selectedNode.status} />
                </div>
                <div className="mono-cell" style={{ fontSize: '0.82rem' }}>
                  {selectedNode.ip}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Device Type:</span>
                  <strong>{selectedNode.device_type}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Latency (RTT):</span>
                  <span className="mono-cell">
                    {selectedNode.latency_ms !== null ? `${selectedNode.latency_ms} ms` : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Packet Loss:</span>
                  <span className="mono-cell">
                    {selectedNode.packet_loss_pct !== null ? `${selectedNode.packet_loss_pct}%` : '0%'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Active Alerts:</span>
                  <span style={{ color: selectedNode.active_alerts > 0 ? '#ef4444' : 'var(--text-main)', fontWeight: 600 }}>
                    {selectedNode.active_alerts || 0}
                  </span>
                </div>
              </div>

              {selectedNode.device_id && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}
                  onClick={() => onSelectDevice(selectedNode.device_id)}
                >
                  <span>Open Full Device Telemetry</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
