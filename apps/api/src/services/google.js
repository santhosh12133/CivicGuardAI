const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// "Sign in with Google" using the OAuth 2.0 authorization-code flow on the
// server: the browser or app is sent to Google, Google sends the user back to
// /api/auth/google/callback, and the server checks Google's signed ID token.
//
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: a "Web application" OAuth client
// whose authorised redirect URI is <API URL>/api/auth/google/callback.
// The endpoint URLs can be overridden (tests use a fake Google server).

const config = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authUrl: process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
  jwksUrl: process.env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs',
  issuers: (process.env.GOOGLE_ISSUERS || 'https://accounts.google.com,accounts.google.com').split(','),
});

const isConfigured = () => Boolean(config().clientId && config().clientSecret);

const authorizationUrl = ({ redirectUri, state, nonce }) => {
  const { clientId, authUrl } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account',
  });
  return `${authUrl}?${params}`;
};

const exchangeCode = async ({ code, redirectUri }) => {
  const { clientId, clientSecret, tokenUrl } = config();
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_token) {
    throw new Error(`Google token exchange failed (${res.status}): ${data.error || 'no id_token'}`);
  }
  return data.id_token;
};

let jwksCache = { keys: null, fetchedAt: 0 };
const getSigningKey = async (kid) => {
  const fresh = Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000;
  let key = fresh && jwksCache.keys ? jwksCache.keys.find((k) => k.kid === kid) : null;
  if (!key) {
    const res = await fetch(config().jwksUrl);
    if (!res.ok) throw new Error(`Could not load Google signing keys (${res.status})`);
    jwksCache = { keys: (await res.json()).keys || [], fetchedAt: Date.now() };
    key = jwksCache.keys.find((k) => k.kid === kid);
  }
  if (!key) throw new Error('Unknown Google signing key');
  return crypto.createPublicKey({ key, format: 'jwk' });
};

/**
 * Verifies a Google ID token: signature (RS256, Google's published keys),
 * issuer, audience (our client id), expiry, nonce, and a verified email.
 * Returns { sub, email, name }.
 */
const verifyIdToken = async (idToken, { nonce } = {}) => {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || decoded.header.alg !== 'RS256') {
    throw new Error('Not a Google ID token');
  }
  const { clientId, issuers } = config();
  const publicKey = await getSigningKey(decoded.header.kid);
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: issuers,
  });
  if (nonce && payload.nonce !== nonce) throw new Error('Google sign-in nonce mismatch');
  if (!payload.email || payload.email_verified === false || payload.email_verified === 'false') {
    throw new Error('Google account email is not verified');
  }
  return { sub: payload.sub, email: String(payload.email).toLowerCase(), name: payload.name || payload.email };
};

// Test helper: forget cached keys.
const resetKeyCache = () => {
  jwksCache = { keys: null, fetchedAt: 0 };
};

module.exports = { isConfigured, authorizationUrl, exchangeCode, verifyIdToken, resetKeyCache };
