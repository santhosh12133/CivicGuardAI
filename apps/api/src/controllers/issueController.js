const { validationResult } = require('express-validator');
const { Op, fn, col, QueryTypes } = require('sequelize');
const { Issue, IssueUpdate, sequelize, statuses } = require('../models');
const { CATEGORIES, CATEGORY_IDS, DEFAULT_CATEGORY } = require('../constants/categories');
const {
  isStaff,
  reporterInclude,
  detailIncludes,
  detailOrder,
  serializeIssue,
} = require('../utils/serializeIssue');
const { reverseGeocode } = require('../utils/geocoding');
const { computePHash, findSimilarImages } = require('../utils/phash');
const { getCaptureDate, checkPhotoAge } = require('../utils/photoDate');
const { savePhoto, deletePhotos } = require('../utils/photoStore');
const path = require('path');

// EXIF + geo distance validation
// We use exiftool to read EXIF metadata from uploaded images (if present)
// and geolib to compute distance between EXIF GPS and device GPS.
const { exiftool } = require('../utils/exiftool');
const { getDistance } = require('geolib');

const createIssue = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, latitude, longitude } = req.body;
    const category = req.body.category || DEFAULT_CATEGORY;

    // Convert latitude and longitude to numbers if they're strings
    let lat = parseFloat(latitude);
    let lon = parseFloat(longitude);

    // Validate location coordinates
    if (
      isNaN(lat) ||
      isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res.status(400).json({
        message: `Invalid location coordinates. Latitude: ${lat}, Longitude: ${lon}`,
      });
    }

    // Handle file upload - get photo URL from uploaded file
    let photoUrl = null;
    if (req.file) {
      // Construct full URL to the uploaded image.
      // If API_HOST is set (e.g., for mobile/tunnel access), use it so the app
      // always gets a consistent, reachable URL. Otherwise fall back to req.host.
      let host = req.get('host');
      if (process.env.API_HOST) {
        host = process.env.API_HOST;
      }
      const protocol =
        process.env.API_PROTOCOL ||
        req.protocol ||
        req.headers['x-forwarded-proto'] ||
        'http';
      photoUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    } else if (req.body.photo_url) {
      // Fallback to photo_url if provided (for backward compatibility)
      photoUrl = req.body.photo_url;
    }

    // Flag to mark issues that require manual review (e.g. when EXIF GPS is missing)
    let needs_review = false;

    // If user provided a remote photo URL (no uploaded file), we won't have EXIF data.
    // Mark this for manual review so admins can validate the report.
    if (!req.file && req.body.photo_url) {
      needs_review = true;
    }

    // Reverse geocode coordinates to get address
    let address = null;
    try {
      if (latitude && longitude) {
        address = await reverseGeocode(latitude, longitude);
      }
    } catch (geocodeError) {
      // Even if geocoding fails, we have the coordinates
      // The geocoding function already returns a fallback, but handle errors here
      console.warn('Reverse geocoding failed:', geocodeError.message);
      address = null; // Will be set by reverseGeocode function
    }
    if (req.file) {
      const uploadedPath =
        req.file.path ||
        path.join(__dirname, '../../uploads', req.file.filename);

      try {
        // Read EXIF metadata from the uploaded file
        const exif = await exiftool.read(uploadedPath);

        // Look for various forms of GPS data
        const gpsFields = Object.keys(exif).filter((key) =>
          key.startsWith('GPS')
        );

        // ========== EXIF VALIDATION ==========
        // Accept camera photos (with Make/Model) or gallery photos (without Make/Model)

        // 1. REJECT if no EXIF data or only has minimal/generic fields
        // Check for meaningful EXIF data - at least one of: Make/Model (camera), DateTimeOriginal, GPS
        const hasMakeOrModel = !!(exif.Make || exif.Model);
        const hasDateTimeOriginal = !!exif.DateTimeOriginal;
        const hasGPS = gpsFields.length > 0;
        const hasSignificantExif =
          hasMakeOrModel || hasDateTimeOriginal || hasGPS;

        if (!exif || Object.keys(exif).length === 0 || !hasSignificantExif) {
          return res.status(400).json({
            message:
              'Photo has no camera metadata. Please capture a new photo directly with your device camera or select from your device photo which has accurate location information.',
          });
        }

        // ========== DATE VALIDATION ==========
        // Only dates embedded in the photo count. Filesystem dates such as
        // FileModifyDate are the time the server saved the upload, so they
        // would make every photo look fresh. See utils/photoDate.js.
        const capture = getCaptureDate(exif);

        // 2. REJECT if the photo carries no capture date
        if (!capture) {
          return res.status(400).json({
            message:
              'Photo has no date metadata. Please capture a new photo or select one with date information.',
          });
        }

        const age = checkPhotoAge(capture);

        // 3. REJECT if older than 24 hours or dated in the future
        if (!age.ok && age.reason === 'stale') {
          return res.status(400).json({
            message:
              'Photo is older than 24 hours. Please capture a fresh photo or select a recent one.',
          });
        }
        if (!age.ok && age.reason === 'future') {
          return res.status(400).json({
            message:
              "Photo's capture date is in the future. Please check your device's date and time, then capture a new photo.",
          });
        }

        // Without a timezone the exact age cannot be confirmed; let staff check it.
        if (age.uncertain) {
          needs_review = true;
        }

        // ========== GPS VALIDATION ==========
        let exifLat = null;
        let exifLon = null;
        let gpsRef = { lat: 'N', lon: 'E' };
        let hasEmbeddedGPS = false;

        // Try multiple ways to extract GPS from EXIF
        // Method 1: Direct GPS fields (usually works)
        if (
          exif.GPSLatitude !== undefined &&
          exif.GPSLongitude !== undefined &&
          !isNaN(exif.GPSLatitude) &&
          !isNaN(exif.GPSLongitude)
        ) {
          exifLat = exif.GPSLatitude;
          exifLon = exif.GPSLongitude;
          gpsRef.lat = exif.GPSLatitudeRef || 'N';
          gpsRef.lon = exif.GPSLongitudeRef || 'E';
          hasEmbeddedGPS = true;
        }
        // Method 2: GPSPosition string (sometimes used)
        else if (exif.GPSPosition && typeof exif.GPSPosition === 'string') {
          const coords = exif.GPSPosition.split(' ').map(Number);
          if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            exifLat = coords[0];
            exifLon = coords[1];
            hasEmbeddedGPS = true;
          }
        }
        // Method 3: Check if there are ANY GPS fields present (indicates location was recorded)
        // In this case, use device location as it's more reliable
        else if (Object.keys(exif).some((k) => k.startsWith('GPS'))) {
          exifLat = lat;
          exifLon = lon;
          hasEmbeddedGPS = true; // Mark as having GPS info even though we're using device location
        }

        const deviceLatNum = lat;
        const deviceLonNum = lon;

        // 4. If no EXIF GPS at all, use device location (for gallery photos)
        if (!hasEmbeddedGPS) {
          exifLat = deviceLatNum;
          exifLon = deviceLonNum;
        }

        // Handle GPS coordinate formats (can be array or string or number)
        let exifLatNum = null;
        let exifLonNum = null;

        if (Array.isArray(exifLat)) {
          // GPS format: [degrees, minutes, seconds]
          exifLatNum = exifLat[0] + exifLat[1] / 60 + exifLat[2] / 3600;
        } else {
          exifLatNum = Number(exifLat);
        }

        if (Array.isArray(exifLon)) {
          // GPS format: [degrees, minutes, seconds]
          exifLonNum = exifLon[0] + exifLon[1] / 60 + exifLon[2] / 3600;
        } else {
          exifLonNum = Number(exifLon);
        }

        // Apply GPS reference directions (N/S, E/W)
        if (gpsRef.lat === 'S') exifLatNum *= -1;
        if (gpsRef.lon === 'W') exifLonNum *= -1;

        // 5. REJECT if GPS coordinates are invalid
        if (
          isNaN(exifLatNum) ||
          isNaN(exifLonNum) ||
          isNaN(deviceLatNum) ||
          isNaN(deviceLonNum)
        ) {
          return res.status(400).json({
            message:
              'Location coordinates are invalid. Please try again with valid coordinates.',
          });
        }

        const distanceMeters = getDistance(
          { latitude: exifLatNum, longitude: exifLonNum },
          { latitude: deviceLatNum, longitude: deviceLonNum }
        );

        // 6. REJECT if photo location is more than 200m from device location
        if (distanceMeters > 200) {
          return res.status(400).json({
            message:
              `Photo was taken ${distanceMeters.toFixed(0)}m away from reported location. ` +
              `Photo GPS: (${exifLatNum.toFixed(6)}, ${exifLonNum.toFixed(6)}), ` +
              `Reported: (${deviceLatNum.toFixed(6)}, ${deviceLonNum.toFixed(6)}). ` +
              `Please use a photo taken at the exact location of the issue.`,
          });
        }
      } catch (exifErr) {
        console.warn('Could not read photo metadata:', exifErr.message);
        return res.status(400).json({
          message:
            'Unable to read photo metadata. Please capture a new photo with your device camera.',
        });
      }
    }

    // ==================== pHash DUPLICATE DETECTION ====================
    // Compute pHash for the uploaded image and check for duplicates
    let phash = null;
    if (req.file) {
      try {
        const uploadedPath =
          req.file.path ||
          path.join(__dirname, '../../uploads', req.file.filename);

        phash = await computePHash(uploadedPath);

        // Fetch all existing pHashes from the database
        const existingIssues = await Issue.findAll({
          attributes: ['id', 'phash'],
          where: { phash: { [require('sequelize').Op.ne]: null } },
        });

        // Find similar images (>= 90% similarity)
        const SIMILARITY_THRESHOLD = 90;
        const similarImages = findSimilarImages(
          phash,
          existingIssues,
          SIMILARITY_THRESHOLD
        );

        if (similarImages.length > 0) {
          // Mark for manual review instead of blocking
          needs_review = true;
        }
      } catch (phashErr) {
        // If pHash computation fails, log but don't block the upload
        console.warn('Could not compute photo hash:', phashErr.message);
        // We don't set needs_review here - let EXIF validation handle it
      }
    }
    // ====================================================================

    // Persist the photo before the issue, so a stored photo_url always resolves.
    // If anything below fails, the upload middleware removes it again.
    if (req.file) {
      await savePhoto(req.file);
    }

    const issue = await Issue.create({
      title,
      description,
      category,
      user_id: req.user.userId,
      photo_url: photoUrl,
      latitude,
      longitude,
      address,
      // Every new report starts Open; only staff/admin move it on (PUT).
      status: 'Open',
      needs_review,
      phash,
    });
    // First entry of the public timeline.
    await IssueUpdate.create({
      issue_id: issue.id,
      user_id: req.user.userId,
      to_status: 'Open',
    });

    const created = await Issue.findByPk(issue.id, { include: detailIncludes, order: detailOrder });
    return res.status(201).json(serializeIssue(created, req.user));
  } catch (error) {
    return next(error);
  }
};

