import { useState, useEffect, useRef } from 'react';
import { CURRENCIES } from '../data.js';
import { exportJSON, importJSONFile } from '../store.js';
import { getApiKey, setApiKey } from '../ai.js';
import { listMembers, listInvitations, createInvitation, revokeInvitation, removeMember, updateMemberRole, isConfigured } from '../cloud.js';
import { Field, inputStyle } from '../components/Field.jsx';

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="font-serif" style={{ fontSize: 22, marginBottom: subtitle ? 4 : 14 }}>{title}</div>
      {subtitle && <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.5, maxWidth: 600 }}>{subtitle}</div>}
      <div className="card" style={{ padding: 22 }}>{children}</div>
    </div>
  );
}

function MembersSection({ portfolioId, role, session }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [busy, setBusy] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [error, setError] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([listMembers(portfolioId), listInvitations(portfolioId)]);
      setMembers(m); setInvitations(i);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (portfolioId) refresh(); }, [portfolioId]);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError(null);
    try {
      const inv = await createInvitation(portfolioId, email, inviteRole);
      setEmail('');
      await refresh();
      // Auto-copy invite link
      const link = `${window.location.origin}${window.location.pathname}?invite=${inv.token}`;
      navigator.clipboard.writeText(link).catch(() => {});
      setCopiedToken(inv.token);
      setTimeout(() => setCopiedToken(null), 3000);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const copyLink = (token) => {
    const link = `${window.location.origin}${window.location.pathname}?invite=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRoleChange = async (memberId, newRole) => {
    try { await updateMemberRole(memberId, newRole); await refresh(); }
    catch (e) { setError(e.message); }
  };

  const handleRemove = async (member) => {
    if (!confirm(`Remove ${member.email} from this portfolio?`)) return;
    try { await removeMember(member.id); await refresh(); }
    catch (e) { setError(e.message); }
  };

  const handleRevoke = async (inv) => {
    if (!confirm(`Revoke pending invitation for ${inv.email}?`)) return;
    try { await revokeInvitation(inv.id); await refresh(); }
    catch (e) { setError(e.message); }
  };

  if (!isConfigured || !portfolioId) return null;
  const isOwner = role === 'owner';

  return (
    <Section
      title="Members"
      subtitle={isOwner
        ? 'Invite people by email. Editors can add and update assets. Viewers can see your portfolio but not modify it.'
        : 'You can view who has access to this portfolio. Only the owner can invite or remove members.'}
    >
      {isOwner && (
        <form onSubmit={invite} className="row" style={{ gap: 8, marginBottom: 18 }}>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="invite-friend@example.com" style={{ ...inputStyle, flex: 1 }} />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>
            {busy ? 'Sending…' : '＋ Invite'}
          </button>
        </form>
      )}

      {error && <div style={{ padding: 10, borderRadius: 8, background:'var(--down-soft)', color:'var(--down)', fontSize: 12, marginBottom: 14 }}>{error}</div>}

      {loading ? (
        <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div className="muted" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 8 }}>
            Members ({members.length})
          </div>
          <div className="col" style={{ gap: 6, marginBottom: 18 }}>
            {members.map(m => (
              <div key={m.id} className="row" style={{ padding: '10px 12px', borderRadius: 8, background:'var(--bg-2)', justifyContent:'space-between', gap: 10 }}>
                <div className="col" style={{ minWidth: 0, gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {m.email}{m.user_id === session?.user?.id && <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>(you)</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11, textTransform:'capitalize' }}>{m.role}</div>
                </div>
                {isOwner && m.role !== 'owner' && (
                  <div className="row" style={{ gap: 6 }}>
                    <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)} style={{
                      padding:'5px 8px', fontSize: 11, borderRadius: 6, border:'1px solid var(--line)', background:'var(--paper)', fontFamily:'inherit',
                    }}>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={() => handleRemove(m)} style={{
                      padding:'5px 9px', fontSize: 11, borderRadius: 6, border:'1px solid var(--down-soft)', background:'var(--paper)', color:'var(--down)', cursor:'pointer',
                    }}>Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isOwner && invitations.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 8 }}>
                Pending invitations ({invitations.length})
              </div>
              <div className="col" style={{ gap: 6 }}>
                {invitations.map(inv => (
                  <div key={inv.id} className="row" style={{ padding: '10px 12px', borderRadius: 8, background:'var(--gold-soft)', justifyContent:'space-between', gap: 10 }}>
                    <div className="col" style={{ minWidth: 0, gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{inv.email}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button onClick={() => copyLink(inv.token)} style={{
                        padding:'5px 9px', fontSize: 11, borderRadius: 6, border:'1px solid var(--line)', background:'var(--paper)', color:'var(--ink-2)', cursor:'pointer',
                      }}>{copiedToken === inv.token ? '✓ Copied' : 'Copy link'}</button>
                      <a href={`mailto:${inv.email}?subject=${encodeURIComponent('You\'re invited to Imari Portfolio')}&body=${encodeURIComponent(`Hi,\n\nI'd like to share my Imari Portfolio with you as a ${inv.role}.\n\nAccept the invitation here: ${window.location.origin}${window.location.pathname}?invite=${inv.token}\n\nThis link expires in 14 days.`)}`}
                        style={{
                          padding:'5px 9px', fontSize: 11, borderRadius: 6, border:'1px solid var(--line)', background:'var(--paper)', color:'var(--brand)', cursor:'pointer', textDecoration:'none',
                        }}>Email →</a>
                      <button onClick={() => handleRevoke(inv)} style={{
                        padding:'5px 9px', fontSize: 11, borderRadius: 6, border:'1px solid var(--down-soft)', background:'var(--paper)', color:'var(--down)', cursor:'pointer',
                      }}>Revoke</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Section>
  );
}

export default function SettingsView({ state, dispatch, session, portfolioId, role, showToast, themePref, onThemeChange }) {
  const fileRef = useRef(null);
  const [fxLocal, setFxLocal] = useState(state.fx);
  const [apiKey, setApiKeyLocal] = useState(getApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const onImport = async (file) => {
    try {
      const obj = await importJSONFile(file);
      if (confirm(`Import will replace your current data (${state.assets.length} assets → ${obj.assets.length}). Continue?`)) {
        dispatch({ type:'replaceAll', state: obj });
        showToast?.('Portfolio imported successfully.', 'success');
      }
    } catch (e) {
      showToast?.('Import failed: ' + e.message, 'error');
    }
  };

  const handleSaveFx = () => {
    dispatch({ type:'setFx', fx: Object.fromEntries(Object.entries(fxLocal).map(([k,v]) => [k, +v || 1])) });
    showToast?.('Exchange rates saved.', 'success');
  };

  const handleSaveApiKey = () => {
    setApiKey(apiKey);
    setApiKeySaved(true);
    showToast?.('API key saved to this browser.', 'success');
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)', maxWidth: 820 }}>
      <Section title="Appearance" subtitle="Choose how Imari looks. Auto follows your system setting.">
        <div className="row" style={{ gap: 8 }}>
          {[
            { value: 'auto',  label: '⟳ Auto'  },
            { value: 'light', label: '☀ Light' },
            { value: 'dark',  label: '☽ Dark'  },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => onThemeChange?.(t.value)}
              className={`btn ${themePref === t.value ? 'btn-primary' : 'btn-ghost'}`}
              style={{ minWidth: 90 }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          {themePref === 'auto'
            ? 'Currently following your system preference.'
            : themePref === 'dark'
            ? 'Dark mode is active.'
            : 'Light mode is active.'}
        </div>
      </Section>

      <Section title="Profile">
        <Field label="Your name (used in greetings)">
          <input value={state.profile.name} onChange={e => dispatch({ type:'setProfile', patch: { name: e.target.value } })}
            placeholder="e.g. Prince" style={{ ...inputStyle }}/>
        </Field>
        <Field label="Primary display currency" top={14}>
          <select value={state.profile.displayCurrency} onChange={e => dispatch({ type:'setProfile', patch: { displayCurrency: e.target.value } })}
            style={{ ...inputStyle }}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
          </select>
        </Field>
      </Section>

      <MembersSection portfolioId={portfolioId} role={role} session={session} />

      <Section title="AI Advisor" subtitle="Your Anthropic API key powers the AI Advisor and dashboard insights. It's stored only in this browser.">
        <Field label="Anthropic API key" hint="sk-ant-…">
          <div className="row" style={{ gap: 8 }}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKeyLocal(e.target.value)}
              placeholder="sk-ant-api03-…"
              style={{ ...inputStyle, flex: 1, fontFamily:'Geist Mono, monospace' }}
            />
            <button onClick={handleSaveApiKey} className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>
              {apiKeySaved ? '✓ Saved' : 'Save key'}
            </button>
          </div>
        </Field>
        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          Get a key at <strong>console.anthropic.com</strong>. The key never leaves this browser — it's sent directly to the Anthropic API when you use the advisor.
        </div>
      </Section>

      <Section title="Exchange rates" subtitle="Edit if the FX values look off. All amounts convert via these rates.">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 12 }}>
          {CURRENCIES.filter(c => c.code !== 'RWF').map(c => (
            <Field key={c.code} label={`1 ${c.code} = ? RWF`} hint={c.label}>
              <input type="number" value={fxLocal[c.code]} onChange={e => setFxLocal(s => ({ ...s, [c.code]: e.target.value }))}
                style={{ ...inputStyle, fontFamily:'Geist Mono, monospace' }}/>
            </Field>
          ))}
        </div>
        <button onClick={handleSaveFx} className="btn btn-primary" style={{ marginTop: 14 }}>Save FX rates</button>
      </Section>

      <Section title="Backup & restore" subtitle="Export your portfolio as JSON, or import a previously exported file.">
        <div className="row" style={{ gap: 10, flexWrap:'wrap' }}>
          <button onClick={() => exportJSON(state)} className="btn btn-primary">↓ Export to JSON</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost">↑ Import from JSON</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display:'none' }}
            onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </Section>

      <Section title="Danger zone">
        <button onClick={() => {
          if (confirm('Reset to seed assets? Your current data will be replaced.')) dispatch({ type:'reset' });
        }} className="btn btn-ghost">↻ Reset to sample portfolio</button>
        <button onClick={() => {
          if (confirm('Delete ALL your assets? This cannot be undone.')) dispatch({ type:'clearAssets' });
        }} className="btn btn-ghost" style={{ marginLeft: 8, color:'var(--down)', borderColor:'var(--down-soft)' }}>✕ Delete all assets</button>
      </Section>

      <div className="muted" style={{ fontSize: 11, marginTop: 30, padding: 16, background:'var(--bg-2)', borderRadius: 10, lineHeight: 1.55 }}>
        <strong>About Imari Portfolio.</strong> A personal asset & wealth tracker built for Rwanda. When signed in, your data is stored in a Supabase Postgres database protected by Row Level Security, accessible only to you and the members you invite. Passwords are hashed with bcrypt by Supabase Auth.
      </div>
    </div>
  );
}
