import { useState } from 'react';
import { toast } from './Toast';

export default function BusinessSetupWizard({ onComplete }) {
  const [businessName, setBusinessName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch('/api/v1/auth/setup-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ businessName, gstNumber, address, contactInfo })
      });

      if (!res.ok) {
        throw new Error('Failed to setup business profile');
      }

      const data = await res.json();
      localStorage.setItem('jwt_token', data.token); // Store updated token with tenant context
      localStorage.setItem('tenantId', data.tenantId);
      localStorage.setItem('businessName', data.businessName);

      toast('Business profile created successfully!', 'success');
      onComplete();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Welcome to GST Billing!</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Let's set up your business profile to get started.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.88rem', fontWeight: 600 }}>Business Name *</label>
            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="Your Company Ltd" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.88rem', fontWeight: 600 }}>GST Number (Optional)</label>
            <input type="text" value={gstNumber} onChange={e => setGstNumber(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="e.g. 22AAAAA0000A1Z5" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.88rem', fontWeight: 600 }}>Address (Optional)</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', minHeight: '80px' }} placeholder="Business Address" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.88rem', fontWeight: 600 }}>Contact Info (Optional)</label>
            <input type="text" value={contactInfo} onChange={e => setContactInfo(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="Phone / Email" />
          </div>

          <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', padding: '0.75rem', borderRadius: '6px', fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: '1rem' }}>
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
