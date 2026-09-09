import { useState, useEffect, useRef } from 'react';
import { CURRENCIES, MILESTONES, LIVE_FX, fmtNum, INCOME_CATEGORIES, EXPENSE_CATEGORIES, id as newId } from '../data.js';
import { isValidRule } from '../engine/catRules.js';
import { GLOSSARY } from '../glossary.js';
import Explain from '../components/Explain.jsx';
import { FEATURE_MODULES, isFeatureEnabled } from '../features.js';
import { useMarket } from '../contexts/MarketContext.jsx';
import { useT, SUPPORTED_LOCALES } from '../contexts/I18nContext.jsx';
import { exportJSON, importJSONFile } from '../store.js';
import { getApiKey, setApiKey, hasEnvKey } from '../ai.js';
import { listMembers, listInvitations, createInvitation, revokeInvitation, removeMember, updateMemberRole, sendInvitationEmail, isConfigured, MAX_INVITES } from '../cloud.js';
import PortfolioChat from '../components/PortfolioChat.jsx';
import { Reveal } from '../components/motion.jsx';
import { Field, inputStyle } from '../components/Field.jsx';
import { MaxventuresBadge } from '../components/MaxventuresLogo.jsx';
import { RowSkeleton } from '../components/Skeleton.jsx';
import { ConfirmDestructive } from '../components/ConfirmDestructive.jsx';