// GET /api/issues?status=Open&category=pothole&mine=true&needs_review=true
const getIssues = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;
    if (req.query.needs_review === 'true') where.needs_review = true;
    if (req.query.mine === 'true') {
      if (!req.user) {
        return res.status(401).json({ message: 'Sign in to see your reports' });
      }
      where.user_id = req.user.userId;
    }

    const issues = await Issue.findAll({
      where,
      include: isStaff(req.user) ? [reporterInclude] : [],
      order: [['created_at', 'DESC']],
    });
    return res.json(issues.map((issue) => serializeIssue(issue, req.user)));
  } catch (error) {
    return next(error);
  }
};

// GET /api/issues/categories
const getCategories = (req, res) => res.json(CATEGORIES);

// GET /api/issues/stats (staff/admin)
const getStats = async (req, res, next) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const countBy = async (column) => {
      const rows = await Issue.findAll({
        attributes: [column, [fn('COUNT', col('id')), 'count']],
        group: [column],
        raw: true,
      });
      return Object.fromEntries(rows.map((row) => [row[column], Number(row.count)]));
    };

    const [byStatusRaw, byCategoryRaw, total, needsReview, reportedLast7, resolvedLast7, overdue, avgRows] =
      await Promise.all([
        countBy('status'),
        countBy('category'),
        Issue.count(),
        Issue.count({ where: { needs_review: true, status: { [Op.ne]: 'Resolved' } } }),
        Issue.count({ where: { created_at: { [Op.gte]: weekAgo } } }),
        IssueUpdate.count({
          where: { to_status: 'Resolved', created_at: { [Op.gte]: weekAgo } },
          distinct: true,
          col: 'issue_id',
        }),
        Issue.count({ where: { status: { [Op.ne]: 'Resolved' }, created_at: { [Op.lt]: weekAgo } } }),
        // Time from report to the first "Resolved" for issues that are resolved now.
        sequelize.query(
          `SELECT AVG(EXTRACT(EPOCH FROM (u.resolved_at - i.created_at))) / 3600 AS hours
             FROM issues i
             JOIN (SELECT issue_id, MIN(created_at) AS resolved_at
                     FROM issue_updates WHERE to_status = 'Resolved' GROUP BY issue_id) u
               ON u.issue_id = i.id
            WHERE i.status = 'Resolved'`,
          { type: QueryTypes.SELECT }
        ),
      ]);

    const byStatus = Object.fromEntries(statuses.map((status) => [status, byStatusRaw[status] || 0]));
    const byCategory = Object.fromEntries(CATEGORY_IDS.map((id) => [id, byCategoryRaw[id] || 0]));
    const hours = avgRows[0] && avgRows[0].hours !== null ? Number(avgRows[0].hours) : null;

    return res.json({
      total,
      byStatus,
      byCategory,
      needsReview,
      overdue,
      last7Days: { reported: reportedLast7, resolved: resolvedLast7 },
      avgResolutionHours: hours === null ? null : Math.round(hours * 10) / 10,
    });
  } catch (error) {
    return next(error);
  }
};

