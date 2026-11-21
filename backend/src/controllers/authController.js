const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { User, roles } = require('../models');

const buildToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const requestedRole = req.body.role || 'citizen';

    if (requestedRole !== 'citizen') {
      return res
        .status(403)
        .json({ message: 'Only citizen registrations are allowed via this route' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'citizen',
    });

    const token = buildToken(user.id, user.role);
    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = buildToken(user.id, user.role);
    return res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    return next(error);
  }
};

const USER_FIELDS = ['id', 'name', 'email', 'role', 'created_at', 'updated_at'];
const STAFF_ROLES = ['staff', 'admin'];

// A strong one-time password an admin passes on; the person should change it.
const generatePassword = () => crypto.randomBytes(12).toString('base64url');

const failValidation = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ errors: errors.array() });
  return true;
};

// GET /api/auth/users?role=staff,admin (admin)
const getUsers = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.role) {
      const wanted = String(req.query.role).split(',').filter((role) => roles.includes(role));
      if (wanted.length) where.role = wanted;
    }
    const users = await User.findAll({
      where,
      attributes: USER_FIELDS,
      order: [['created_at', 'DESC']],
    });
    return res.json({ users, count: users.length });
  } catch (error) {
    return next(error);
  }
};

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

// POST /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'Choose a password different from the current one' });
    }
    await user.update({ password: await bcrypt.hash(newPassword, 10) });
    return res.json({ message: 'Password changed' });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/staff (admin): create a staff/admin account with a one-time password.
const createStaff = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const { name, email, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({
        message: 'An account with this email already exists. Change its role instead.',
        user: sanitizeUser(existing),
      });
    }
    const temporaryPassword = generatePassword();
    const user = await User.create({
      name,
      email,
      role,
      password: await bcrypt.hash(temporaryPassword, 10),
    });
    return res.status(201).json({ user: sanitizeUser(user), temporaryPassword });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/auth/users/:id (admin): change someone's role.
const updateUserRole = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const { id } = req.params;
    const { role } = req.body;
    if (id === req.user.userId) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.update({ role });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/users/:id/reset-password (admin): issue a new one-time password.
const resetUserPassword = async (req, res, next) => {
  try {
    if (failValidation(req, res)) return undefined;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const temporaryPassword = generatePassword();
    await user.update({ password: await bcrypt.hash(temporaryPassword, 10) });
    return res.json({ user: sanitizeUser(user), temporaryPassword });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  STAFF_ROLES,
  register,
  login,
  getUsers,
  getMe,
  changePassword,
  createStaff,
  updateUserRole,
  resetUserPassword,
};

