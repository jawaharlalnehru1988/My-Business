import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { BrowserRouter } from 'react-router-dom'

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL REACT CRASH:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '2rem auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid #fee2e2' }}>
          <h2 style={{ color: '#dc2626', marginTop: 0 }}>Application Error Detected</h2>
          <p style={{ color: '#4b5563' }}>A runtime error prevented the application from rendering:</p>
          <pre style={{ background: '#fef2f2', color: '#991b1b', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.88rem', border: '1px solid #fca5a5' }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/login'; }}
            style={{ marginTop: '1rem', background: '#2563eb', color: 'white', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear Cache & Go to Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Proactively unregister any legacy service workers and clear caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

if ('caches' in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name);
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <GoogleOAuthProvider clientId="671159237759-5eu5k96v53hl3d729tmeqd35daqe69ar.apps.googleusercontent.com">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GoogleOAuthProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
)
