/**
 * Shared auth helper for LFP internal tool endpoints.
 *
 * Files prefixed with "_" are not routed as endpoints by Vercel.
 *
 * Flow:
 *   1. Tool posts the PIN to /api/tool-login
 *   2. Server checks it against TOOL_PIN and returns a signed, expiring token
 *   3. Tool sends that token as "Authorization: Bearer <token>" on every call
 *   4. Endpoints call requireAuth() before doing any work
 *
 * The PIN itself never ships to the browser — only the token does, and the
 * token is useless without TOOL_SECRET to forge a signature.
 *
 * SAFE ROLLOUT: if TOOL_SECRET is not set in the environment, isConfigured()
 * is false and requireAuth() allows every request through. That means
 * deploying this code changes nothing until the env vars are added, so the
 * live tools cannot break mid-deploy. Once TOOL_SECRET and TOOL_PIN are set
 * in Vercel, auth switches on everywhere at once.
 */

const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — one working day

function isConfigured() {
  return Boolean(process.env.TOOL_SECRET);
}

function sign(payload) {
  return crypto
    .createHmac('sha256', process.env.TOOL_SECRET)
    .update(String(payload))
    .digest('hex');
}

/** Issue a token valid for TOKEN_TTL_MS. Format: "<expiryMs>.<hexSignature>" */
function issueToken() {
  const expiry = Date.now() + TOKEN_TTL_MS;
  return `${expiry}.${sign(expiry)}`;
}

/** Verify a token's signature and expiry. Returns true/false, never throws. */
function verifyToken(token) {
  if (typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expiryStr, providedSig] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expectedSig = sign(expiryStr);

  // timingSafeEqual throws on length mismatch, so guard first
  if (providedSig.length !== expectedSig.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSig, 'hex'),
      Buffer.from(expectedSig, 'hex'),
    );
  } catch {
    return false;
  }
}

/** Pull the bearer token off the request, if present. */
function getToken(req) {
  const header = req.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

/**
 * Gate an endpoint. Returns true if the request may proceed.
 * When it returns false it has already sent a 401 — the caller must return.
 *
 *   if (!requireAuth(req, res)) return;
 */
function requireAuth(req, res) {
  if (!isConfigured()) {
    console.warn('[auth] TOOL_SECRET not set — request allowed unauthenticated');
    return true;
  }

  if (verifyToken(getToken(req))) return true;

  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

/** Constant-time PIN comparison, used only by /api/tool-login. */
function checkPin(pin) {
  const expected = process.env.TOOL_PIN || '';
  if (!expected) return false;

  const a = Buffer.from(String(pin));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { isConfigured, issueToken, verifyToken, requireAuth, checkPin };
