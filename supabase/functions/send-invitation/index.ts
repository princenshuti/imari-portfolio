/**
 * send-invitation — Supabase Edge Function
 *
 * Delivers a portfolio invitation through Supabase Auth's own mailer, so the
 * e-mail comes from the project's configured sender (custom SMTP, e.g.
 * noreply@maxventures.rw) with the project's templates — no third-party
 * e-mail key in this function.
 *
 *   • New person   → auth.admin.inviteUserByEmail(): "Invite user" template;
 *                    the link signs them in and lands on the app with
 *                    ?invite=<token>, where they choose a password and the
 *                    invitation is accepted.
 *   • Existing user → signInWithOtp() magic link ("Magic Link" template) with
 *                    the same landing, so the invitation is accepted on click.
 *
 * Auth model: caller JWT is verified, then the server re-checks that the
 * caller OWNS the portfolio the invitation belongs to; invite cap enforced;
 * 5 sends / 10 min / user.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (auto),
 *      APP_URL (landing origin), ALLOWED_ORIGINS (optional CSV).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY           = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Per-user throttle: 5 invitation e-mails per 10 minutes (in-memory, per instance).
const SEND_WINDOW_MS = 10 * 60_000, SEND_MAX = 5;
const sendBuckets = new Map<string, number[]>();
function overSendLimit(userId: string): boolean {
  const now = Date.now();
  const arr = (sendBuckets.get(userId) ?? []).filter(t => now - t < SEND_WINDOW_MS);
  if (arr.length >= SEND_MAX) return true;
  arr.push(now); sendBuckets.set(userId, arr);
  return false;
}
const APP_URL            = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);

function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const origin = reqOrigin ?? '';
  const allowed = ALLOWED_ORIGINS.length === 0
    ? '*'
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });


interface RequestBody {
  invitationId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Max invited members per portfolio (owner + MAX_INVITES). Overridable via env
// so a paid tier can raise it without redeploying. Mirrors cloud.js MAX_INVITES.
const MAX_INVITES = Number(Deno.env.get('MAX_INVITES') ?? '2');

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req.headers.get('Origin'));
  const reply = (body: unknown, status = 200) => json(body, status, CORS);

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')    return reply({ error: 'method not allowed' }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return reply({ error: 'supabase env not configured' }, 500);
  }
  if (!APP_URL) return reply({ error: 'APP_URL not configured' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return reply({ error: 'missing bearer token' }, 401);

  // 1. Verify the JWT and get the caller's user id (using anon key + their JWT).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return reply({ error: 'invalid session' }, 401);
  const caller = userData.user;
  if (overSendLimit(caller.id)) return reply({ error: 'Too many invitation e-mails — wait a few minutes and try again.' }, 429);

  let body: RequestBody;
  try { body = await req.json(); }
  catch { return reply({ error: 'invalid json body' }, 400); }

  const invitationId = body.invitationId ?? '';
  if (!UUID_RE.test(invitationId)) return reply({ error: 'invalid invitationId' }, 400);

  // 2. Look up the invite with service-role so we have all fields regardless of RLS.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inv, error: invErr } = await admin
    .from('portfolio_invitations')
    .select('id, portfolio_id, email, role, token, expires_at, accepted_at')
    .eq('id', invitationId)
    .single();
  if (invErr || !inv) return reply({ error: 'invitation not found' }, 404);
  if (inv.accepted_at) return reply({ error: 'invitation already accepted' }, 409);
  if (typeof inv.email !== 'string' || inv.email.length > 254 || !EMAIL_RE.test(inv.email)) return reply({ error: 'invitation e-mail is not valid' }, 400);
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return reply({ error: 'invitation has expired — revoke it and invite again' }, 410);

  // 3. Re-verify the caller is an owner of that portfolio. Don't trust the client.
  const { data: membership, error: memErr } = await admin
    .from('portfolio_members')
    .select('role')
    .eq('portfolio_id', inv.portfolio_id)
    .eq('user_id', caller.id)
    .single();
  if (memErr || membership?.role !== 'owner') {
    return reply({ error: 'forbidden — only the portfolio owner can send invitations' }, 403);
  }

  // 3.5 Enforce the invite cap (B3): owner + MAX_INVITES invited members.
  // Count non-owner members + pending (unaccepted) invitations. pendingCount
  // includes the invitation being sent, so a total over the cap means this is
  // the (cap+1)th — reject it. A resend at exactly the cap stays allowed.
  const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
    admin.from('portfolio_members').select('id', { count: 'exact', head: true })
      .eq('portfolio_id', inv.portfolio_id).neq('role', 'owner'),
    admin.from('portfolio_invitations').select('id', { count: 'exact', head: true })
      .eq('portfolio_id', inv.portfolio_id).is('accepted_at', null),
  ]);
  if ((memberCount ?? 0) + (pendingCount ?? 0) > MAX_INVITES) {
    return reply({ error: `Invite limit reached — a portfolio allows the owner plus ${MAX_INVITES} members.` }, 409);
  }

  // 4. Look up portfolio profile for inviter name.
  const { data: portfolio } = await admin
    .from('portfolios')
    .select('profile')
    .eq('id', inv.portfolio_id)
    .single();
  const inviterName = (portfolio?.profile as { name?: string } | null)?.name ?? '';

  // 5. Send through Supabase Auth's mailer. The landing URL carries the
  //    invitation token so the app accepts it once the person is signed in.
  const landing = `${APP_URL}/?invite=${encodeURIComponent(inv.token)}`;
  const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const known = (userList?.users ?? []).some(u => (u.email ?? '').toLowerCase() === inv.email.toLowerCase());

  if (!known) {
    const { error } = await admin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo: landing,
      data: { invited_by: inviterName || caller.email || '', invited_role: inv.role },
    });
    if (error) {
      console.error('inviteUserByEmail failed:', error.message);
      return reply({ error: 'email send failed', detail: error.message }, 502);
    }
    return reply({ ok: true, transport: 'auth-invite' });
  }

  // Existing account: a magic link (no new user is created).
  const { error } = await userClient.auth.signInWithOtp({
    email: inv.email,
    options: { emailRedirectTo: landing, shouldCreateUser: false },
  });
  if (error) {
    console.error('signInWithOtp failed:', error.message);
    return reply({ error: 'email send failed', detail: error.message }, 502);
  }
  return reply({ ok: true, transport: 'auth-magiclink' });
});
