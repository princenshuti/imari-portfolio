import { supabase, isConfigured } from './supabase.js';
import { FX, SEED_ASSETS } from './data.js';

export { isConfigured };

// ─── Auth ─────────────────────────────────────────────────────
export async function signUp(email, password) {
  if (!supabase) throw new Error('Auth not configured');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Auth not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => callback(session));
  return () => subscription.unsubscribe();
}

// ─── Portfolio sync ───────────────────────────────────────────
function emptyPortfolio(email) {
  return {
    profile: { name: '', displayCurrency: 'RWF', email, createdAt: new Date().toISOString() },
    assets:  SEED_ASSETS.slice(),
    fx:      { ...FX },
    chat:    [],
    insight: null,
  };
}

export async function loadOrCreatePortfolio(user) {
  if (!supabase) throw new Error('Not configured');

  // 1. List portfolios the user is a member of (via RLS this only returns ones they can see).
  const { data: memberships, error: memErr } = await supabase
    .from('portfolio_members')
    .select('portfolio_id, role')
    .eq('user_id', user.id);
  if (memErr) throw memErr;

  // 2. If they're a member of one or more, prefer the one they own; otherwise pick first.
  const ownedId = memberships.find(m => m.role === 'owner')?.portfolio_id;
  const anyId   = memberships[0]?.portfolio_id;
  let portfolioId = ownedId || anyId;

  if (!portfolioId) {
    // 3. Create a fresh portfolio for new user.
    // Use getUser() (server-validated) instead of the cached session user to ensure
    // the JWT is active — a stale getSession() result causes auth.uid() to be null
    // in the DB, which violates the INSERT RLS policy (auth.uid() = owner_id).
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) throw new Error('Session expired. Please sign in again.');
    const verifiedUser = authData.user;

    const seed = emptyPortfolio(verifiedUser.email || user.email);
    // Use a security-definer RPC so the INSERT bypasses RLS and no RETURNING
    // clause is needed — avoids PostgREST evaluating the SELECT policy before
    // the on_portfolio_created trigger populates portfolio_members.
    const newId = crypto.randomUUID();
    const { error } = await supabase.rpc('create_portfolio_for_user', {
      p_id:      newId,
      p_profile: seed.profile,
      p_assets:  seed.assets,
      p_fx:      seed.fx,
      p_chat:    seed.chat,
    });
    if (error) throw error;
    portfolioId = newId;
  }

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', portfolioId)
    .single();
  if (error) throw error;

  const myRole = memberships.find(m => m.portfolio_id === portfolioId)?.role || 'owner';

  return {
    portfolioId,
    role: myRole,
    state: {
      // Merge cloud profile over safe defaults so no field is ever undefined
      profile: {
        name: '', displayCurrency: 'RWF', phone: '', bio: '', location: '', avatar: null,
        ...(data.profile || {}),
        email: user.email,           // always authoritative from auth
      },
      assets:            Array.isArray(data.assets)      ? data.assets      : [],
      liabilities:       Array.isArray(data.liabilities) ? data.liabilities : [],
      goals:             Array.isArray(data.goals)       ? data.goals       : [],
      cashflows:         Array.isArray(data.cashflows)   ? data.cashflows   : [],
      snapshots:         Array.isArray(data.snapshots)   ? data.snapshots   : [],
      reachedMilestones: Array.isArray(data.reachedmilestones) ? data.reachedmilestones : [],
      fx:                data.fx   || { ...FX },
      chat:              Array.isArray(data.chat) ? data.chat : [],
      insight:           data.insight ?? null,
    },
  };
}

export async function savePortfolio(portfolioId, state) {
  if (!supabase || !portfolioId) return;
  const { error } = await supabase
    .from('portfolios')
    .update({
      profile:     state.profile,
      assets:      state.assets,
      liabilities: state.liabilities || [],
      goals:       state.goals       || [],
      cashflows:         state.cashflows         || [],
      snapshots:         state.snapshots         || [],
      reachedmilestones: state.reachedMilestones || [],
      fx:                state.fx,
      chat:        state.chat,
      insight:     state.insight,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', portfolioId);
  if (error) throw error;
}

export function subscribePortfolio(portfolioId, onUpdate) {
  if (!supabase || !portfolioId) return () => {};
  const channel = supabase
    .channel(`portfolio:${portfolioId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'portfolios', filter: `id=eq.${portfolioId}`,
    }, (payload) => onUpdate(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Members & invitations ────────────────────────────────────
export async function listMembers(portfolioId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('portfolio_members')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

const VALID_ROLES = new Set(['owner', 'editor', 'viewer']);
/** UUID v4 shape — only accept well-formed IDs to prevent injection via eq() */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function removeMember(memberId) {
  if (!UUID_RE.test(memberId)) throw new Error('Invalid member ID');
  const { error } = await supabase.from('portfolio_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function updateMemberRole(memberId, role) {
  if (!UUID_RE.test(memberId))  throw new Error('Invalid member ID');
  if (!VALID_ROLES.has(role))   throw new Error(`Invalid role "${role}" — must be owner, editor, or viewer`);
  const { error } = await supabase.from('portfolio_members').update({ role }).eq('id', memberId);
  if (error) throw error;
}

export async function listInvitations(portfolioId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('portfolio_invitations')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInvitation(portfolioId, email, role) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('portfolio_invitations')
    .insert({
      portfolio_id: portfolioId,
      email: email.trim().toLowerCase(),
      role,
      invited_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function revokeInvitation(invitationId) {
  const { error } = await supabase.from('portfolio_invitations').delete().eq('id', invitationId);
  if (error) throw error;
}

export async function peekInvitation(token) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('peek_invitation', { invitation_token: token });
  if (error) return null;
  return data?.[0] || null;
}

export async function acceptInvitation(token) {
  if (!supabase) throw new Error('Not configured');
  const { data, error } = await supabase.rpc('accept_invitation', { invitation_token: token });
  if (error) throw error;
  return data;
}
