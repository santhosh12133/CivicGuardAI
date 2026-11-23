const express = require('express');
const { body, param, query } = require('express-validator');
const { CATEGORY_IDS } = require('../constants/categories');
const { PRIORITIES } = require('../models');
const {
  createIssue,
  getIssues,
  getAssignees,
  getCategories,
  getStats,
  getIssueById,
  updateIssue,
  deleteIssue,
} = require('../controllers/issueController');
const {
  requireAuth,
  identifyUser,
  authorizeRoles,
} = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

const issueIdValidation = [
  param('id').isUUID().withMessage('Issue id must be a valid UUID'),
];

const createIssueValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('photo_url')
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage('Photo URL must be valid'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude is invalid'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude is invalid'),
  // New reports always start Open. Moving an issue to In Progress or Resolved
  // is a staff/admin action through PUT /api/issues/:id.
  body('status')
    .optional()
    .equals('Open')
    .withMessage('New issues always start as Open'),
  body('category')
    .optional()
    .isIn(CATEGORY_IDS)
    .withMessage('Unknown category'),
];

const listValidation = [
  query('status').optional().isIn(['Open', 'In Progress', 'Resolved']).withMessage('Unknown status'),
  query('category').optional().isIn(CATEGORY_IDS).withMessage('Unknown category'),
  query('mine').optional().isIn(['true', 'false']),
  query('needs_review').optional().isIn(['true', 'false']),
  // Staff only (checked in the controller): me, none, or a user id.
  query('assigned_to')
    .optional()
    .custom((value) => value === 'me' || value === 'none' || /^[0-9a-f-]{36}$/i.test(value))
    .withMessage('assigned_to must be me, none or a user id'),
  query('priority').optional().isIn(PRIORITIES).withMessage(`Priority must be one of: ${PRIORITIES.join(', ')}`),
  query('overdue').optional().isIn(['true', 'false']),
];

const updateIssueValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty'),
  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty'),
  body('photo_url').optional().isURL().withMessage('Photo URL must be valid'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude is invalid'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude is invalid'),
  body('status')
    .optional()
    .isIn(['Open', 'In Progress', 'Resolved'])
    .withMessage('Status must be Open, In Progress, or Resolved'),
  body('category')
    .optional()
    .isIn(CATEGORY_IDS)
    .withMessage('Unknown category'),
  body('note')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Note must be 1000 characters or fewer'),
  // priority, assigned_to and due_date are validated in the controller (they accept '' / null to clear).
];

router.post(
  '/',
  requireAuth,
  upload.single('image'),
  createIssueValidation,
  createIssue
);
router.get('/', identifyUser, listValidation, getIssues);
router.get('/categories', getCategories);
router.get('/assignees', requireAuth, authorizeRoles('staff', 'admin'), getAssignees);
router.get('/stats', requireAuth, authorizeRoles('staff', 'admin'), getStats);
router.get('/:id', identifyUser, issueIdValidation, getIssueById);
router.put(
  '/:id',
  requireAuth,
  authorizeRoles('staff', 'admin'),
  upload.single('image'),
  issueIdValidation,
  updateIssueValidation,
  updateIssue
);
router.delete(
  '/:id',
  requireAuth,
  authorizeRoles('admin'),
  issueIdValidation,
  deleteIssue
);

module.exports = router;
