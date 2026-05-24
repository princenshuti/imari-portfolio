import { useState } from 'react';
import { signIn, signUp, resetPassword, isConfigured } from '../cloud.js';

export default function Login({ pendingInvite }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState(pendingInvite?.email || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
          } else {
            setError('Unable to send reset email. Please double-check the address and try again.');
          }
        }
        return;
      }
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const data = await signUp(email, password);
        if (data.user && !data.session) {
          setMessage('Check your email for a confirmation link to finish signup.');
        }
      }
    } catch (err) {
      // Map raw Supabase errors to user-friendly messages
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('email rate')) {
        setError('Too many sign-up attempts right now. Please try again in a few minutes, or contact the admin to add you manually.');
      } else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        setError('Incorrect email or password. Please check your details and try again.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email first — check your inbox for a link from Imari.');
      } else if (msg.toLowerCase().includes('user already registered')) {
        setError('An account with this email already exists. Try signing in instead.');
        setMode('signin');
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
          <div className="font-serif" style={{ fontSize: 26, marginBottom: 8 }}>Configuration required</div>
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

  const inputStyle = {
    width:'100%', padding:'12px 14px', borderRadius: 9, border:'1px solid var(--line)',
    background:'var(--paper-2)', fontSize: 14, fontFamily:'inherit', outline:'none', color:'var(--ink)',
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'var(--bg)', display:'flex',
      alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <div className="card" style={{ padding: 36, width:'100%', maxWidth: 460 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Instrument Serif, serif', fontSize: 28, marginBottom: 18,
        }}>●</div>
        <div className="font-serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing:'-0.02em' }}>
          {mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Create your account.' : 'Reset your password.'}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>
          {mode === 'forgot'
            ? "Enter your email and we'll send you a link to reset your password."
            : pendingInvite
              ? `You've been invited as a ${pendingInvite.role}. Sign in or create an account with ${pendingInvite.email} to join the portfolio.`
              : mode === 'signin'
                ? 'Sign in to access your portfolio.'
                : 'Imari encrypts your password and stores it securely on Supabase.'}
        </div>

        <form onSubmit={submit} className="col" style={{ gap: 12 }}>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" autoComplete="email" style={inputStyle}
            disabled={!!pendingInvite?.email} />
          {mode !== 'forgot' && (
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Password'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} style={inputStyle} />
          )}

          {mode === 'signin' && (
            <div style={{ textAlign:'right', marginTop: -4 }}>
              <span onClick={() => switchMode('forgot')}
                style={{ fontSize: 12, color:'var(--brand)', cursor:'pointer' }}>
                Forgot password?
              </span>
            </div>
          )}

          {error   && <div style={{ padding: 10, borderRadius: 8, background:'var(--down-soft)', color:'var(--down)', fontSize: 12.5 }}>{error}</div>}
          {message && <div style={{ padding: 10, borderRadius: 8, background:'var(--up-soft)',   color:'var(--up)',   fontSize: 12.5 }}>{message}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width:'100%', marginTop: 6 }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in →' : mode === 'forgot' ? 'Send reset link →' : 'Create account →'}
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign:'center', fontSize: 12.5 }}>
          {mode === 'forgot' ? (
            <>
              <span className="muted">Remember your password?</span>{' '}
              <span onClick={() => switchMode('signin')} style={{ color:'var(--brand)', cursor:'pointer', fontWeight: 500 }}>Sign in</span>
            </>
          ) : (
            <>
              <span className="muted">{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}</span>{' '}
              <span onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                style={{ color:'var(--brand)', cursor:'pointer', fontWeight: 500 }}>
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </span>
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
