const express = require('express');
const { body } = require('express-validator');
const { register, login, getUsers } = require('../controllers/authController');
const {
  authenticateToken,
  authorizeRoles,
} = require('../middleware/authMiddleware');

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

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/users', authenticateToken, authorizeRoles('admin'), getUsers);

module.exports = router;
