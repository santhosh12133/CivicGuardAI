const { User, IssueUpdate } = require('../models');

const STAFF_ROLES = ['staff', 'admin'];
// Triage fields are internal: citizens and the public don't see them.
const STAFF_ONLY_FIELDS = ['priority', 'assigned_to', 'assignee', 'due_date', 'reporter', 'user_id'];
const isStaff = (viewer) => Boolean(viewer && STAFF_ROLES.includes(viewer.role));

// Associations to load when an issue is returned with its details.
const reporterInclude = { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] };
const assigneeInclude = { model: User, as: 'assignee', attributes: ['id', 'name', 'role'] };
// What staff and admins see in lists: who reported it and who is handling it.
const staffListIncludes = [reporterInclude, assigneeInclude];
const updatesInclude = {
  model: IssueUpdate,
  as: 'updates',
  include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role'] }],
};
const detailIncludes = [reporterInclude, assigneeInclude, updatesInclude];
const detailOrder = [[{ model: IssueUpdate, as: 'updates' }, 'created_at', 'ASC']];

const serializeUpdate = (update, viewer) => {
  const author = update.author;
  let authorView = null;
  if (author) {
    const isOfficial = STAFF_ROLES.includes(author.role);
    const isViewer = viewer && author.id === viewer.userId;
    authorView = {
      role: author.role,
      // Officials are named; a citizen's name is only shown to staff and to themselves.
      name: isOfficial || isStaff(viewer) || isViewer ? author.name : null,
      is_me: Boolean(isViewer),
    };
  }
  return {
    id: update.id,
    from_status: update.from_status,
    to_status: update.to_status,
    note: update.note,
    photo_url: update.photo_url,
    created_at: update.created_at,
    author: authorView,
  };
};

const OVERDUE_AFTER_DAYS = 7;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Unresolved and past its due date; without a due date, unresolved for more than
 * OVERDUE_AFTER_DAYS days. Same rule as the overdue filter and statistic.
 */
const isOverdue = (issue) => {
  if (issue.status === 'Resolved') return false;
  if (issue.due_date) return String(issue.due_date) < today();
  return new Date(issue.created_at).getTime() < Date.now() - OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000;
};

/**
 * Shapes an issue for a given viewer ({ userId, role } or undefined).
 *
 * Everyone sees the report and its timeline. Only staff/admin see who
 * reported it; a citizen only learns whether it is their own (is_mine).
 */
const serializeIssue = (issue, viewer) => {
  const plain = typeof issue.get === 'function' ? issue.get({ plain: false }) : issue;
  const json = typeof issue.toJSON === 'function' ? issue.toJSON() : { ...issue };

  const result = { ...json };
  result.is_mine = Boolean(viewer && json.user_id && json.user_id === viewer.userId);

  if (isStaff(viewer)) {
    result.reporter = json.reporter
      ? { id: json.reporter.id, name: json.reporter.name, email: json.reporter.email }
      : null;
    result.assignee = json.assignee ? { id: json.assignee.id, name: json.assignee.name } : null;
    result.is_overdue = isOverdue(json);
  } else {
    for (const field of STAFF_ONLY_FIELDS) delete result[field];
  }

  if (Array.isArray(plain.updates)) {
    result.updates = plain.updates.map((update) => serializeUpdate(update, viewer));
  } else {
    delete result.updates;
  }

  return result;
};

module.exports = {
  STAFF_ROLES,
  OVERDUE_AFTER_DAYS,
  isStaff,
  isOverdue,
  reporterInclude,
  staffListIncludes,
  detailIncludes,
  detailOrder,
  serializeIssue,
};
