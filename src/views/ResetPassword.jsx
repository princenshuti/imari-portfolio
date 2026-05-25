import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';

export default function ResetPassword({ onDone, session }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(!!session);

  // Wait for the recovery session to arrive if not yet available
  useEffect(() => {
    if (session) { setReady(true); return; }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && s) {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [session]);

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 9, border: '1px solid var(--line)',
    background: 'var(--paper-2)', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: 'var(--ink)',
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => onDone(), 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{ padding: 36, width: '100%', maxWidth: 460 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: 'var(--brand)', color: 'var(--brand-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Instrument Serif, serif', fontSize: 28, marginBottom: 18,
        }}>●</div>

        <div className="font-serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Set new password.
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>
          Choose a strong password for your Imari account.
        </div>

        {!ready ? (
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--paper-2)', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
            Verifying your reset link…
          </div>
        ) : success ? (
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--up-soft)', color: 'var(--up)', fontSize: 13, textAlign: 'center' }}>
            ✅ Password updated! Signing you in…
          </div>
        ) : (
          <form onSubmit={submit} className="col" style={{ gap: 12 }}>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password (min. 8 characters)"
              autoComplete="new-password" style={inputStyle}
            />
            <input
              type="password" required value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password" style={inputStyle}
            />
            {error && (
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--down-soft)', color: 'var(--down)', fontSize: 12.5 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: 6 }}>
              {loading ? 'Updating…' : 'Set new password →'}
            </button>
          </form>
        )}


        <div style={{ marginTop: 24, textAlign: 'center' }}>
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
