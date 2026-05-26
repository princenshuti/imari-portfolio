import { useState, useEffect, useRef } from 'react';
import { CURRENCIES, MILESTONES, LIVE_FX } from '../data.js';
import { useMarket } from '../contexts/MarketContext.jsx';
import { exportJSON, importJSONFile } from '../store.js';
import { getApiKey, setApiKey, hasEnvKey } from '../ai.js';
import { listMembers, listInvitations, createInvitation, revokeInvitation, removeMember, updateMemberRole, isConfigured } from '../cloud.js';
import { Field, inputStyle } from '../components/Field.jsx';
import { MaxventuresBadge } from '../components/MaxventuresLogo.jsx';
import { RowSkeleton } from '../components/Skeleton.jsx';
import { ConfirmDestructive } from '../components/ConfirmDestructive.jsx';

/** Resize + center-crop an image File to a square JPEG data URI. */
async function resizeAvatar(file, px = 160) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx   = (img.width  - side) / 2;
      const sy   = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width  = px;
      canvas.height = px;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, px, px);
      resolve(canvas.toDataURL('image/jpeg', 0.84));
    };
    img.onerror = reject;
    img.src = url;
  });
}

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
    setLoading(true); setError(null);
    // 5-second hard timeout so a silent RPC failure surfaces as "retry" instead
    // of an indefinite skeleton. listMembers/listInvitations can hang quietly
    // when Supabase RLS is misconfigured or the network's flaky.
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out loading members. Please retry.')), 5000)
    );
    try {
      const [m, i] = await Promise.race([
        Promise.all([listMembers(portfolioId), listInvitations(portfolioId)]),
        timeout,
      ]);
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
      try {
        await navigator.clipboard.writeText(link);
        setCopiedToken(inv.token);
        setTimeout(() => setCopiedToken(null), 3000);
      } catch {
        // Clipboard unavailable (http context, permissions) — invite still created, just not auto-copied
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const copyLink = async (token) => {
    const link = `${window.location.origin}${window.location.pathname}?invite=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      setError('Could not copy to clipboard. Long-press the link to copy manually: ' + link);
    }
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

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, background:'var(--down-soft)', color:'var(--down)',
          fontSize: 12.5, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span>{error}</span>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '6px 12px', borderRadius: 6,
              border: '1px solid currentColor', background: 'transparent',
              color: 'var(--down)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {loading ? (
        <RowSkeleton count={3} showAvatar />
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

function MilestoneSection({ profile, dispatch }) {
  const current = profile.milestones?.length ? profile.milestones : MILESTONES;
  const [inputVal, setInputVal] = useState('');

  const save = (list) => dispatch({ type: 'setProfile', patch: { milestones: list } });

  const remove = (m) => save(current.filter(x => x !== m));

  const add = () => {
    const raw = inputVal.replace(/[, ]/g, '');
    // Accept bare numbers (e.g. 50000000) or shorthand like 50M, 10m
    const match = raw.match(/^([\d.]+)\s*([mMbBkK]?)$/);
    if (!match) return;
    let val = parseFloat(match[1]);
    const suffix = match[2].toLowerCase();
    if (suffix === 'm') val *= 1_000_000;
    else if (suffix === 'b') val *= 1_000_000_000;
    else if (suffix === 'k') val *= 1_000;
    val = Math.round(val);
    if (!val || val <= 0) return;
    if (current.includes(val)) { setInputVal(''); return; }
    save([...current, val].sort((a, b) => a - b));
    setInputVal('');
  };

  const reset = () => save(MILESTONES.slice());

  const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B'
    : n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M'
    : n >= 1e3 ? (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K'
    : String(n);

  return (
    <Section title="Net Worth Milestones" subtitle="Celebrate when your net worth crosses these RWF thresholds.">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {current.map(m => (
          <div key={m} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: 'var(--up-soft)', color: 'var(--up)', border: '1px solid var(--up-soft)',
          }}>
            {fmt(m)}
            <button type="button" onClick={() => remove(m)} aria-label={`Remove milestone ${fmt(m)}`} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--up)',
              fontSize: 14, lineHeight: 1, padding: 0, marginTop: -1,
            }}><span aria-hidden="true">×</span></button>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="e.g. 500M or 500000000"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={add} className="btn" style={{
          background: 'var(--up)', color: '#fff', border: 0,
          padding: '8px 16px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 600, fontSize: 13,
        }}>Add</button>
        <button onClick={reset} className="btn btn-ghost" style={{ fontSize: 12 }}>Reset defaults</button>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        Enter shorthand like <strong>10M</strong>, <strong>250M</strong>, <strong>1B</strong> or full numbers. Press Enter or click Add.
      </div>
    </Section>
  );
}

export default function SettingsView({ state, dispatch, session, portfolioId, role, showToast, themePref, onThemeChange }) {
  const fileRef   = useRef(null);
  const avatarRef = useRef(null);
  const [fxLocal, setFxLocal]         = useState(state.fx);
  const [apiKey, setApiKeyLocal]      = useState(getApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  // Danger-zone modal state: 'reset' | 'clear' | null
  const [dangerAction, setDangerAction] = useState(null);
  // BNR rate info derived from the shared MarketContext — no duplicate fetch.
  const { market } = useMarket();
  const bnrInfo = market?.bnrRates
    ? { date: market.fxAsOf, rates: market.bnrRates, source: market.fxSource }
    : null;

  const handleAvatarFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast?.('Please choose an image file.', 'error'); return; }
    setAvatarLoading(true);
    try {
      const dataUrl = await resizeAvatar(file, 160);
      dispatch({ type: 'setProfile', patch: { avatar: dataUrl } });
      showToast?.('Profile photo updated.', 'success');
    } catch (e) {
      showToast?.('Could not process the image: ' + e.message, 'error');
    } finally {
      setAvatarLoading(false);
      if (avatarRef.current) avatarRef.current.value = '';
    }
  };

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

      <Section
        title="Profile"
        subtitle="Your name, photo, and contact details. Stored with your portfolio — only visible to people you invite."
      >
        {/* ── Avatar + name row ── */}
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
          {/* Avatar circle */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => avatarRef.current?.click()}
              title="Click to change photo"
              style={{
                width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
                background: state.profile.avatar
                  ? 'transparent'
                  : 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
                border: '2px solid var(--line)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: 'var(--brand-ink)',
                transition: 'opacity 0.15s',
                boxShadow: 'var(--shadow-1)',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {state.profile.avatar
                ? <img src={state.profile.avatar} alt="Profile photo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : ((state.profile.name || 'Y').split(' ').slice(0,2).map(s => s[0] || '').join('').toUpperCase().slice(0,2) || '?')
              }
            </div>
            {/* Camera badge */}
            <div onClick={() => avatarRef.current?.click()} style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--brand)', color: 'var(--brand-ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, cursor: 'pointer', border: '2px solid var(--paper)',
              boxShadow: 'var(--shadow-1)',
            }}>
              {avatarLoading ? '…' : '📷'}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={e => handleAvatarFile(e.target.files?.[0])} />
          </div>

          {/* Name + email stacked */}
          <div className="col" style={{ flex: 1, gap: 4, minWidth: 0, justifyContent: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)' }}>
              {state.profile.name || 'Your name'}
            </div>
            {session?.user?.email && (
              <div className="muted" style={{ fontSize: 12 }}>{session.user.email}</div>
            )}
            {state.profile.bio && (
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.45 }}>
                {state.profile.bio}
              </div>
            )}
            {state.profile.avatar && (
              <button
                onClick={() => { dispatch({ type:'setProfile', patch: { avatar: null } }); showToast?.('Photo removed.', 'success'); }}
                style={{
                  alignSelf: 'flex-start', marginTop: 4,
                  padding: '3px 9px', borderRadius: 'var(--r-pill)', fontSize: 11, cursor: 'pointer',
                  border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down)',
                }}
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* ── Identity fields ── */}
        <Field label="Display name">
          <input value={state.profile.name}
            onChange={e => dispatch({ type:'setProfile', patch: { name: e.target.value } })}
            placeholder="e.g. Prince Nshuti" style={{ ...inputStyle }} />
        </Field>

        <Field label="Primary display currency" top={14}>
          <select value={state.profile.displayCurrency}
            onChange={e => dispatch({ type:'setProfile', patch: { displayCurrency: e.target.value } })}
            style={{ ...inputStyle }}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
          </select>
        </Field>

        <Field label="Short bio" top={14}>
          <textarea
            value={state.profile.bio || ''}
            onChange={e => dispatch({ type:'setProfile', patch: { bio: e.target.value } })}
            placeholder="e.g. Entrepreneur & investor based in Kigali"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', paddingTop: 8, lineHeight: 1.5 }}
          />
        </Field>

        {/* ── Contact information ── */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '0.5px solid var(--line)' }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 14 }}>
            Contact information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Phone number">
              <input
                type="tel"
                value={state.profile.phone || ''}
                onChange={e => dispatch({ type:'setProfile', patch: { phone: e.target.value } })}
                placeholder="+250 7XX XXX XXX"
                style={{ ...inputStyle }}
              />
            </Field>
            <Field label="Location">
              <input
                value={state.profile.location || ''}
                onChange={e => dispatch({ type:'setProfile', patch: { location: e.target.value } })}
                placeholder="e.g. Kigali, Rwanda"
                style={{ ...inputStyle }}
              />
            </Field>
          </div>
        </div>
      </Section>

      <MembersSection portfolioId={portfolioId} role={role} session={session} />

      <Section
        title="AI Advisor"
        subtitle={hasEnvKey
          ? 'AI Advisor is enabled for all users via a shared key managed by the app owner.'
          : 'Your Anthropic API key powers the AI Advisor and dashboard insights.'}
      >
        {hasEnvKey ? (
          /* ── Shared env key is active ─ no user input needed ─── */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', borderRadius: 10,
            background: 'color-mix(in oklab, var(--up) 10%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--up) 22%, transparent)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: 'var(--up)',
              flexShrink: 0, animation: 'imari-dot-pulse 2.4s ease-in-out infinite',
            }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--up)' }}>
                AI Advisor is active
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
                A shared API key is configured for this deployment — you don't need to enter anything.
                All users on this app can access the AI Advisor automatically.
              </div>
            </div>
          </div>
        ) : (
          /* ── No env key — user must supply their own ─────────── */
          <>
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
              Get a key at <strong>console.anthropic.com</strong>.
              The key is stored only in this browser — it's sent directly to the Anthropic API.
            </div>
          </>
        )}
      </Section>

      <Section title="Exchange rates" subtitle="Auto-synced daily from the National Bank of Rwanda. Your manual values below are used only as a fallback.">
        {bnrInfo?.date && bnrInfo?.source === 'bnr' && (
          <div style={{
            display:'flex', alignItems:'center', gap:10, marginBottom:14,
            padding:'10px 14px', borderRadius:10,
            background:'color-mix(in oklab, var(--up) 10%, var(--paper))',
            border:'1px solid color-mix(in oklab, var(--up) 22%, transparent)',
          }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--up)', flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--up)' }}>
                BNR rates · as of {bnrInfo.date}
              </div>
              <div className="muted" style={{ fontSize:11, marginTop:4, fontFamily:'Geist Mono, monospace' }}>
                {Object.entries(bnrInfo.rates).map(([c, r]) =>
                  `${c}: buy ${r.buy.toFixed(2)} / sell ${r.sell.toFixed(2)}`
                ).join('  ·  ')}
              </div>
              <div className="muted" style={{ fontSize:10, marginTop:4, lineHeight:1.5 }}>
                Buying rate values foreign → RWF · selling rate values RWF → foreign.
              </div>
            </div>
          </div>
        )}
        {bnrInfo?.source && bnrInfo.source !== 'bnr' && (
          <div className="muted" style={{ fontSize:11, marginBottom:14 }}>
            BNR feed unavailable — using {bnrInfo.source} as fallback.
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 12 }}>
          {CURRENCIES.filter(c => c.code !== 'RWF').map(c => (
            <Field key={c.code} label={`1 ${c.code} = ? RWF`} hint={`${c.label} · manual override`}>
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

      <MilestoneSection profile={state.profile} dispatch={dispatch} />

      <Section title="Tax & Reporting" subtitle="View your estimated Rwanda tax liability and capital gains breakdown.">
        <div className="row" style={{ gap: 10 }}>
          <button onClick={() => onNav?.('tax')} className="btn btn-ghost">§ Open Tax Report</button>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          Calculates estimated CGT and withholding tax per asset using Rwanda RRA rules. Printable as PDF.
        </div>
      </Section>

      <Section title="Danger zone">
        <button onClick={() => setDangerAction('reset')} className="btn btn-ghost">↻ Reset to sample portfolio</button>
        <button onClick={() => setDangerAction('clear')} className="btn btn-danger" style={{ marginLeft: 8 }}>✕ Delete all assets</button>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          Both actions are irreversible. Deleting requires typing <strong style={{ fontFamily: 'monospace', color: 'var(--down)' }}>DELETE</strong> to confirm.
        </div>
      </Section>

      <ConfirmDestructive
        open={dangerAction === 'reset'}
        onClose={() => setDangerAction(null)}
        onConfirm={() => { dispatch({ type: 'reset' }); setDangerAction(null); showToast?.('Portfolio reset to sample data.', 'success'); }}
        title="Reset to sample portfolio?"
        description={
          <span>
            Your current data ({state.assets.length} assets, {(state.liabilities||[]).length} liabilities,
            {' '}{(state.goals||[]).length} goals) will be replaced with the demo seed.
            <br />Type <strong style={{ fontFamily: 'monospace' }}>DELETE</strong> to confirm.
          </span>
        }
        confirmLabel="Reset everything"
        requireType="DELETE"
      />
      <ConfirmDestructive
        open={dangerAction === 'clear'}
        onClose={() => setDangerAction(null)}
        onConfirm={() => { dispatch({ type: 'clearAssets' }); setDangerAction(null); showToast?.('All assets deleted.', 'success'); }}
        title="Delete ALL your assets?"
        description={
          <span>
            All <strong style={{ color: 'var(--ink)' }}>{state.assets.length}</strong> assets will be permanently removed
            from your portfolio. Liabilities, goals, and cashflows are kept.
            <br />Type <strong style={{ fontFamily: 'monospace' }}>DELETE</strong> to confirm.
          </span>
        }
        confirmLabel="Delete all assets"
        requireType="DELETE"
      />

      {/* About / brand footer */}
      <div style={{ marginTop: 30, padding: 20, background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', lineHeight: 1.55 }}>
        {/* Maxventures badge */}
        <div style={{ marginBottom: 14 }}>
          <MaxventuresBadge height={32} />
        </div>
        <div style={{ height: '0.5px', background: 'var(--line)', marginBottom: 14 }} />
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Imari</strong> is a personal asset &amp; wealth tracker built for Rwanda,
          by <strong style={{ color: 'var(--ink-2)' }}>Maxventures</strong> — Innovative Solutions, Limitless Possibilities.
          When signed in, your data is stored in a Supabase Postgres database protected by Row Level Security,
          accessible only to you and the members you invite.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 10.5, color: 'var(--ink-4)' }}>
          © {new Date().getFullYear()} Maxventures · All rights reserved
        </p>
      </div>
    </div>
  );
}
