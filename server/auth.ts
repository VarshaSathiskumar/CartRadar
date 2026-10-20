import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { migrate, pool } from './db.ts';

/**
 * Login service: one-time code to the user's mobile and email, then a session token.
 * Users are stored in Postgres (see db.ts). Codes are only HMAC hashes at rest.
 *
 * Run: npm run auth (reads .env.local)
 * No SMS or email provider is wired up yet: codes are printed to this process's console.
 * Replace `deliverCode` to send them for real.
 */

const PORT = Number(process.env.AUTH_PORT || 8789);
const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString('hex');
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 30;
const MAX_CODES_PER_HOUR = 5;
const SESSION_DAYS = 30;
const MAX_BODY_BYTES = 4_000;

async function deliverCode(mobile: string, email: string, code: string): Promise<void> {
  console.log(`[login code] ${code} for ${mobile} / ${email} (valid ${CODE_TTL_MIN} min)`);
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** E.164 for the mobile number; a bare 10-digit number is treated as US. */
function normaliseMobile(raw: unknown): string {
  const stripped = String(raw ?? '').replace(/[\s().-]/g, '');
  const withPlus = /^\d{10}$/.test(stripped) ? `+1${stripped}` : stripped;
  if (!/^\+[1-9]\d{7,14}$/.test(withPlus)) throw new HttpError(400, 'Enter a valid mobile number');
  return withPlus;
}

function normaliseEmail(raw: unknown): string {
  const email = String(raw ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
  return email;
}

const cleanName = (raw: unknown): string | null => String(raw ?? '').trim().slice(0, 80) || null;

const hmac = (value: string) => createHmac('sha256', SECRET).update(value).digest('hex');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function requestCode(body: Record<string, unknown>) {
  const mobile = normaliseMobile(body.mobile);
  const email = normaliseEmail(body.email);

  const { rows } = await pool.query<{ last: Date | null; recent: string }>(
    `SELECT max(created_at) AS last, count(*) AS recent FROM login_codes
     WHERE (mobile = $1 OR email = $2) AND created_at > now() - interval '1 hour'`,
    [mobile, email],
  );
  const { last, recent } = rows[0];
  if (Number(recent) >= MAX_CODES_PER_HOUR) throw new HttpError(429, 'Too many codes requested. Try again later.');
  if (last && Date.now() - last.getTime() < RESEND_COOLDOWN_SEC * 1000) throw new HttpError(429, 'Wait a moment before requesting another code.');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query(
    `INSERT INTO login_codes (mobile, email, code_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [mobile, email, hmac(`${mobile}|${email}|${code}`), CODE_TTL_MIN],
  );
  await deliverCode(mobile, email, code);
  return { ok: true, expiresInSec: CODE_TTL_MIN * 60 };
}

async function verifyCode(body: Record<string, unknown>) {
  const mobile = normaliseMobile(body.mobile);
  const email = normaliseEmail(body.email);
  const code = String(body.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM login_codes
       WHERE mobile = $1 AND email = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [mobile, email],
    );
    const row = rows[0];
    if (!row || row.attempts >= MAX_ATTEMPTS) throw new HttpError(400, 'That code has expired. Request a new one.');

    if (!safeEqual(row.code_hash, hmac(`${mobile}|${email}|${code}`))) {
      await client.query('UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      await client.query('COMMIT');
      throw new HttpError(400, 'Incorrect code');
    }
    await client.query('UPDATE login_codes SET consumed_at = now() WHERE id = $1', [row.id]);

    const existing = await client.query<{ id: string; mobile: string; email: string }>('SELECT id, mobile, email FROM users WHERE mobile = $1 OR email = $2', [mobile, email]);
    if (existing.rows.length > 1 || (existing.rows[0] && (existing.rows[0].mobile !== mobile || existing.rows[0].email !== email))) {
      throw new HttpError(409, 'That mobile number or email already belongs to a different account.');
    }

    const name = cleanName(body.name);
    const user = existing.rows[0]
      ? (await client.query('UPDATE users SET last_login_at = now(), name = COALESCE($2, name) WHERE id = $1 RETURNING id, name, mobile, email', [existing.rows[0].id, name])).rows[0]
      : (await client.query('INSERT INTO users (name, mobile, email, last_login_at) VALUES ($1, $2, $3, now()) RETURNING id, name, mobile, email', [name, mobile, email])).rows[0];

    const token = randomBytes(32).toString('hex');
    await client.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [sha256(token), user.id, SESSION_DAYS]);
    await client.query('COMMIT');
    return { token, user };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

const bearer = (req: IncomingMessage) => /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];

async function me(req: IncomingMessage) {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'Not signed in');
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.mobile, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  if (!rows[0]) throw new HttpError(401, 'Session expired');
  return { user: rows[0] };
}

async function logout(req: IncomingMessage) {
  const token = bearer(req);
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  return { ok: true };
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) reject(new HttpError(413, 'Request too large'));
      else chunks.push(c);
    });
    req.on('end', () => {
      try {
        const parsed: unknown = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        resolve(parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

await migrate();

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(JSON.stringify(body));
  };

  try {
    if (req.method === 'OPTIONS') return send(204, {});
    if (req.method === 'POST' && req.url === '/auth/request-code') return send(200, await requestCode(await readJson(req)));
    if (req.method === 'POST' && req.url === '/auth/verify') return send(200, await verifyCode(await readJson(req)));
    if (req.method === 'GET' && req.url === '/auth/me') return send(200, await me(req));
    if (req.method === 'POST' && req.url === '/auth/logout') return send(200, await logout(req));
    return send(404, { error: 'not found' });
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { error: e.message });
    console.error(e);
    return send(500, { error: 'Something went wrong' });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Auth service on http://127.0.0.1:${PORT}`));
