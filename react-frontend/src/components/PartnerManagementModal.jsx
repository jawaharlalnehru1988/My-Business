import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Mail, Shield, Check, X, Trash2,
  RefreshCw, Building2, CheckCircle2, AlertCircle, ArrowRightLeft
} from 'lucide-react';
import {
  sendInvitation, getSentInvitations, revokeInvitation,
  getCollaborators, removeCollaborator, getMyWorkspaces, switchWorkspace
} from '../store';
import { toast } from './Toast';

export default function PartnerManagementModal({ isOpen, onClose, currentProfile }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ACCOUNTING_PARTNER');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [collaborators, setCollaborators] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeTab, setActiveTab] = useState('invite'); // 'invite' | 'workspaces'

  const loadData = async () => {
    setLoading(true);
    try {
      const [collabs, invites, ws] = await Promise.all([
        getCollaborators(),
        getSentInvitations(),
        getMyWorkspaces()
      ]);
      setCollaborators(Array.isArray(collabs) ? collabs : []);
      setSentInvites(Array.isArray(invites) ? invites : []);
      setWorkspaces(Array.isArray(ws) ? ws : []);
    } catch (err) {
      console.error('Failed to load collaboration data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSending(true);
    try {
      await sendInvitation(inviteEmail.trim(), inviteRole);
      toast(`Invitation sent to ${inviteEmail.trim()} successfully!`, 'success');
      setInviteEmail('');
      await loadData();
    } catch (err) {
      toast(err.message || 'Failed to send invitation', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id, email) => {
    try {
      await revokeInvitation(id);
      toast(`Cancelled invitation for ${email}`, 'info');
      await loadData();
    } catch (err) {
      toast(err.message || 'Failed to cancel invitation', 'error');
    }
  };

  const handleRemoveCollaborator = async (id, email) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from accessing this business?`)) return;
    try {
      await removeCollaborator(id);
      toast(`Removed collaborator ${email}`, 'info');
      await loadData();
    } catch (err) {
      toast(err.message || 'Failed to remove collaborator', 'error');
    }
  };

  const handleSwitch = async (ws) => {
    if (ws.current) return;
    try {
      await switchWorkspace(ws.tenantId);
      toast(`Switched workspace to "${ws.businessName}"`, 'success');
      onClose();
      window.location.reload();
    } catch (err) {
      toast(err.message || 'Failed to switch workspace', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Accounting Partners & Workspaces
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                {currentProfile?.businessName || localStorage.getItem('businessName') || 'My Business'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.4rem', borderRadius: '6px' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem', background: '#ffffff' }}>
          <button
            onClick={() => setActiveTab('invite')}
            style={{
              padding: '0.75rem 1rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'invite' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'invite' ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            <UserPlus size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Invite Partner & Collaborators
          </button>
          <button
            onClick={() => setActiveTab('workspaces')}
            style={{
              padding: '0.75rem 1rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'workspaces' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'workspaces' ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            <Building2 size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            My Workspaces ({workspaces.length})
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {activeTab === 'invite' ? (
            <>
              {/* Send Invitation Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <UserPlus size={18} color="#2563eb" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                    Invite an Accounting Partner
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                  Send an invite link to an accountant or team member. When they accept, they can access this business's invoices, expenses, and inventory while keeping their own account strictly isolated.
                </p>

                <form onSubmit={handleSendInvite} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 240px', position: 'relative' }}>
                    <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      required
                      placeholder="partner.email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      background: '#ffffff'
                    }}
                  >
                    <option value="ACCOUNTING_PARTNER">Accounting Partner</option>
                    <option value="VIEWER">Read-Only Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={sending}
                    style={{
                      padding: '0.65rem 1.25rem',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    {sending ? 'Sending...' : 'Send Invite'}
                  </button>
                </form>
              </div>

              {/* Active Collaborators */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.92rem', fontWeight: 700, color: '#334155' }}>
                  Active Business Members ({collaborators.length})
                </h4>
                {collaborators.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    No collaborators added yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {collaborators.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #f1f5f9',
                          background: '#f8fafc'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: c.role === 'OWNER' ? '#eff6ff' : '#ecfdf5',
                            color: c.role === 'OWNER' ? '#2563eb' : '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.82rem'
                          }}>
                            {c.userEmail ? c.userEmail.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                              {c.userEmail}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              Joined {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : 'Recently'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: c.role === 'OWNER' ? '#dbeafe' : '#dcfce7',
                            color: c.role === 'OWNER' ? '#1e40af' : '#15803d'
                          }}>
                            {c.role === 'OWNER' ? 'Owner' : 'Accounting Partner'}
                          </span>

                          {c.role !== 'OWNER' && (
                            <button
                              onClick={() => handleRemoveCollaborator(c.id, c.userEmail)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                              title="Remove Partner Access"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Invitations Sent */}
              {sentInvites.filter(i => i.status === 'PENDING').length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.92rem', fontWeight: 700, color: '#d97706' }}>
                    Pending Invitations ({sentInvites.filter(i => i.status === 'PENDING').length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {sentInvites.filter(i => i.status === 'PENDING').map((inv) => (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 1rem',
                          borderRadius: '8px',
                          border: '1px dashed #fcd34d',
                          background: '#fffbeb'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#92400e' }}>
                            {inv.inviteeEmail}
                          </span>
                          <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#b45309' }}>
                            (Invited as {inv.role})
                          </span>
                        </div>
                        <button
                          onClick={() => handleRevoke(inv.id, inv.inviteeEmail)}
                          style={{
                            padding: '4px 8px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* My Workspaces Tab */
            <div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                You have access to the following business workspaces. Switch to manage another business or client's accounting.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {workspaces.map((ws) => (
                  <div
                    key={ws.tenantId}
                    onClick={() => handleSwitch(ws)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1.1rem',
                      borderRadius: '10px',
                      border: ws.current ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: ws.current ? '#eff6ff' : '#ffffff',
                      cursor: ws.current ? 'default' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: ws.current ? '#2563eb' : '#f1f5f9',
                        color: ws.current ? '#ffffff' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700
                      }}>
                        {ws.businessName ? ws.businessName.charAt(0).toUpperCase() : 'B'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: ws.current ? '#1e40af' : '#0f172a' }}>
                          {ws.businessName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Tenant #{ws.tenantId} • Role: {ws.role === 'OWNER' ? 'Owner' : 'Accounting Partner'}
                        </div>
                      </div>
                    </div>

                    <div>
                      {ws.current ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: '#2563eb',
                          color: '#ffffff'
                        }}>
                          <Check size={12} /> Active
                        </span>
                      ) : (
                        <button
                          style={{
                            padding: '5px 10px',
                            background: '#f8fafc',
                            color: '#2563eb',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ArrowRightLeft size={12} /> Switch
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
