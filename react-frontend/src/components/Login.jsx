import { useState } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { toast } from './Toast';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      if (!res.ok) {
        let errMsg = 'Google authentication failed (' + res.status + ')';
        try {
          const errData = await res.json();
          if (errData.message) errMsg = errData.message;
        } catch { /* ignore non-json */ }
        throw new Error(errMsg);
      }
      const data = await res.json();
      localStorage.removeItem('freegstbill_profile');
      sessionStorage.clear();
      localStorage.setItem('jwt_token', data.token);
      if (data.tenantId) {
        localStorage.setItem('tenantId', String(data.tenantId));
      } else {
        localStorage.removeItem('tenantId');
      }
      if (data.businessName) {
        localStorage.setItem('businessName', data.businessName);
        if (data.tenantId) {
          localStorage.setItem(`freegstbill_profile_${data.tenantId}`, JSON.stringify({ businessName: data.businessName, tenantId: data.tenantId }));
        }
      }
      toast('Signed in with Google successfully!', 'success');
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Google Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, username, password })
      });

      if (!res.ok) {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, username, password })
        });
      }

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await res.json();
      if (data.token) {
        localStorage.removeItem('freegstbill_profile');
        sessionStorage.clear();
        localStorage.setItem('jwt_token', data.token);
        localStorage.setItem('user_email', username || data.username || 'user@example.com');
        if (data.tenantId) {
          localStorage.setItem('tenantId', String(data.tenantId));
        } else {
          localStorage.removeItem('tenantId');
        }
        if (data.businessName) {
          localStorage.setItem('businessName', data.businessName);
          if (data.tenantId) {
            localStorage.setItem(`freegstbill_profile_${data.tenantId}`, JSON.stringify({ businessName: data.businessName, tenantId: data.tenantId }));
          }
          window.dispatchEvent(new Event('fgsb-profile-updated'));
        }
        toast('Logged in successfully', 'success');
        onLoginSuccess();
      } else {
        throw new Error('No token received');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Ensure the backend is running.');
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
            <LogIn size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>GST Billing & Accounting</h2>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.9rem', margin: 0 }}>
            Sign in to access your business console
          </p>
        </div>

        {/* Google Login with origin indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem', gap: '8px' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError('Google OAuth Error (origin_mismatch). Please open http://localhost:4200 (registered in Google Cloud) or use 1-Click Demo Login below.');
            }}
          />
          {window.location.port !== '4200' && window.location.hostname === 'localhost' && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', textAlign: 'center' }}>
              💡 Google Sign-In is configured for <a href="http://localhost:4200" style={{ color: '#2563eb', fontWeight: 600 }}>http://localhost:4200</a>.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
          <span style={{ padding: '0 10px', color: '#94a3b8', fontSize: '0.85rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary, #f1f5f9)', padding: '4px', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => { navigate('/login'); setError(''); }}
            style={{
              flex: 1, padding: '0.55rem', border: 'none', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              background: 'white', color: 'var(--primary, #2563eb)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { navigate('/registration'); setError(''); }}
            style={{
              flex: 1, padding: '0.55rem', border: 'none', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              background: 'transparent', color: 'var(--text-muted, #64748b)',
              boxShadow: 'none', transition: 'all 0.2s'
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

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={async () => {
              setUsername('admin@system.com');
              setPassword('admin123');
              setLoading(true);
              setError('');
              try {
                let res = await fetch('/api/v1/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: 'admin@system.com', username: 'admin@system.com', password: 'admin123' })
                });
                if (!res.ok) {
                  res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'admin@system.com', username: 'admin@system.com', password: 'admin123' })
                  });
                }
                if (!res.ok) throw new Error('Invalid credentials');
                const data = await res.json();
                if (data.token) {
                  localStorage.setItem('jwt_token', data.token);
                  localStorage.setItem('user_email', 'admin@system.com');
                  if (data.tenantId) localStorage.setItem('tenantId', String(data.tenantId));
                  if (data.businessName) localStorage.setItem('businessName', data.businessName);
                  toast('Logged in as Demo Admin!', 'success');
                  onLoginSuccess();
                }
              } catch (err) {
                setError(err.message || 'Auto-login failed.');
              } finally {
                setLoading(false);
              }
            }}
            style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px dashed #93c5fd',
              borderRadius: '6px',
              padding: '0.65rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
          >
            ⚡ 1-Click Instant Demo Login (admin@system.com)
          </button>
        </form>

        {/* Toggle Mode Footer Link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #f1f5f9)', fontSize: '0.88rem' }}>
          <span>New client or business? <button type="button" onClick={() => { navigate('/registration'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary, #2563eb)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Create an account</button></span>
        </div>
      </div>
    </div>
  );
}