import { tx } from '../i18n/tx.js';

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
    <Reveal style={{ marginBottom: 28 }}>
      <div className="font-serif" style={{ fontSize: 22, marginBottom: subtitle ? 4 : 14 }}>{title}</div>
      {subtitle && <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.5, maxWidth: 600 }}>{subtitle}</div>}
      <div className="card" style={{ padding: 22 }}>{children}</div>
    </Reveal>
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
  const [resendingId, setResendingId] = useState(null);
  const [resentId, setResentId] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [memberAction, setMemberAction] = useState(null); // {kind:'remove',member} | {kind:'revoke',inv}

  const refresh = async () => {
    setLoading(true); setError(null);
    // 5-second hard timeout so a silent RPC failure surfaces as "retry" instead
    // of an indefinite skeleton. listMembers/listInvitations can hang quietly
    // when Supabase RLS is misconfigured or the network's flaky.
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(tx('Timed out loading members. Please retry.'))), 5000)
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
    setBusy(true); setError(null); setInfo(null);
    const targetEmail = email.trim().toLowerCase();
    try {
      const inv = await createInvitation(portfolioId, email, inviteRole);
      setEmail('');
      await refresh();
      setInfo(tx('Invitation email sent to {0}.', [targetEmail]));
      setTimeout(() => setInfo(null), 4000);
      // Best-effort: also copy the link to clipboard for the owner's convenience.
      const link = `${window.location.origin}${window.location.pathname}?invite=${inv.token}`;
      try {
        await navigator.clipboard.writeText(link);
        setCopiedToken(inv.token);
        setTimeout(() => setCopiedToken(null), 3000);
      } catch { /* clipboard unavailable — no-op */ }
    } catch (e) {
      setError(e.message);
      // If the row was created but email failed, refresh so the new pending
      // invite shows up and the owner can "Resend" or copy the link.
      if (e.invitation) { setEmail(''); await refresh(); }
    }
    finally { setBusy(false); }
  };

  const handleResend = async (inv) => {
    setResendingId(inv.id); setError(null); setInfo(null);
    try {
      await sendInvitationEmail(inv.id);
      setResentId(inv.id);
      setTimeout(() => setResentId(null), 2500);
    } catch (e) { setError(tx('Could not resend: {0}', [e.message])); }
    finally { setResendingId(null); }
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

  // Both run through ConfirmDestructive (consistent with every other
  // irreversible action) instead of native confirm().
  const handleRemove = (member) => setMemberAction({ kind: 'remove', member });
  const handleRevoke = (inv) => setMemberAction({ kind: 'revoke', inv });
  const confirmMemberAction = async () => {
    const act = memberAction;
    setMemberAction(null);
    if (!act) return;
    try {
      if (act.kind === 'remove') await removeMember(act.member.id);
      else await revokeInvitation(act.inv.id);
      await refresh();
    } catch (e) { setError(e.message); }
  };

  if (!isConfigured || !portfolioId) return null;
  const isOwner = role === 'owner';
  // Invite usage (B3): owner + MAX_INVITES invited members. Counts non-owner
  // members + pending invitations; the form disables at the cap.
  const invitedCount = members.filter(m => m.role !== 'owner').length + invitations.length;
  const atCap = invitedCount >= MAX_INVITES;

  return (
    (<Section
      title={tx('Members')}
      subtitle={isOwner
        ? tx(
        'Invite people by email — they\'ll get a message with an accept link. Editors can add and update assets. Viewers can see your portfolio but not modify it.'
      )
        : tx(
        'You can view who has access to this portfolio. Only the owner can invite or remove members.'
      )}
    >
      {isOwner && (
        <>
          <form onSubmit={invite} className="row" style={{ gap: 8, marginBottom: atCap ? 8 : 18 }}>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              disabled={atCap}
              placeholder={tx('invite-friend@example.com')} style={{ ...inputStyle, flex: 1, opacity: atCap ? 0.55 : 1 }} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} disabled={atCap} style={{ ...inputStyle, width: 130, opacity: atCap ? 0.55 : 1 }}>
              <option value="editor">{tx('Editor')}</option>
              <option value="viewer">{tx('Viewer')}</option>
            </select>
            <button type="submit" disabled={busy || atCap} className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>
              {busy ? tx('Sending…') : tx('＋ Send invite')}
            </button>
          </form>
          <div className="muted" style={{ fontSize: 11, marginBottom: 18 }}>
            {atCap
              ? tx(
              '{0} of {1} member slots used — remove someone or revoke a pending invite to add another.',
              [invitedCount, MAX_INVITES]
            )
              : tx('{0} of {1} member slots used.', [invitedCount, MAX_INVITES])}
          </div>
        </>
      )}
      {info && (
        <div style={{
          padding: 10, borderRadius: 8, background:'var(--up-soft, #e6f4ea)', color:'var(--up, #1b6e2c)',
          fontSize: 12.5, marginBottom: 14,
        }}>
          {info}
        </div>
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
            {loading ? tx('Retrying…') : tx('Retry')}
          </button>
        </div>
      )}
      {loading ? (
        <RowSkeleton count={3} showAvatar />
      ) : (
        <>
          <div className="muted" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 8 }}>
            {tx('Members (')}{members.length})
                      </div>
          <div className="col" style={{ gap: 6, marginBottom: 18 }}>
            {members.map(m => (
              <div key={m.id} className="row" style={{ padding: '10px 12px', borderRadius: 8, background:'var(--bg-2)', justifyContent:'space-between', gap: 10 }}>
                <div className="col" style={{ minWidth: 0, gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {m.email}{m.user_id === session?.user?.id && <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>{tx('(you)')}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11, textTransform:'capitalize' }}>{m.role}</div>
                </div>
                {isOwner && m.role !== 'owner' && (
                  <div className="row" style={{ gap: 6 }}>
                    <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)} style={{
                      padding:'5px 8px', fontSize: 11, borderRadius: 6, border:'1px solid var(--line)', background:'var(--paper)', fontFamily:'inherit',
                    }}>
                      <option value="editor">{tx('Editor')}</option>
                      <option value="viewer">{tx('Viewer')}</option>
                    </select>
                    <button onClick={() => handleRemove(m)} className="btn-unstyled" style={{
                      padding:'8px 12px', minHeight: 32, fontSize: 11, borderRadius: 6, border:'1px solid var(--down-soft)', background:'var(--paper)', color:'var(--down-ink)',
                    }}>{tx('Remove')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isOwner && invitations.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 8 }}>
                {tx('Pending invitations (')}{invitations.length})
                              </div>
              <div className="col" style={{ gap: 6 }}>
                {invitations.map(inv => (
                  <div key={inv.id} className="row" style={{ padding: '10px 12px', borderRadius: 8, background:'var(--gold-soft)', justifyContent:'space-between', gap: 10 }}>
                    <div className="col" style={{ minWidth: 0, gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{inv.email}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {inv.role} {tx('· expires')} {new Date(inv.expires_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button onClick={() => copyLink(inv.token)} className="btn-unstyled" style={{
                        padding:'8px 12px', minHeight: 32, fontSize: 11, borderRadius: 6, border:'1px solid var(--line)', background:'var(--paper)', color:'var(--ink-2)',
                      }}>{copiedToken === inv.token ? tx('✓ Copied') : tx('Copy link')}</button>
                      <button
                        onClick={() => handleResend(inv)}
                        disabled={resendingId === inv.id}
                        className="btn-unstyled"
                        style={{
                          padding:'8px 12px', minHeight: 32, fontSize: 11, borderRadius: 6,
                          border:'1px solid var(--line)', background:'var(--paper)',
                          color: resentId === inv.id ? 'var(--up-ink)' : 'var(--brand)',
                          cursor: resendingId === inv.id ? 'default' : 'pointer',
                          opacity: resendingId === inv.id ? 0.6 : 1,
                        }}
                      >
                        {resendingId === inv.id ? tx('Sending…') : resentId === inv.id ? tx('✓ Sent') : tx('Resend email')}
                      </button>
                      <button onClick={() => handleRevoke(inv)} className="btn-unstyled" style={{
                        padding:'8px 12px', minHeight: 32, fontSize: 11, borderRadius: 6, border:'1px solid var(--down-soft)', background:'var(--paper)', color:'var(--down-ink)',
                      }}>{tx('Revoke')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {/* B4 — in-portfolio member chat (realtime, members only) */}
      {portfolioId && <PortfolioChat portfolioId={portfolioId} session={session} />}
      <ConfirmDestructive
        open={!!memberAction}
        onClose={() => setMemberAction(null)}
        onConfirm={confirmMemberAction}
        title={memberAction?.kind === 'remove' ? tx('Remove this member?') : tx('Revoke this invitation?')}
        description={
          memberAction?.kind === 'remove' ? (
            <span>
              <strong style={{ color: 'var(--ink)' }}>{memberAction.member.email}</strong> {tx(
                'loses access\n              to this portfolio immediately. You can re-invite them later.'
              )}
            </span>
          ) : (
            <span>
              {tx('The pending invite for')} <strong style={{ color: 'var(--ink)' }}>{memberAction?.inv?.email}</strong>
              {' '}{tx('stops working immediately.')}
            </span>
          )
        }
        confirmLabel={memberAction?.kind === 'remove' ? tx('Remove member') : tx('Revoke invite')}
      />
    </Section>)
  );
}

function MilestoneSection({ profile, dispatch, showToast }) {
  const current = profile.milestones?.length ? profile.milestones : MILESTONES;
  const [inputVal, setInputVal] = useState('');

  const save = (list) => dispatch({ type: 'setProfile', patch: { milestones: list } });

  // Remove + Undo: small × on a milestone pill is easy to mis-tap. Show a
  // Snackbar-style toast with an Undo button that restores the milestone.
  // (UX review #32.)
  const remove = (m) => {
    const next = current.filter(x => x !== m);
    save(next);
    showToast?.(tx('Removed {0} milestone.', [fmt(m)]), 'info', {
      action: { label: tx('Undo'), onClick: () => save([...next, m].sort((a, b) => a - b)) },
    });
  };

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

  // Floor (never round up) the milestone chip label.
  const fmt = (n) => `${fmtNum(n / (n >= 1e9 ? 1e9 : n >= 1e6 ? 1e6 : n >= 1e3 ? 1e3 : 1), 1)}${n >= 1e9 ? 'B' : n >= 1e6 ? 'M' : n >= 1e3 ? 'K' : ''}`;

  return (
    (<Section title={tx('Net Worth Milestones')} subtitle={tx('Celebrate when your net worth crosses these RWF thresholds.')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {current.map(m => (
          <div key={m} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: 'var(--up-soft)', color: 'var(--up)', border: '1px solid var(--up-soft)',
          }}>
            {fmt(m)}
            <button type="button" onClick={() => remove(m)} aria-label={tx('Remove milestone {0}', [fmt(m)])} style={{
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
          placeholder={tx('e.g. 500M or 500000000')}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={add} className="btn" style={{
          background: 'var(--up)', color: '#fff', border: 0,
          padding: '8px 16px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 600, fontSize: 13,
        }}>{tx('Add')}</button>
        <button onClick={reset} className="btn btn-ghost" style={{ fontSize: 12 }}>{tx('Reset defaults')}</button>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        {tx('Enter shorthand like')} <strong>10M</strong>, <strong>250M</strong>, <strong>1B</strong> {tx('or full numbers. Press Enter or click Add.')}
      </div>
    </Section>)
  );
}

// §10 Diaspora waitlist. MoMo SMS auto-sync (§3) and WhatsApp quick-entry (§4)
// are deferred to the mobile app — neither is reachable from a PWA (browsers
// can't read SMS; WhatsApp Business provisioning is tied to the mobile lifecycle).
// Progressive features — the menu grows with the user's financial life.
// Modules turn on automatically when their data appears; this panel gives
// explicit control (force on to explore, force off to declutter).
function FeaturesSection({ state, dispatch }) {
  const features = state.profile.features || {};
  const setFeature = (key, val) =>
    dispatch({ type: 'setProfile', patch: { features: { ...features, [key]: val } } });
  const resetFeature = (key) => {
    const { [key]: _, ...rest } = features;
    dispatch({ type: 'setProfile', patch: { features: rest } });
  };

  return (
    (<Section title={tx('Features')} subtitle={tx(
      'Imari starts simple and switches features on when you add related data. Force any of them on or off here — hidden features stay reachable via search and links.'
    )}>
      <div className="col" style={{ gap: 8 }}>
        {FEATURE_MODULES.filter(m => !m.gated).map(m => {
          const explicit = features[m.key];
          const on = isFeatureEnabled(state, m.key);
          return (
            (<div key={m.key} className="row" style={{ gap: 10, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{tx(m.label)}</span>
                  {explicit === undefined && (
                    <span className="pill pill-soft" style={{ fontSize: 10 }} title={tx('Switches on automatically when you add related data')}>auto</span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>{tx(m.hint)}</div>
              </div>
              <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                {explicit !== undefined && (
                  <button type="button" className="btn-link" style={{ fontSize: 11 }} onClick={() => resetFeature(m.key)}>
                    {tx('reset to auto')}
                  </button>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${m.label}: ${on ? 'enabled' : 'disabled'}`}
                  onClick={() => setFeature(m.key, !on)}
                  className={`btn ${on ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minWidth: 64, padding: '6px 12px', fontSize: 12 }}
                >
                  {on ? tx('On') : tx('Off')}
                </button>
              </div>
            </div>)
          );
        })}
      </div>
    </Section>)
  );
}

// F5 — user-defined categorisation rules: "when a description contains X,
// categorise as Y". Applied before the AI pass on statement imports, so the
// user's explicit word always wins (and costs nothing).
function CatRulesSection({ catRules, dispatch, showToast }) {
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState('food');
  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const labelOf = (cid) => allCats.find(c => c.id === cid)?.label || cid;

  const add = () => {
    const rule = { id: newId(), pattern: pattern.trim(), category };
    if (!isValidRule(rule)) {
      showToast?.(tx('Rule needs at least 2 characters to match on.'), 'error');
      return;
    }
    dispatch({ type: 'upsertCatRule', rule });
    setPattern('');
  };

  const remove = (rule) => {
    dispatch({ type: 'deleteCatRule', id: rule.id });
    showToast?.(tx('Removed the "{0}" rule.', [rule.pattern]), 'info', {
      action: { label: tx('Undo'), onClick: () => dispatch({ type: 'upsertCatRule', rule }) },
    });
  };

  return (
    (<Section title={tx('Categorisation rules')} subtitle={tx(
      'When an imported description contains your text, Imari files it under your category — before any AI guess.'
    )}>
      {catRules.length > 0 && (
        <div className="col" style={{ gap: 6, marginBottom: 14 }}>
          {catRules.map(r => (
            <div key={r.id} className="row" style={{ gap: 10, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8, justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                contains <strong>“{r.pattern}”</strong>
                <span className="muted"> → </span>
                <span style={{ fontWeight: 600 }}>{labelOf(r.category)}</span>
              </div>
              <button type="button" onClick={() => remove(r)} className="btn-icon-sm" aria-label={tx('Delete rule for {0}', [r.pattern])}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder={tx('Description contains… e.g. "MTN" or "Vision City"')}
          aria-label={tx('Text the description must contain')}
          style={{ ...inputStyle, flex: 2, minWidth: 180 }}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label={tx('Category to apply')} style={{ ...inputStyle, flex: 1, minWidth: 140 }}>
          <optgroup label={tx('Expense')}>
            {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{tx(c.label)}</option>)}
          </optgroup>
          <optgroup label={tx('Income')}>
            {INCOME_CATEGORIES.map(c => <option key={c.id} value={c.id}>{tx(c.label)}</option>)}
          </optgroup>
        </select>
        <button type="button" onClick={add} className="btn btn-primary">{tx('Add rule')}</button>
      </div>
      {catRules.length === 0 && (
        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          {tx(
            'No rules yet. Every statement line your rules would have caught is one you\'ll re-categorise by hand — teach Imari once, it files them forever.'
          )}
        </div>
      )}
    </Section>)
  );
}

function ConnectionsSection({ profile, dispatch }) {
  const set = (patch) => dispatch({ type: 'setProfile', patch });
  const onWaitlist = !!profile.diasporaWaitlist;
  const card = { padding: '12px 14px', borderRadius: 10, background: 'var(--bg-2)', border: '0.5px solid var(--line)' };
  const flag = { fontSize: 10.5, color: 'var(--gold-ink, var(--gold))', marginTop: 6 };

  return (
    (<Section title={tx('Connections & sync')} subtitle={tx('Diaspora oversight tier and account-level integrations.')}>
      {/* §10 Diaspora Oversight waitlist */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{tx('Diaspora Oversight (≈ $9.99/mo)')}</div>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 8, lineHeight: 1.5 }}>
          {tx(
            'Read-only trustee access, twice-monthly “State of Your Rwanda Assets” PDF, accountant export pack, document vault, USD/EUR/GBP display. Free core stays fully functional.'
          )}
        </div>
        <button type="button" onClick={() => set({ diasporaWaitlist: !onWaitlist })}
          className={onWaitlist ? 'btn btn-ghost' : 'btn btn-primary'} style={{ fontSize: 12 }}>
          {onWaitlist ? tx('✓ On the waitlist — leave') : tx('Join the waitlist')}
        </button>
        <div style={flag}>{tx(
          '⚠ Billing is handled by the payment processor — Imari never stores card data or auto-charges.'
        )}</div>
      </div>
    </Section>)
  );
}

export default function SettingsView({ state, dispatch, session, portfolioId, role, showToast, themePref, onThemeChange }) {
  // Bound i18n controller (t/locale/setLocale). Naming `i18n` not `t` to
  // avoid shadowing the per-pill loop variable used in this file.
  const i18n = useT();
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
    if (!file.type.startsWith('image/')) { showToast?.(tx('Please choose an image file.'), 'error'); return; }
    setAvatarLoading(true);
    try {
      const dataUrl = await resizeAvatar(file, 160);
      dispatch({ type: 'setProfile', patch: { avatar: dataUrl } });
      showToast?.(tx('Profile photo updated.'), 'success');
    } catch (e) {
      showToast?.('Could not process the image: ' + e.message, 'error');
    } finally {
      setAvatarLoading(false);
      if (avatarRef.current) avatarRef.current.value = '';
    }
  };

  const [pendingJsonImport, setPendingJsonImport] = useState(null);
  const onImport = async (file) => {
    try {
      // Replacing the entire portfolio is the most destructive action in the
      // app — it gets the typed-confirmation dialog, not a native confirm().
      setPendingJsonImport(await importJSONFile(file));
    } catch (e) {
      showToast?.('Import failed: ' + e.message, 'error');
    }
  };

  const handleSaveFx = () => {
    dispatch({ type:'setFx', fx: Object.fromEntries(Object.entries(fxLocal).map(([k,v]) => [k, +v || 1])) });
    showToast?.(tx('Exchange rates saved.'), 'success');
  };

  const handleSaveApiKey = () => {
    setApiKey(apiKey);
    setApiKeySaved(true);
    showToast?.(tx('API key saved to this browser.'), 'success');
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  return (
    (<div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)', maxWidth: 820 }}>
      <Section title={i18n.t('settings.appearance_title')} subtitle={tx('Choose how Imari looks. Auto follows your system setting.')}>
        <div className="row" style={{ gap: 8 }}>
          {[
            { value: 'auto',  label: `⟳ ${i18n.t('settings.theme_auto')}`  },
            { value: 'light', label: `☀ ${i18n.t('settings.theme_light')}` },
            { value: 'dark',  label: `☽ ${i18n.t('settings.theme_dark')}`  },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => onThemeChange?.(opt.value)}
              aria-pressed={themePref === opt.value}
              className={`btn ${themePref === opt.value ? 'btn-primary' : 'btn-ghost'}`}
              style={{ minWidth: 90 }}
            >
              {tx(opt.label)}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          {themePref === 'auto'
            ? tx('Currently following your system preference.')
            : themePref === 'dark'
            ? tx('Dark mode is active.')
            : tx('Light mode is active.')}
        </div>

        {/* Locale switcher — UX review #53. Persists to profile.locale so it
            syncs across devices via cloud profile. */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '0.5px solid var(--line)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{i18n.t('settings.locale_label')}</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {SUPPORTED_LOCALES.map(loc => (
              <button
                key={loc.code}
                onClick={() => i18n.setLocale(loc.code)}
                aria-pressed={i18n.locale === loc.code}
                className={`btn ${i18n.locale === loc.code ? 'btn-primary' : 'btn-ghost'}`}
                style={{ minWidth: 110 }}
              >
                {loc.nativeName}
              </button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
            {i18n.t('settings.locale_hint')}
          </div>
        </div>
      </Section>
      <Section
        title={tx('Profile')}
        subtitle={tx(
          'Your name, photo, and contact details. Stored with your portfolio — only visible to people you invite.'
        )}
      >
        {/* ── Avatar + name row ── */}
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
          {/* Avatar circle */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => avatarRef.current?.click()}
              title={tx('Click to change photo')}
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
                ? <img src={state.profile.avatar} alt={tx('Profile photo')}
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
              {state.profile.name || tx('Your name')}
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
                onClick={() => { dispatch({ type:'setProfile', patch: { avatar: null } }); showToast?.(tx('Photo removed.'), 'success'); }}
                style={{
                  alignSelf: 'flex-start', marginTop: 4,
                  padding: '3px 9px', borderRadius: 'var(--r-pill)', fontSize: 11, cursor: 'pointer',
                  border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down)',
                }}
              >
                {tx('Remove photo')}
              </button>
            )}
          </div>
        </div>

        {/* ── Identity fields ── */}
        <Field label={tx('Display name')}>
          <input value={state.profile.name}
            onChange={e => dispatch({ type:'setProfile', patch: { name: e.target.value } })}
            placeholder={tx('e.g. Prince Nshuti')} style={{ ...inputStyle }} />
        </Field>

        <Field label={tx('Primary display currency')} top={14}>
          <select value={state.profile.displayCurrency}
            onChange={e => dispatch({ type:'setProfile', patch: { displayCurrency: e.target.value } })}
            style={{ ...inputStyle }}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {tx(c.label)}</option>)}
          </select>
        </Field>

        <Field label={tx('Short bio')} top={14}>
          <textarea
            value={state.profile.bio || ''}
            onChange={e => dispatch({ type:'setProfile', patch: { bio: e.target.value } })}
            placeholder={tx('e.g. Entrepreneur & investor based in Kigali')}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', paddingTop: 8, lineHeight: 1.5 }}
          />
        </Field>

        {/* ── Contact information ── */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '0.5px solid var(--line)' }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 14 }}>
            {tx('Contact information')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label={tx('Phone number')}>
              <input
                type="tel"
                value={state.profile.phone || ''}
                onChange={e => dispatch({ type:'setProfile', patch: { phone: e.target.value } })}
                placeholder={tx('+250 7XX XXX XXX')}
                style={{ ...inputStyle }}
              />
            </Field>
            <Field label={tx('Location')}>
              <input
                value={state.profile.location || ''}
                onChange={e => dispatch({ type:'setProfile', patch: { location: e.target.value } })}
                placeholder={tx('e.g. Kigali, Rwanda')}
                style={{ ...inputStyle }}
              />
            </Field>
          </div>
        </div>
      </Section>
      <MembersSection portfolioId={portfolioId} role={role} session={session} />
      <ConnectionsSection profile={state.profile} dispatch={dispatch} />
      <Section
        title={tx('AI Advisor')}
        subtitle={hasEnvKey
          ? tx(
          'AI Advisor is enabled for all users via a shared key managed by the app owner.'
        )
          : tx('Your Anthropic API key powers the AI Advisor and dashboard insights.')}
      >
        {hasEnvKey ? (
          /* ── Shared env key is active ─ no user input needed ─── */
          (<div style={{
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
                {tx('AI Advisor is active')}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
                {tx(
                  'A shared API key is configured for this deployment — you don\'t need to enter anything.\n                All users on this app can access the AI Advisor automatically.'
                )}
              </div>
            </div>
          </div>)
        ) : (
          /* ── No env key — user must supply their own ─────────── */
          (<>
            <Field label={tx('Anthropic API key')} hint={tx('sk-ant-…')}>
              <div className="row" style={{ gap: 8 }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKeyLocal(e.target.value)}
                  placeholder={tx('sk-ant-api03-…')}
                  style={{ ...inputStyle, flex: 1, fontFamily:'Geist Mono, monospace' }}
                />
                <button onClick={handleSaveApiKey} className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>
                  {apiKeySaved ? tx('✓ Saved') : tx('Save key')}
                </button>
              </div>
            </Field>
            <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
              {tx('Get a key at')} <strong>{tx('console.anthropic.com')}</strong>{tx(
                '.\n              The key is stored only in this browser — it\'s sent directly to the Anthropic API.'
              )}
            </div>
          </>)
        )}
      </Section>
      <Section title={tx('Exchange rates')} subtitle={tx(
        'Auto-synced daily from the National Bank of Rwanda. Your manual values below are used only as a fallback.'
      )}>
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
                {tx('BNR rates · as of')} {bnrInfo.date}
              </div>
              <div className="muted" style={{ fontSize:11, marginTop:4, fontFamily:'Geist Mono, monospace' }}>
                {Object.entries(bnrInfo.rates).map(([c, r]) =>
                  `${c}: buy ${fmtNum(r.buy, 2)} / sell ${fmtNum(r.sell, 2)}`
                ).join('  ·  ')}
              </div>
              <div className="muted" style={{ fontSize:10, marginTop:4, lineHeight:1.5 }}>
                {tx('Buying rate values foreign → RWF · selling rate values RWF → foreign.')}
              </div>
            </div>
          </div>
        )}
        {bnrInfo?.source && bnrInfo.source !== 'bnr' && (
          <div className="muted" style={{ fontSize:11, marginBottom:14 }}>
            {tx('BNR feed unavailable — using')} {bnrInfo.source} {tx('as fallback.')}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 12 }}>
          {CURRENCIES.filter(c => c.code !== 'RWF').map(c => (
            <Field key={c.code} label={tx('1 {0} = ? RWF', [c.code])} hint={tx('{0} · manual override', [c.label])}>
              <input type="number" value={fxLocal[c.code]} onChange={e => setFxLocal(s => ({ ...s, [c.code]: e.target.value }))}
                style={{ ...inputStyle, fontFamily:'Geist Mono, monospace' }}/>
            </Field>
          ))}
        </div>
        <button onClick={handleSaveFx} className="btn btn-primary" style={{ marginTop: 14 }}>{tx('Save FX rates')}</button>
      </Section>
      <Section title={tx('Backup & restore')} subtitle={tx('Export your portfolio as JSON, or import a previously exported file.')}>
        <div className="row" style={{ gap: 10, flexWrap:'wrap' }}>
          <button onClick={() => exportJSON(state)} className="btn btn-primary">{tx('↓ Export to JSON')}</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost">{tx('↑ Import from JSON')}</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display:'none' }}
            onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </Section>
      <MilestoneSection profile={state.profile} dispatch={dispatch} showToast={showToast} />
      <FeaturesSection state={state} dispatch={dispatch} />
      <CatRulesSection catRules={state.catRules || []} dispatch={dispatch} showToast={showToast} />
      {/* F9 — the full glossary; the same explainers surface inline under insights. */}
      <Section title={tx('Glossary')} subtitle={tx('The terms Imari\'s insights use, in plain language. Tap one to read it.')}>
        <Explain entries={Object.entries(GLOSSARY).map(([gid, e]) => ({ id: gid, ...e }))} />
      </Section>
      <Section title={tx('Tax & Reporting')} subtitle={tx('View your estimated Rwanda tax liability and capital gains breakdown.')}>
        <div className="row" style={{ gap: 10 }}>
          <button onClick={() => onNav?.('tax')} className="btn btn-ghost">{tx('§ Open Tax Report')}</button>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          {tx(
            'Calculates estimated CGT and withholding tax per asset using Rwanda RRA rules. Printable as PDF.'
          )}
        </div>
      </Section>
      <Section title={tx('Danger zone')}>
        <button onClick={() => setDangerAction('reset')} className="btn btn-ghost">{tx('↻ Reset to sample portfolio')}</button>
        <button onClick={() => setDangerAction('clear')} className="btn btn-danger" style={{ marginLeft: 8 }}>{tx('✕ Delete all assets')}</button>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          {tx('Both actions are irreversible. Deleting requires typing')} <strong style={{ fontFamily: 'monospace', color: 'var(--down)' }}>DELETE</strong> {tx('to confirm.')}
        </div>
      </Section>
      <ConfirmDestructive
        open={dangerAction === 'reset'}
        onClose={() => setDangerAction(null)}
        onConfirm={() => { dispatch({ type: 'reset' }); setDangerAction(null); showToast?.(tx('Portfolio reset to sample data.'), 'success'); }}
        title={tx('Reset to sample portfolio?')}
        description={
          <span>
            {tx('Your current data (')}{state.assets.length} {tx('assets,')} {(state.liabilities||[]).length} {tx('liabilities,')}
            {' '}{(state.goals||[]).length} {tx('goals) will be replaced with the demo seed.')}
            <br />{tx('Type')} <strong style={{ fontFamily: 'monospace' }}>DELETE</strong> {tx('to confirm.')}
          </span>
        }
        confirmLabel={tx('Reset everything')}
        requireType="DELETE"
      />
      <ConfirmDestructive
        open={dangerAction === 'clear'}
        onClose={() => setDangerAction(null)}
        onConfirm={() => { dispatch({ type: 'clearAssets' }); setDangerAction(null); showToast?.(tx('All assets deleted.'), 'success'); }}
        title={tx('Delete ALL your assets?')}
        description={
          <span>
            {tx('All')} <strong style={{ color: 'var(--ink)' }}>{state.assets.length}</strong> {tx(
              'assets will be permanently removed\n            from your portfolio. Liabilities, goals, and cashflows are kept.'
            )}
            <br />{tx('Type')} <strong style={{ fontFamily: 'monospace' }}>DELETE</strong> {tx('to confirm.')}
          </span>
        }
        confirmLabel={tx('Delete all assets')}
        requireType="DELETE"
      />
      <ConfirmDestructive
        open={!!pendingJsonImport}
        onClose={() => setPendingJsonImport(null)}
        onConfirm={() => {
          dispatch({ type: 'replaceAll', state: pendingJsonImport });
          setPendingJsonImport(null);
          showToast?.(tx('Portfolio imported successfully.'), 'success');
        }}
        title={tx('Replace your whole portfolio?')}
        description={
          <span>
            {tx('The imported file replaces everything you have now\n            (')}{state.assets.length} {tx('assets →')} {pendingJsonImport?.assets?.length ?? 0}{tx(').\n            This cannot be undone.')}
            <br />{tx('Type')} <strong style={{ fontFamily: 'monospace' }}>REPLACE</strong> {tx('to confirm.')}
          </span>
        }
        confirmLabel={tx('Replace portfolio')}
        requireType="REPLACE"
      />
      {/* About / brand footer */}
      <div style={{ marginTop: 30, padding: 20, background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', lineHeight: 1.55 }}>
        {/* Maxventures badge */}
        <div style={{ marginBottom: 14 }}>
          <MaxventuresBadge height={32} />
        </div>
        <div style={{ height: '0.5px', background: 'var(--line)', marginBottom: 14 }} />
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>{tx('Imari')}</strong> {tx('is a personal asset & wealth tracker built for Rwanda,\n          by')} <strong style={{ color: 'var(--ink-2)' }}>{tx('Maxventures')}</strong> {tx(
            '— Innovative Solutions, Limitless Possibilities.\n          When signed in, your data is stored in a Supabase Postgres database protected by Row Level Security,\n          accessible only to you and the members you invite.'
          )}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 10.5, color: 'var(--ink-4)' }}>© {new Date().getFullYear()} {tx('Maxventures · All rights reserved')}
        </p>
      </div>
    </div>)
  );
}
