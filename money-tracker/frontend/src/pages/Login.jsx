import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import GuestConfirmationModal from '../components/Guest/GuestConfirmationModal';

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError(err.message || 'Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestClick = () => {
    setIsGuestModalOpen(true);
  };

  const handleGuestContinue = () => {
    setIsGuestModalOpen(false);
    window.location.href = '/guest/dashboard';
  };

  const handleGuestLogin = () => {
    setIsGuestModalOpen(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#060010',
        padding: '16px'
      }}
    >
      <div
        style={{
          backgroundColor: '#0c0c14',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '40px 24px',
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '32px', fontWeight: '700', color: '#e2e8f0' }}>
            SPEND
          </span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '32px', fontWeight: '700', color: '#7c3aed' }}>
            X
          </span>
        </div>

        <h1 style={{ color: '#f1f1f5', fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
          Welcome to SpendX
        </h1>
        <p style={{ color: '#8b8b9e', fontSize: '14px', marginBottom: '24px' }}>
          Sign in to take control of your spending
        </p>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '24px',
              textAlign: 'left'
            }}
          >
            <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '13px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️ Supabase Project Offline</span>
            </div>
            <p style={{ color: '#fca5a5', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
              The Supabase database (<code>tdjynchyarsgujxzomfz.supabase.co</code>) is currently paused or deleted on Supabase.
            </p>
            <div style={{ color: '#cbd5e1', fontSize: '11px', marginTop: '8px', lineHeight: '1.4' }}>
              <strong>To fix this:</strong>
              <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Restore/unpause project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: '#a78bfa', textDecoration: 'underline' }}>supabase.com</a></li>
                <li>Or update <code>.env</code> with your active Supabase URL & Key.</li>
              </ol>
            </div>
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px 20px',
            backgroundColor: loading ? '#cccccc' : '#ffffff',
            color: '#1f1f1f',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
            marginBottom: '12px'
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.opacity = '1'; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        <button
          onClick={handleGuestClick}
          style={{
            width: '100%',
            padding: '12px 20px',
            backgroundColor: 'rgba(124, 58, 237, 0.15)',
            color: '#c4b5fd',
            border: '1px solid rgba(124, 58, 237, 0.4)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.15)'; }}
        >
          Use Without Login →
        </button>

        <p style={{ color: '#606080', fontSize: '12px', marginTop: '24px' }}>
          Your data stays private — only you can see your transactions
        </p>

        <GuestConfirmationModal
          isOpen={isGuestModalOpen}
          onClose={() => setIsGuestModalOpen(false)}
          onContinue={handleGuestContinue}
          onLogin={handleGuestLogin}
        />
      </div>
    </div>
  );
}
