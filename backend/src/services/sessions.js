const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Session } = require('../models');

// Access tokens (JWT) are short-lived; the refresh token keeps a device signed
// in and is rotated on every use.
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const newRefreshToken = () => crypto.randomBytes(32).toString('base64url');

const accessTokenFor = (user, session) =>
  jwt.sign({ userId: user.id, role: user.role, sid: session.id }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

const expiresInSeconds = (token) => {
  const { exp, iat } = jwt.decode(token);
  return exp - iat;
};

const clientInfo = (req) => ({
  user_agent: (req?.get?.('user-agent') || '').slice(0, 255) || null,
  ip: req?.ip || null,
});

/** Starts a session and returns the tokens the client should keep. */
const startSession = async (user, req, method = 'password') => {
  const refreshToken = newRefreshToken();
  const session = await Session.create({
    user_id: user.id,
    refresh_token_hash: hash(refreshToken),
    method,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000),
    last_used_at: new Date(),
    ...clientInfo(req),
  });
  const token = accessTokenFor(user, session);
  return { token, refreshToken, expiresIn: expiresInSeconds(token), sessionId: session.id };
};

const revokeAllSessions = async (userId, { except } = {}) => {
  const where = { user_id: userId, revoked_at: null };
  if (except) where.id = { [Op.ne]: except };
  const [count] = await Session.update({ revoked_at: new Date() }, { where });
  return count;
};

/**
 * Exchanges a refresh token for new tokens (rotation). Presenting a token
 * that was already rotated away means it was copied, so all of the user's
 * sessions are revoked.
 *
 * @returns {Promise<{ token, refreshToken, expiresIn, sessionId } | { error: string }>}
 */
const refreshSession = async (refreshToken, loadUser, req) => {
  if (!refreshToken || typeof refreshToken !== 'string') return { error: 'invalid' };
  const tokenHash = hash(refreshToken);

  const session = await Session.findOne({ where: { refresh_token_hash: tokenHash } });
  if (!session) {
    const reused = await Session.findOne({ where: { previous_hashes: { [Op.contains]: [tokenHash] } } });
    if (reused) {
      await revokeAllSessions(reused.user_id);
      return { error: 'reused' };
    }
    return { error: 'invalid' };
  }
  if (session.revoked_at || session.expires_at < new Date()) return { error: 'expired' };

  const user = await loadUser(session.user_id);
  if (!user) return { error: 'invalid' };

  const next = newRefreshToken();
  await session.update({
    refresh_token_hash: hash(next),
    previous_hashes: [...(session.previous_hashes || []), tokenHash].slice(-20),
    last_used_at: new Date(),
    ...clientInfo(req),
  });
  const token = accessTokenFor(user, session);
  return { token, refreshToken: next, expiresIn: expiresInSeconds(token), sessionId: session.id };
};

/** Ends the session a refresh token belongs to (sign out). */
const endSession = async (refreshToken) => {
  if (!refreshToken || typeof refreshToken !== 'string') return false;
  const [count] = await Session.update(
    { revoked_at: new Date() },
    { where: { refresh_token_hash: hash(refreshToken), revoked_at: null } }
  );
  return count > 0;
};

/** Whether the session behind an access token is still active. */
const isSessionActive = async (sessionId) => {
  if (!sessionId) return false;
  const session = await Session.findByPk(sessionId, { attributes: ['id', 'revoked_at', 'expires_at'] });
  return Boolean(session && !session.revoked_at && session.expires_at > new Date());
};

module.exports = {
  ACCESS_TOKEN_TTL,
  hash,
  startSession,
  refreshSession,
  endSession,
  revokeAllSessions,
  isSessionActive,
};
