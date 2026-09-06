import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  Filter,
  MessageSquare,
  CheckCircle2,
  Clock,
  User,
  X,
  Send,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge, SeverityBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export function IncidentsView({ onSelectDevice }) {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // Selected Incident for Detail/Triage Modal
  const [selectedInc, setSelectedInc] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [resolutionText, setResolutionText] = useState('');

  // New Incident Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createSeverity, setCreateSeverity] = useState('MEDIUM');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchIncidents = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;
      const res = await api.getIncidents(params);
      setIncidents(res);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleOpenIncident = async (incId) => {
    try {
      const inc = await api.getIncident(incId);
      setSelectedInc(inc);
      setResolutionText(inc.resolution_notes || '');
    } catch (err) {
      alert(`Failed to load incident details: ${err.message}`);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedInc) return;
    setNoteLoading(true);
    try {
      await api.addIncidentNote(selectedInc.id, newNote);
      setNewNote('');
      const updated = await api.getIncident(selectedInc.id);
      setSelectedInc(updated);
      await fetchIncidents();
    } catch (err) {
      alert(`Failed to add note: ${err.message}`);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedInc) return;
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
        updateData.resolution_notes = resolutionText;
      }
      await api.updateIncident(selectedInc.id, updateData);
      const updated = await api.getIncident(selectedInc.id);
      setSelectedInc(updated);
      await fetchIncidents();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await api.createIncident({
        title: createTitle,
        description: createDesc,
        severity: createSeverity,
        assigned_to: user?.username,
      });
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      await fetchIncidents();
    } catch (err) {
      alert(`Failed to create incident: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div>
      {/* Action and Filter Bar */}
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
              <option value="">All Incident States</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              className="input-control"
              style={{ width: 'auto' }}
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Open Incident Ticket</span>
          </button>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={18} color="#a855f7" />
            <span>NOC Escalation & Incident Desk ({incidents.length})</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading incidents...
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No active incidents. Network health is pristine.
          </div>
        ) : (
          <div className="table-container">
            <table className="noc-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title & Summary</th>
                  <th>Affected Device</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Notes</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleOpenIncident(inc.id)}
                  >
                    <td className="mono-cell" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {inc.incident_number}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inc.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                        {inc.description}
                      </div>
                    </td>
                    <td>{inc.device_name || 'Network Core'}</td>
                    <td><SeverityBadge severity={inc.severity} /></td>
                    <td><StatusBadge status={inc.status} /></td>
                    <td className="mono-cell">{inc.assigned_to || 'Unassigned'}</td>
                    <td className="mono-cell">{inc.notes?.length || 0}</td>
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

      {/* Incident Detail & Triage Modal */}
      {selectedInc && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="mono-cell" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                    {selectedInc.incident_number}
                  </span>
                  <SeverityBadge severity={selectedInc.severity} />
                  <StatusBadge status={selectedInc.status} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedInc.title}</h2>
              </div>
              <button
                onClick={() => setSelectedInc(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '18px', background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              {selectedInc.description}
            </p>

            {/* Status Transition Toolbar */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Transition Status:</span>
              <button
                className={`btn btn-sm ${selectedInc.status === 'INVESTIGATING' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleStatusChange('INVESTIGATING')}
              >
                Investigate
              </button>
              <button
                className={`btn btn-sm ${selectedInc.status === 'RESOLVED' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleStatusChange('RESOLVED')}
                style={{ color: 'var(--up)' }}
              >
                Mark Resolved
              </button>
              <button
                className={`btn btn-sm ${selectedInc.status === 'CLOSED' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleStatusChange('CLOSED')}
              >
                Close Ticket
              </button>
            </div>

            {/* Resolution Notes (if resolved or resolving) */}
            {(selectedInc.status === 'RESOLVED' || selectedInc.status === 'CLOSED' || selectedInc.resolution_notes) && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Root Cause & Resolution Notes
                </label>
                <textarea
                  className="input-control"
                  rows={2}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Summarize root cause and remediation steps taken..."
                />
              </div>
            )}

            {/* Investigation Notes Feed */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={15} color="var(--primary)" />
                <span>Operator Investigation Journal ({selectedInc.notes?.length || 0})</span>
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {(!selectedInc.notes || selectedInc.notes.length === 0) ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    No investigation notes logged yet.
                  </div>
                ) : (
                  selectedInc.notes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.74rem', marginBottom: '2px' }}>
                        <strong>{note.author}</strong>
                        <span className="mono-cell">
                          {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-main)' }}>{note.note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Note Form */}
            <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="input-control"
                placeholder="Log observation, interface diagnostic, or dispatch note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={noteLoading || !newNote.trim()}>
                <Send size={14} />
                <span>Post</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Create New Incident Ticket</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Incident Title *
                </label>
                <input
                  type="text"
                  className="input-control"
                  required
                  placeholder="e.g. Core Switch Link Flapping or Border BGP Flap"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Severity Level
                </label>
                <select
                  className="input-control"
                  value={createSeverity}
                  onChange={(e) => setCreateSeverity(e.target.value)}
                >
                  <option value="LOW">Low (Minor anomaly)</option>
                  <option value="MEDIUM">Medium (Degraded performance)</option>
                  <option value="HIGH">High (Redundancy lost / Port down)</option>
                  <option value="CRITICAL">Critical (Total host/service outage)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Incident Description & Initial Symptoms *
                </label>
                <textarea
                  className="input-control"
                  required
                  rows={4}
                  placeholder="Provide detailed symptoms, affected subnets, and initial diagnostic findings..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? 'Opening...' : 'Open Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
