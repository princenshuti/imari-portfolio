/**
 * send-invitation — Supabase Edge Function
 *
 * Sends a portfolio invitation email via Resend (https://resend.com).
 * Called by the client immediately after createInvitation() inserts the row,
 * and again whenever the owner clicks "Resend" on a pending invitation.
 *
 * Auth model:
 *   - Caller must pass their Supabase JWT in `Authorization: Bearer <token>`.
 *   - We validate the JWT, then re-verify on the server that the caller is
 *     the OWNER of the portfolio the invitation belongs to. This means even
 *     if the client lies about invitationId, an attacker can't spam emails
 *     for a portfolio they don't own.
 *
 * Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
 *   - SUPABASE_URL                 (auto-set by Supabase)
 *   - SUPABASE_SERVICE_ROLE_KEY    (auto-set by Supabase)
 *   - SUPABASE_ANON_KEY            (auto-set by Supabase)
 *   - RESEND_API_KEY               from resend.com — required
 *   - FROM_EMAIL                   verified sender, e.g. "Imari <invites@yourdomain.com>"
 *   - APP_URL                      origin used to build the accept link, e.g. "https://nshutiprince.github.io/imari-portfolio/"
 *   - ALLOWED_ORIGINS              optional CSV of allowed CORS origins
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY           = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL         = Deno.env.get('FROM_EMAIL') ?? '';
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inviteHtml(opts: {
  inviterName: string; inviterEmail: string;
  recipientEmail: string; role: string; acceptUrl: string; expiresAt: string;
}): string {
  const { inviterName, inviterEmail, role, acceptUrl, expiresAt } = opts;
  const inviter = escapeHtml(inviterName || inviterEmail);
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const roleDesc = role === 'editor'
    ? 'add and update assets in this portfolio'
    : 'view this portfolio (read-only)';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fffdf7;border:1px solid #e8e3d3;border-radius:12px;padding:32px;">
        <tr><td>
          <div style="font-family:Georgia,serif;font-size:24px;color:#1a1a1a;margin-bottom:8px;">Imari Portfolio</div>
          <div style="height:1px;background:#e8e3d3;margin:16px 0 24px;"></div>
          <p style="font-size:15px;line-height:1.6;color:#2a2a2a;margin:0 0 16px;">
            <b>${inviter}</b> invited you to ${roleDesc}.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 28px;">
            You've been added as <b style="text-transform:capitalize;">${escapeHtml(role)}</b>.
            Click below to accept — you'll be asked to sign in or create a free account first.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${escapeHtml(acceptUrl)}"
               style="display:inline-block;padding:12px 28px;background:#1a1a1a;color:#fffdf7;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
              Accept invitation →
            </a>
          </div>
          <p style="font-size:12px;line-height:1.6;color:#888;margin:0 0 8px;">
            Or copy this link into your browser:
          </p>
          <p style="font-size:12px;line-height:1.5;color:#555;word-break:break-all;margin:0 0 24px;">
            ${escapeHtml(acceptUrl)}
          </p>
          <div style="height:1px;background:#e8e3d3;margin:24px 0;"></div>
          <p style="font-size:11px;color:#999;margin:0;">
            This invitation expires on ${expiry}. If you weren't expecting it, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

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
  if (!RESEND_API_KEY || !FROM_EMAIL || !APP_URL) {
    return reply({ error: 'email env not configured (RESEND_API_KEY, FROM_EMAIL, APP_URL required)' }, 500);
  }

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

  // 5. Build accept URL and send via Resend.
  const acceptUrl = `${APP_URL}?invite=${encodeURIComponent(inv.token)}`;
  const html = inviteHtml({
    inviterName,
    inviterEmail: caller.email ?? '',
    recipientEmail: inv.email,
    role: inv.role,
    acceptUrl,
    expiresAt: inv.expires_at,
  });
  const subject = `${inviterName || caller.email || 'Someone'} invited you to Imari Portfolio`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     FROM_EMAIL,
      to:       [inv.email],
      reply_to: caller.email ?? undefined,
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text();
    return reply({ error: 'email send failed', detail }, 502);
  }
  const resendBody = await resendRes.json();

  return reply({ ok: true, messageId: resendBody.id ?? null });
});
