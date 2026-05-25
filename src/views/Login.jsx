import { useState } from 'react';
import { signIn, signUp, resetPassword, isConfigured } from '../cloud.js';

export default function Login({ pendingInvite }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState(pendingInvite?.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const switchMode = (next) => { setMode(next); setError(null); setMessage(null); };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      if (mode === 'forgot') {
        try {
          await resetPassword(email);
          setMessage('If an account exists for that email, a reset link has been sent. Check your inbox.');
        } catch (resetErr) {
          const m = resetErr.message || '';
          if (m.toLowerCase().includes('rate limit') || m.toLowerCase().includes('email rate')) {
            setError('Too many reset attempts. Please wait a few minutes and try again.');
          } else if (m.toLowerCase().includes('sending') || m.toLowerCase().includes('smtp') || m.toLowerCase().includes('email')) {
            setError('Email service is temporarily unavailable. Please try again later or contact the admin.');
          } else {
            setError('Unable to send reset email. Please double-check the address and try again.');
          }
        }
        return;
      }
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        const data = await signUp(email, password);
        if (data.user && !data.session) {
          setMessage('Check your email for a confirmation link to finish signup.');
        }
      }
    } catch (err) {
      // Map raw Supabase errors to user-friendly messages
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('email rate')) {
        setError('Too many attempts right now. Please try again in a few minutes.');
      } else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        setError('Incorrect email or password. Please check your details and try again.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email first — check your inbox for a confirmation link.');
      } else if (msg.toLowerCase().includes('user already registered')) {
        setError('An account with this email already exists. Try signing in instead.');
        setMode('signin');
      } else if (msg.toLowerCase().includes('sending') || msg.toLowerCase().includes('confirmation email') || msg.toLowerCase().includes('smtp')) {
        setError('Account created but the confirmation email could not be sent right now. Please contact the admin or try signing in directly.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div style={{
        position:'fixed', inset:0, background:'var(--bg)', display:'flex',
        alignItems:'center', justifyContent:'center', padding:20,
      }}>
        <div className="card" style={{ padding: 32, maxWidth: 480 }}>
          <h1 className="font-serif" style={{ fontSize: 26, marginBottom: 8, marginTop: 0, fontWeight: 400 }}>Configuration required</h1>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>
            Imari is not connected to a backend. Set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> at build time to enable login and shared portfolios.
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            See <code>supabase-schema.sql</code> in the repo for the database schema.
          </div>
        </div>
      </div>
    );
  }

  // Shared input style — uses --line-strong + brand focus ring from styles.css.
  const inputStyle = {
    width:'100%', padding:'12px 14px', borderRadius: 9, border:'1px solid var(--line-strong)',
    background:'var(--paper-2)', fontSize: 14, fontFamily:'inherit', color:'var(--ink)',
  };

  const errorId   = 'login-error';
  const messageId = 'login-message';

  return (
    <div style={{
      position:'fixed', inset:0, background:'var(--bg)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <button
        type="button"
        onClick={() => { window.location.hash = ''; }}
        aria-label="Back to home"
        style={{
          position:'absolute', top: 20, left: 20, background:'transparent', border: 0,
          color:'var(--ink-3)', fontSize: 13, cursor:'pointer', padding:'8px 12px',
          borderRadius:'var(--r-md)', display:'inline-flex', alignItems:'center', gap: 6,
          transition:'color 160ms ease, background 160ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <span aria-hidden="true">←</span> Back to home
      </button>
      <div className="card" style={{ padding: 36, width:'100%', maxWidth: 460 }}>
        <div aria-hidden="true" style={{
          width: 48, height: 48, borderRadius: 12, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Instrument Serif, serif', fontSize: 28, marginBottom: 18,
        }}>●</div>
        <h1 className="font-serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing:'-0.02em', margin: 0, fontWeight: 400 }}>
          {mode === 'signin' ? 'Welcome to Imari.' : mode === 'signup' ? 'Create your account.' : 'Reset your password.'}
        </h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>
          {mode === 'forgot'
            ? "Enter your email and we'll send you a link to reset your password."
            : pendingInvite
              ? `You've been invited as a ${pendingInvite.role}. Sign in or create an account with ${pendingInvite.email} to join the portfolio.`
              : mode === 'signin'
                ? 'Sign in or create an account to access your portfolio.'
                : 'Imari encrypts your password and stores it securely on Supabase.'}
        </div>

        <form onSubmit={submit} className="col" style={{ gap: 12 }}>
          <label htmlFor="login-email" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Email address</label>
          <input
            id="login-email"
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" autoComplete="email" style={inputStyle}
            disabled={!!pendingInvite?.email}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : message ? messageId : undefined}
          />
          {mode !== 'forgot' && (
            <>
              <label htmlFor="login-password" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Password</label>
              <input
                id="login-password"
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} style={inputStyle}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                minLength={mode === 'signup' ? 8 : undefined}
              />
            </>
          )}

          {mode === 'signin' && (
            <div style={{ textAlign:'right', marginTop: -4 }}>
              <button type="button" onClick={() => switchMode('forgot')} className="btn-link" style={{ fontSize: 12 }}>
                Forgot password?
              </button>
            </div>
          )}

          {error   && <div id={errorId}   role="alert"  style={{ padding: 10, borderRadius: 8, background:'var(--down-soft)', color:'var(--down-ink)', fontSize: 12.5 }}>{error}</div>}
          {message && <div id={messageId} role="status" style={{ padding: 10, borderRadius: 8, background:'var(--up-soft)',   color:'var(--up-ink)',   fontSize: 12.5 }}>{message}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width:'100%', marginTop: 6 }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in →' : mode === 'forgot' ? 'Send reset link →' : 'Create account →'}
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign:'center', fontSize: 12.5 }}>
          {mode === 'forgot' ? (
            <>
              <span className="muted">Remember your password?</span>{' '}
              <button type="button" onClick={() => switchMode('signin')} className="btn-link">Sign in</button>
            </>
          ) : (
            <>
              <span className="muted">{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}</span>{' '}
              <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="btn-link">
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 24, textAlign:'center' }}>
          <div className="muted" style={{ fontSize: 10, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Powered by
          </div>
          <img
            src={`${import.meta.env.BASE_URL}maxventures-logo.png`}
            alt="Maxventures"
            style={{ width: 120, opacity: 0.85, display: 'inline-block' }}
          />
        </div>
      </div>
    </div>
  );
}
