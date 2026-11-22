const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { User, roles } = require('../models');
const sessions = require('../services/sessions');
const otp = require('../services/otp');
const notify = require('../services/notify');
const google = require('../services/google');

const USER_FIELDS = ['id', 'name', 'email', 'phone', 'role', 'created_at', 'updated_at'];
const STAFF_ROLES = ['staff', 'admin'];
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  role: user.role,
  has_password: Boolean(user.password),
});

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// A strong one-time password an admin passes on; the person should change it.
const generatePassword = () => crypto.randomBytes(12).toString('base64url');

const failValidation = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ errors: errors.array() });
  return true;
};

// Every successful sign-in answers with the same shape.
const signedIn = async (res, user, req, method, status = 200) => {
  const { token, refreshToken, expiresIn } = await sessions.startSession(user, req, method);
  return res.status(status).json({ user: sanitizeUser(user), token, refreshToken, expiresIn });
};

const loadUser = (id) => User.findByPk(id);

// ---------------------------------------------------------------- password

const register = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;

    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    if ((req.body.role || 'citizen') !== 'citizen') {
      return res.status(403).json({ message: 'Only citizen registrations are allowed via this route' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: 'citizen',
    });
    return signedIn(res, user, req, 'password', 201);
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;

    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (user && user.locked_until && user.locked_until > new Date()) {
      const minutes = Math.ceil((user.locked_until - Date.now()) / 60000);
      return res.status(429).json({
        message: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const isMatch = Boolean(user && user.password) && (await bcrypt.compare(password, user.password));
    if (!isMatch) {
      if (user) {
        const failed = user.failed_logins + 1;
        await user.update(
          failed >= MAX_FAILED_LOGINS
            ? { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000) }
            : { failed_logins: failed }
        );
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.failed_logins || user.locked_until) {
      await user.update({ failed_logins: 0, locked_until: null });
    }
    return signedIn(res, user, req, 'password');
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------- sessions

// POST /api/auth/refresh { refreshToken }
const refresh = async (req, res, next) => {
  try {
    const result = await sessions.refreshSession(req.body?.refreshToken, loadUser, req);
    if (result.error) {
      return res.status(401).json({
        message:
          result.error === 'reused'
            ? 'This sign-in was used from somewhere else, so all your sessions were ended. Please sign in again.'
            : 'Your session has ended. Please sign in again.',
        code: 'REFRESH_FAILED',
      });
    }
    const user = await loadUser(jwt.decode(result.token).userId);
    return res.json({
      user: sanitizeUser(user),
      token: result.token,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/logout { refreshToken } — also accepts just the access token.
const logout = async (req, res, next) => {
  try {
    const ended = await sessions.endSession(req.body?.refreshToken);
    if (!ended && req.user?.sid) {
      const { Session } = require('../models');
      await Session.update({ revoked_at: new Date() }, { where: { id: req.user.sid, revoked_at: null } });
    }
    return res.json({ message: 'Signed out' });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/logout-all — sign out every device.
const logoutAll = async (req, res, next) => {
  try {
    const count = await sessions.revokeAllSessions(req.user.userId);
    return res.json({ message: 'Signed out everywhere', sessions: count });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------- account

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(401).json({ message: 'This account no longer exists' });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/change-password — signs out every other device.
// Accounts without a password (Google / phone) can set one without currentPassword.
const changePassword = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(401).json({ message: 'This account no longer exists' });
    if (user.password) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ message: 'Choose a password different from the current one' });
      }
    }
    await user.update({ password: await bcrypt.hash(newPassword, 10), failed_logins: 0, locked_until: null });
    const others = await sessions.revokeAllSessions(user.id, { except: req.user.sid });
    return res.json({ message: 'Password changed', signedOutSessions: others });
  } catch (error) {
    return next(error);
  }
};

// GET /api/auth/providers — which sign-in options this server offers.
const getProviders = (req, res) =>
  res.json({
    password: true,
    google: google.isConfigured(),
    phone: notify.smsConfigured(),
    passwordReset: notify.emailConfigured(),
  });

// ---------------------------------------------------------------- password reset by email

// POST /api/auth/password/forgot { email } — always answers the same way.
const forgotPassword = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    if (!notify.emailConfigured()) {
      return res.status(503).json({ message: 'Password reset by email is not available. Ask an administrator.' });
    }
    const email = normalizeEmail(req.body.email);
    const generic = { message: 'If an account exists for that email, a reset code has been sent.' };

    const user = await User.findOne({ where: { email } });
    if (!user) return res.json(generic);

    const issued = await otp.issueCode('password_reset', email);
    if (issued.error) return res.json(generic);

    await notify.sendEmail({
      to: email,
      subject: 'Your CivicFix password reset code',
      text:
        `Your CivicFix password reset code is ${issued.code}. It expires in 15 minutes.\n\n` +
        'If you did not ask to reset your password, you can ignore this email.',
    });
    return res.json(generic);
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/password/reset { email, code, newPassword } — signs out every device.
const resetPassword = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const email = normalizeEmail(req.body.email);
    const result = await otp.verifyCode('password_reset', email, String(req.body.code || '').trim());
    if (!result.ok) {
      return res.status(400).json({
        message:
          result.reason === 'expired'
            ? 'That code has expired. Ask for a new one.'
            : result.reason === 'too_many_attempts'
            ? 'Too many wrong codes. Ask for a new one.'
            : 'That code is not correct.',
      });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'That code is not correct.' });

    await user.update({ password: await bcrypt.hash(req.body.newPassword, 10), failed_logins: 0, locked_until: null });
    await sessions.revokeAllSessions(user.id);
    return res.json({ message: 'Password reset. You can sign in with your new password.' });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------- phone + SMS code

const testOtp = (phone) =>
  process.env.TEST_OTP_PHONE && process.env.TEST_OTP_CODE && phone === process.env.TEST_OTP_PHONE
    ? process.env.TEST_OTP_CODE
    : null;

// POST /api/auth/otp/request { phone }
const requestPhoneCode = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    if (!notify.smsConfigured()) {
      return res.status(503).json({ message: 'Sign-in with a phone number is not available.' });
    }
    const { phone } = req.body;
    const fixedCode = testOtp(phone);
    const issued = await otp.issueCode('phone_login', phone, { fixedCode });
    if (issued.error) {
      res.set('Retry-After', String(issued.retryAfter));
      return res.status(429).json({
        message:
          issued.error === 'cooldown'
            ? `Please wait ${issued.retryAfter} seconds before asking for another code.`
            : 'Too many codes requested. Try again later.',
        retryAfter: issued.retryAfter,
      });
    }
    if (!fixedCode) {
      await notify.sendSms({
        to: phone,
        text: `${issued.code} is your CivicFix sign-in code. It expires in 10 minutes. Do not share it.`,
      });
    }
    return res.json({ message: 'Code sent', expiresIn: issued.expiresIn });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/otp/verify { phone, code, name? } — signs in, creating a
// citizen account the first time (name required then).
const verifyPhoneCode = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const { phone } = req.body;
    const name = String(req.body.name || '').trim();

    const existing = await User.findOne({ where: { phone } });
    if (!existing && !name) {
      // Check the name before using up the code, so the person can retry.
      return res.status(400).json({ message: 'Enter your name to create your account.', code: 'NAME_REQUIRED' });
    }

    const result = await otp.verifyCode('phone_login', phone, String(req.body.code || '').trim());
    if (!result.ok) {
      return res.status(400).json({
        message:
          result.reason === 'expired'
            ? 'That code has expired. Ask for a new one.'
            : result.reason === 'too_many_attempts'
            ? 'Too many wrong codes. Ask for a new one.'
            : 'That code is not correct.',
      });
    }

    const user = existing || (await User.create({ name: name.slice(0, 100), phone, role: 'citizen' }));
    return signedIn(res, user, req, 'phone', existing ? 200 : 201);
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------- Google

const apiBaseUrl = (req) =>
  (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const callbackUrl = (req) => `${apiBaseUrl(req)}/api/auth/google/callback`;
const adminUrl = () =>
  (process.env.ADMIN_URL || (process.env.CORS_ORIGINS || '').split(',')[0] || '').trim().replace(/\/$/, '');
const appRedirect = () => process.env.APP_REDIRECT_URI || 'civicfix://auth';

const redirectTarget = (client, params) => {
  const query = new URLSearchParams(params).toString();
  if (client === 'admin') return `${adminUrl()}/login?${query}`;
  return `${appRedirect()}?${query}`;
};

// GET /api/auth/google/start?client=app|admin
const googleStart = (req, res) => {
  if (!google.isConfigured()) return res.status(404).json({ message: 'Sign in with Google is not available.' });
  const client = req.query.client === 'admin' ? 'admin' : 'app';
  if (client === 'admin' && !adminUrl()) {
    return res.status(500).json({ message: 'ADMIN_URL is not configured.' });
  }
  const nonce = crypto.randomBytes(16).toString('base64url');
  const state = jwt.sign({ client, nonce, purpose: 'google_state' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  return res.redirect(302, google.authorizationUrl({ redirectUri: callbackUrl(req), state, nonce }));
};

// GET /api/auth/google/callback?code&state — Google sends the user here.
const googleCallback = async (req, res) => {
  let state;
  try {
    state = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (state.purpose !== 'google_state') throw new Error('bad state');
  } catch {
    return res.status(400).send('This sign-in link has expired. Please go back and try again.');
  }
  const fail = (error) => res.redirect(302, redirectTarget(state.client, { error }));

  if (req.query.error || !req.query.code) return fail('cancelled');

  try {
    const idToken = await google.exchangeCode({ code: String(req.query.code), redirectUri: callbackUrl(req) });
    const profile = await google.verifyIdToken(idToken, { nonce: state.nonce });

    let user = await User.findOne({ where: { google_id: profile.sub } });
    if (!user) {
      user = await User.findOne({ where: { email: profile.email } });
      if (user) {
        // Google has verified this email address, so link the account.
        await user.update({ google_id: profile.sub });
      } else if (state.client === 'admin') {
        return fail('not_staff');
      } else {
        user = await User.create({ name: profile.name, email: profile.email, google_id: profile.sub, role: 'citizen' });
      }
    }
    if (state.client === 'admin' && !STAFF_ROLES.includes(user.role)) return fail('not_staff');

    const handOver = await otp.issueCode('google_login', user.id);
    return res.redirect(302, redirectTarget(state.client, { google_code: handOver.code }));
  } catch (error) {
    console.warn('Google sign-in failed:', error.message);
    return fail('google_failed');
  }
};

// POST /api/auth/google/exchange { code } — swaps the hand-over code for a session.
const googleExchange = async (req, res, next) => {
  try {
    const result = await otp.verifyCode('google_login', null, String(req.body?.code || ''));
    if (!result.ok) return res.status(400).json({ message: 'This sign-in has expired. Please try again.' });
    const user = await User.findByPk(result.target);
    if (!user) return res.status(400).json({ message: 'This sign-in has expired. Please try again.' });
    return signedIn(res, user, req, 'google');
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------- staff management (admin)

// GET /api/auth/users?role=staff,admin
const getUsers = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.role) {
      const wanted = String(req.query.role).split(',').filter((role) => roles.includes(role));
      if (wanted.length) where.role = wanted;
    }
    const users = await User.findAll({ where, attributes: USER_FIELDS, order: [['created_at', 'DESC']] });
    return res.json({ users, count: users.length });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/staff: create a staff/admin account with a one-time password.
const createStaff = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const { name, role } = req.body;
    const email = normalizeEmail(req.body.email);
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({
        message: 'An account with this email already exists. Change its role instead.',
        user: sanitizeUser(existing),
      });
    }
    const temporaryPassword = generatePassword();
    const user = await User.create({ name, email, role, password: await bcrypt.hash(temporaryPassword, 10) });
    return res.status(201).json({ user: sanitizeUser(user), temporaryPassword });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/auth/users/:id: change someone's role.
const updateUserRole = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const { id } = req.params;
    if (id === req.user.userId) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.update({ role: req.body.role });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/users/:id/reset-password: new one-time password; signs them out everywhere.
const resetUserPassword = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const temporaryPassword = generatePassword();
    await user.update({ password: await bcrypt.hash(temporaryPassword, 10), failed_logins: 0, locked_until: null });
    await sessions.revokeAllSessions(user.id);
    return res.json({ user: sanitizeUser(user), temporaryPassword });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  STAFF_ROLES,
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  changePassword,
  getProviders,
  forgotPassword,
  resetPassword,
  requestPhoneCode,
  verifyPhoneCode,
  googleStart,
  googleCallback,
  googleExchange,
  getUsers,
  createStaff,
  updateUserRole,
  resetUserPassword,
};