const getIssueById = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const issue = await Issue.findByPk(req.params.id, { include: detailIncludes, order: detailOrder });
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    return res.json(serializeIssue(issue, req.user));
  } catch (error) {
    return next(error);
  }
};

const updateIssue = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    // Only enforce validation errors if there's no file upload.
    // When uploading a file, we skip strict field validation since
    // multipart form fields may not serialize the same way as JSON.
    if (!errors.isEmpty() && !req.file) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const issue = await Issue.findByPk(id);

    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    // req.body may be undefined when the request is multipart/form-data
    // (for example when uploading a file only). Safely default to an
    // empty object so destructuring doesn't throw.
    const body = req.body || {};
    let { title, description, photo_url, latitude, longitude, status, category } = body;
    // A note for the timeline, e.g. "Crew scheduled for Monday".
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 1000) {
      return res.status(400).json({ message: 'Note must be 1000 characters or fewer' });
    }
    if (category !== undefined && !CATEGORY_IDS.includes(category)) {
      return res.status(400).json({ message: 'Unknown category' });
    }

    // When status is sent as a multipart form field, it may be a string.
    // Ensure we're comparing against the correct value.
    if (typeof status === 'string') {
      status = status.trim();
    }

    // Build updates from provided fields
    const updates = {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(photo_url !== undefined && { photo_url }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(status !== undefined && { status }),
      ...(category !== undefined && { category }),
    };

    // If a file was uploaded (multipart request), construct the public URL
    // and include it in the updates. This keeps the update logic compatible
    // with both JSON and multipart/form-data requests.
    if (req.file) {
      let host = req.get('host');
      if (process.env.API_HOST) {
        host = process.env.API_HOST;
      }
      const protocol =
        process.env.API_PROTOCOL ||
        req.protocol ||
        req.headers['x-forwarded-proto'] ||
        'http';
      const uploadedUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

      // Determine if this should be stored as a resolved photo.
      // Check: (1) if status is being set to Resolved in this request,
      // or (2) if the issue is already Resolved in the database.
      const statusToCheck = status || issue.status;
      const willBeResolved = statusToCheck === 'Resolved';

      if (willBeResolved) {
        updates.resolved_photo_url = uploadedUrl;
      } else {
        updates.photo_url = uploadedUrl;
      }
    }

    if (!Object.keys(updates).length && !note) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    if (updates.status && !statuses.includes(updates.status)) {
      return res.status(400).json({ message: 'Invalid status provided' });
    }

    if (req.file) {
      await savePhoto(req.file);
    }

    const previousStatus = issue.status;
    if (Object.keys(updates).length) {
      await issue.update(updates);
    }

    // Record what citizens should see in the timeline. Replaced photos are kept
    // because earlier timeline entries still show them.
    const statusChanged = updates.status !== undefined && updates.status !== previousStatus;
    const addedPhoto = req.file ? updates.resolved_photo_url || updates.photo_url : null;
    if (statusChanged || note || addedPhoto) {
      await IssueUpdate.create({
        issue_id: issue.id,
        user_id: req.user.userId,
        from_status: statusChanged ? previousStatus : null,
        to_status: statusChanged ? updates.status : null,
        note: note || null,
        photo_url: addedPhoto,
      });
    }

    const updated = await Issue.findByPk(issue.id, { include: detailIncludes, order: detailOrder });
    return res.json(serializeIssue(updated, req.user));
  } catch (error) {
    return next(error);
  }
};

const deleteIssue = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const issue = await Issue.findByPk(id);

    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    const timelinePhotos = (await IssueUpdate.findAll({ where: { issue_id: id }, attributes: ['photo_url'], raw: true }))
      .map((update) => update.photo_url)
      .filter(Boolean);
    await IssueUpdate.destroy({ where: { issue_id: id } });
    await issue.destroy();
    // The issue's photos are no longer reachable from anywhere; free the space.
    await deletePhotos(issue.photo_url, issue.resolved_photo_url, ...timelinePhotos).catch((error) =>
      console.warn('Could not remove photos of deleted issue:', error.message)
    );

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createIssue,
  getIssues,
  getCategories,
  getStats,
  getIssueById,
  updateIssue,
  deleteIssue,
};
