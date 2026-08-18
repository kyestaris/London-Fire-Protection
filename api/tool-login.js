/**
 * PIN exchange for the internal tools (quote + schedule).
 *
 * POST { pin } -> { ok: true, token }        on success
 *              -> { ok: false }               on a wrong PIN
 *
 * While TOOL_SECRET/TOOL_PIN are unset this responds ok with no token and
 * flags unconfigured:true, so the tools keep working exactly as they do
 * today until the env vars are added in Vercel.
 */

const { isConfigured, issueToken, checkPin } = require('./_auth');

// Small in-memory backoff so the 4-digit PIN cannot be brute forced quickly.
// Serverless instances are recycled, so this is a speed bump rather than a
// hard lock — enough to make exhausting 10,000 PINs impractical.
const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : String(fwd || '')).split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);

  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Not switched on yet — behave exactly as before.
  if (!isConfigured()) {
    return res.status(200).json({ ok: true, token: null, unconfigured: true });
  }

  if (tooManyAttempts(clientIp(req))) {
    return res.status(429).json({ ok: false, error: 'Too many attempts — try again later' });
  }

  const { pin } = req.body || {};

  if (!checkPin(pin)) {
    return res.status(401).json({ ok: false });
  }

  return res.status(200).json({ ok: true, token: issueToken() });
};
