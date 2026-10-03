import { useState } from 'react';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { toast } from './Toast';
import { useNavigate } from 'react-router-dom';

export default function Registration({ onLoginSuccess }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegistration = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please provide an email/username and password');
      return;
    }
    setLoading(true);
    setError('');

    try {
      let res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: username,
          username,
          password,
          businessName: businessName.trim() || 'My Business',
          gstNumber: gstNumber.trim(),
          contactInfo: contactInfo.trim()
        })
      });

      if (!res.ok) {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: username,
            username,
            password,
            businessName: businessName.trim() || 'My Business',
            gstNumber: gstNumber.trim(),
            contactInfo: contactInfo.trim()
          })
        });
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'Registration failed. User may already exist.');
      }

      const data = await res.json();
      const token = data.token || 'mock_jwt_token_' + Date.now();
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('user_email', username);
      if (data.tenantId) localStorage.setItem('tenantId', data.tenantId);
      if (data.businessName) localStorage.setItem('businessName', data.businessName);
      
      const newProfile = {
        businessName: businessName.trim() || 'My Business',
        gstin: gstNumber.trim(),
        phone: contactInfo.trim()
      };
      localStorage.setItem('freegstbill_profile', JSON.stringify(newProfile));
      window.dispatchEvent(new Event('fgsb-profile-updated'));

      toast('Account created & logged in successfully!', 'success');
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f8fafc)', padding: '1rem' }}>
      <div style={{ background: 'var(--surface, #ffffff)', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)', width: '100%', maxWidth: '440px', border: '1px solid var(--border, #e2e8f0)' }}>
        
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary, #2563eb)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <UserPlus size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>GST Billing & Accounting</h2>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.9rem', margin: 0 }}>
            Create a new business client account
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary, #f1f5f9)', padding: '4px', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => { navigate('/login'); setError(''); }}
            style={{
              flex: 1, padding: '0.55rem', border: 'none', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              background: 'transparent', color: 'var(--text-muted, #64748b)',
              boxShadow: 'none', transition: 'all 0.2s'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { navigate('/registration'); setError(''); }}
            style={{
              flex: 1, padding: '0.55rem', border: 'none', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              background: 'white', color: 'var(--primary, #2563eb)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s'
            }}
          >
            New Account (Sign Up)
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.88rem', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegistration} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Email / Username */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
              Email Address / Username *
            </label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. jawaharlalnehru@gmail.com"
              required
              style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          {/* Business Name */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
              Business / Firm Name *
            </label>
            <input 
              type="text" 
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g. Nehru Textile Mills"
              required
              style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          {/* GSTIN & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                GSTIN (Optional)
              </label>
              <input 
                type="text" 
                value={gstNumber}
                onChange={e => setGstNumber(e.target.value)}
                placeholder="27AAAAA0000A1Z5"
                style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                Phone (Optional)
              </label>
              <input 
                type="text" 
                value={contactInfo}
                onChange={e => setContactInfo(e.target.value)}
                placeholder="+91 9876543210"
                style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
              Password *
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', padding: '0.7rem 0.85rem', paddingRight: '2.5rem', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.9rem', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: '0.75rem', background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', color: 'var(--text-muted, #6b7280)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              background: 'var(--primary, #2563eb)', 
              color: 'white', 
              padding: '0.75rem', 
              borderRadius: '6px', 
              border: 'none', 
              fontWeight: 600, 
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Creating Account...' : 'Create Client Account'}
          </button>
        </form>

        {/* Toggle Mode Footer Link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #f1f5f9)', fontSize: '0.88rem' }}>
          <span>Already have an account? <button type="button" onClick={() => { navigate('/login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary, #2563eb)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Sign In</button></span>
        </div>
      </div>
    </div>
  );
}
