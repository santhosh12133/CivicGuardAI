const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../controllers/authController');
const { requireAuth, optionalAuth, authorizeRoles } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Sign-in endpoints get a stricter per-IP limit than the rest of the API, on
// top of the per-account lock-out and per-code attempt limits.
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '', 10) || 30,
  message: 'Too many sign-in attempts from this network. Please wait a minute.',
});

// E.164, e.g. +919876543210
const PHONE = /^\+[1-9]\d{7,14}$/;

// Public registration intentionally creates citizen accounts only.
// Staff/admin accounts must be provisioned through an administrative process.
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').optional().equals('citizen').withMessage('Public registration is limited to the citizen role'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const newPasswordRule = (field) =>
  body(field).isLength({ min: 8 }).withMessage('New password must be at least 8 characters long');

const phoneRule = body('phone')
  .trim()
  .matches(PHONE)
  .withMessage('Enter the phone number with country code, e.g. +919876543210');

router.get('/providers', auth.getProviders);

router.post('/register', authLimiter, registerValidation, auth.register);
router.post('/login', authLimiter, loginValidation, auth.login);
router.post('/refresh', authLimiter, auth.refresh);
router.post('/logout', optionalAuth, auth.logout);
router.post('/logout-all', requireAuth, auth.logoutAll);

router.get('/me', requireAuth, auth.getMe);
router.post(
  '/change-password',
  requireAuth,
  body('currentPassword').optional().isString(),
  newPasswordRule('newPassword'),
  auth.changePassword
);

// Forgot password (code by email)
router.post(
  '/password/forgot',
  authLimiter,
  body('email').isEmail().withMessage('Valid email is required'),
  auth.forgotPassword
);
router.post(
  '/password/reset',
  authLimiter,
  body('email').isEmail().withMessage('Valid email is required'),
  body('code').trim().notEmpty().withMessage('Enter the code from the email'),
  newPasswordRule('newPassword'),
  auth.resetPassword
);

// Phone number + SMS code
router.post('/otp/request', authLimiter, phoneRule, auth.requestPhoneCode);
router.post(
  '/otp/verify',
  authLimiter,
  phoneRule,
  body('code').trim().matches(/^\d{6}$/).withMessage('Enter the 6-digit code'),
  body('name').optional().isString().isLength({ max: 100 }),
  auth.verifyPhoneCode
);

// Sign in with Google
router.get('/google/start', auth.googleStart);
router.get('/google/callback', auth.googleCallback);
router.post('/google/exchange', authLimiter, auth.googleExchange);

// Account management (admins only)
const userIdValidation = [param('id').isUUID().withMessage('User id must be a valid UUID')];
router.get('/users', requireAuth, authorizeRoles('admin'), auth.getUsers);
router.post(
  '/staff',
  requireAuth,
  authorizeRoles('admin'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['staff', 'admin']).withMessage('Role must be staff or admin'),
  auth.createStaff
);
router.patch(
  '/users/:id',
  requireAuth,
  authorizeRoles('admin'),
  userIdValidation,
  body('role').isIn(['citizen', 'staff', 'admin']).withMessage('Role must be citizen, staff or admin'),
  auth.updateUserRole
);
router.post('/users/:id/reset-password', requireAuth, authorizeRoles('admin'), userIdValidation, auth.resetUserPassword);

module.exports = router;
