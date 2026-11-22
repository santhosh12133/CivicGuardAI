const crypto = require('crypto');
const { Op } = require('sequelize');
const { OtpCode } = require('../models');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const MAX_ATTEMPTS = 5;

const POLICIES = {
  // 6-digit code by SMS to sign in with a phone number.
  phone_login: { ttlMs: 10 * 60 * 1000, cooldownMs: 60 * 1000, perHour: 5, numeric: true },
  // 6-digit code by email to reset a password.
  password_reset: { ttlMs: 15 * 60 * 1000, cooldownMs: 60 * 1000, perHour: 5, numeric: true },
  // Hand-over after "Sign in with Google": long random code, used once, quickly.
  google_login: { ttlMs: 2 * 60 * 1000, cooldownMs: 0, perHour: 100, numeric: false },
};

const generate = (numeric) =>
  numeric ? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0') : crypto.randomBytes(24).toString('base64url');

/**
 * Creates a code. Returns { code } or { error: 'cooldown' | 'too_many', retryAfter }.
 * A fixed code can be passed for test phone numbers (TEST_OTP_PHONE).
 */
const issueCode = async (purpose, target, { fixedCode } = {}) => {
  const policy = POLICIES[purpose];
  const now = Date.now();

  if (policy.cooldownMs || policy.perHour) {
    const recent = await OtpCode.findAll({
      where: { purpose, target, created_at: { [Op.gte]: new Date(now - 3600 * 1000) } },
      order: [['created_at', 'DESC']],
      attributes: ['created_at'],
    });
    if (recent.length && now - recent[0].created_at.getTime() < policy.cooldownMs) {
      return { error: 'cooldown', retryAfter: Math.ceil((policy.cooldownMs - (now - recent[0].created_at.getTime())) / 1000) };
    }
    if (recent.length >= policy.perHour) {
      return { error: 'too_many', retryAfter: 3600 };
    }
  }

  // Only the newest code for a target is valid.
  await OtpCode.update({ consumed_at: new Date() }, { where: { purpose, target, consumed_at: null } });

  const code = fixedCode || generate(policy.numeric);
  await OtpCode.create({
    purpose,
    target,
    code_hash: hash(code),
    expires_at: new Date(now + policy.ttlMs),
  });
  return { code, expiresIn: Math.round(policy.ttlMs / 1000) };
};

/**
 * Checks and uses up a code. Returns { ok: true, target } or
 * { ok: false, reason: 'invalid' | 'expired' | 'too_many_attempts' }.
 * When target is omitted (Google hand-over), the code itself identifies it.
 */
const verifyCode = async (purpose, target, code) => {
  if (!code || typeof code !== 'string') return { ok: false, reason: 'invalid' };

  if (!target) {
    const record = await OtpCode.findOne({ where: { purpose, code_hash: hash(code), consumed_at: null } });
    if (!record) return { ok: false, reason: 'invalid' };
    if (record.expires_at < new Date()) return { ok: false, reason: 'expired' };
    await record.update({ consumed_at: new Date() });
    return { ok: true, target: record.target };
  }

  const record = await OtpCode.findOne({
    where: { purpose, target, consumed_at: null },
    order: [['created_at', 'DESC']],
  });
  if (!record) return { ok: false, reason: 'invalid' };
  if (record.expires_at < new Date()) return { ok: false, reason: 'expired' };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const expected = Buffer.from(record.code_hash, 'hex');
  const given = Buffer.from(hash(code.trim()), 'hex');
  if (!crypto.timingSafeEqual(expected, given)) {
    await record.increment('attempts');
    return { ok: false, reason: record.attempts + 1 >= MAX_ATTEMPTS ? 'too_many_attempts' : 'invalid' };
  }
  await record.update({ consumed_at: new Date() });
  return { ok: true, target };
};

module.exports = { issueCode, verifyCode, MAX_ATTEMPTS };
