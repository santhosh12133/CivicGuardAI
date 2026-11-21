const express = require('express');
const { body, param } = require('express-validator');
const {
  register,
  login,
  getUsers,
  getMe,
  changePassword,
  createStaff,
  updateUserRole,
  resetUserPassword,
} = require('../controllers/authController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Public registration intentionally creates citizen accounts only.
// Staff/admin accounts must be provisioned through an administrative process.
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('role')
    .optional()
    .equals('citizen')
    .withMessage('Public registration is limited to the citizen role'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long'),
];

const createStaffValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['staff', 'admin']).withMessage('Role must be staff or admin'),
];

const userIdValidation = [param('id').isUUID().withMessage('User id must be a valid UUID')];

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, changePasswordValidation, changePassword);

// Account management (admins only)
router.get('/users', requireAuth, authorizeRoles('admin'), getUsers);
router.post('/staff', requireAuth, authorizeRoles('admin'), createStaffValidation, createStaff);
router.patch(
  '/users/:id',
  requireAuth,
  authorizeRoles('admin'),
  userIdValidation,
  body('role').isIn(['citizen', 'staff', 'admin']).withMessage('Role must be citizen, staff or admin'),
  updateUserRole
);
router.post('/users/:id/reset-password', requireAuth, authorizeRoles('admin'), userIdValidation, resetUserPassword);

module.exports = router;
