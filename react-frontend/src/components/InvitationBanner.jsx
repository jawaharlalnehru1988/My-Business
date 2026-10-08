import { useState, useEffect } from 'react';
import { Mail, Check, X, Building2, ArrowRight } from 'lucide-react';
import { getReceivedInvitations, acceptInvitation, rejectInvitation, switchWorkspace } from '../store';
import { toast } from './Toast';

export default function InvitationBanner({ onAccepted }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);

  const checkInvitations = async () => {
    try {
      const list = await getReceivedInvitations();
      setInvitations(Array.isArray(list) ? list : []);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    checkInvitations();
    // Periodically check for incoming invitations every 30 seconds
    const interval = setInterval(checkInvitations, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (inv) => {
    setLoading(true);
    try {
      await acceptInvitation(inv.id);
      toast(`Accepted invitation to join "${inv.businessName}" as Accounting Partner!`, 'success');
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
      if (onAccepted) onAccepted(inv);
      if (window.confirm(`Would you like to switch to "${inv.businessName}" workspace now?`)) {
        await switchWorkspace(inv.tenantId);
        window.location.reload();
      }
    } catch (err) {
      toast(err.message || 'Failed to accept invitation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (inv) => {
    setLoading(true);
    try {
      await rejectInvitation(inv.id);
      toast('Invitation declined', 'info');
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
    } catch (err) {
      toast(err.message || 'Failed to decline invitation', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!invitations || invitations.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
      {invitations.map(inv => (
        <div
          key={inv.id}
          style={{
            background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Mail size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                Accounting Partner Invitation Received
              </div>
              <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                <strong>{inv.inviterEmail}</strong> has invited you to collaborate on <strong>{inv.businessName}</strong> as an <em>Accounting Partner</em>.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => handleAccept(inv)}
              disabled={loading}
              style={{
                background: '#ffffff',
                color: '#1d4ed8',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 0.9rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Check size={14} /> Accept & Join
            </button>
            <button
              onClick={() => handleReject(inv)}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                padding: '0.45rem 0.75rem',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <X size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} /> Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
