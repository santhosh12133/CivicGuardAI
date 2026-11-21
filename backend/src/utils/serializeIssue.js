const { User, IssueUpdate } = require('../models');

const STAFF_ROLES = ['staff', 'admin'];
const isStaff = (viewer) => Boolean(viewer && STAFF_ROLES.includes(viewer.role));

// Associations to load when an issue is returned with its details.
const reporterInclude = { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] };
const updatesInclude = {
  model: IssueUpdate,
  as: 'updates',
  include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role'] }],
};
const detailIncludes = [reporterInclude, updatesInclude];
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
  } else {
    delete result.reporter;
    delete result.user_id;
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
  isStaff,
  reporterInclude,
  detailIncludes,
  detailOrder,
  serializeIssue,
};
