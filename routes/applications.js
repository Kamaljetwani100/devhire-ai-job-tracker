const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Application = require('../models/Application');
const { protect } = require('../middleware/auth');

const VALID_STATUSES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];

// All routes require authentication
router.use(protect);

/* ---- Validation rules ---- */
const appRules = [
  body('company').trim().notEmpty().withMessage('Company name is required'),
  body('role').trim().notEmpty().withMessage('Role is required'),
  body('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('dateApplied').optional().isISO8601().withMessage('Invalid date format'),
  body('url').optional({ checkFalsy: true }).isURL().withMessage('Invalid URL format'),
];

const statusRule = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

/* ---- GET /api/applications ---- */
// Query params: status, search, sort (date_desc|date_asc|company), page, limit
router.get('/', async (req, res) => {
  try {
    const { status, search, sort = 'date_desc', page = 1, limit = 50 } = req.query;

    const filter = { user: req.user._id };

    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ company: regex }, { role: regex }, { location: regex }, { notes: regex }];
    }

    const sortMap = {
      date_desc: { createdAt: -1 },
      date_asc: { createdAt: 1 },
      company: { company: 1 },
    };
    const sortOption = sortMap[sort] || { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [applications, total] = await Promise.all([
      Application.find(filter).sort(sortOption).skip(skip).limit(Number(limit)).lean(),
      Application.countDocuments(filter),
    ]);

    // Stats summary
    const stats = await Application.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusCounts = VALID_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    stats.forEach(({ _id, count }) => { if (statusCounts[_id] !== undefined) statusCounts[_id] = count; });

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      statusCounts,
      data: applications,
    });
  } catch (err) {
    console.error('Get applications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch applications.' });
  }
});

/* ---- GET /api/applications/:id ---- */
router.get('/:id', async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid application ID.' });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch application.' });
  }
});

/* ---- POST /api/applications ---- */
router.post('/', appRules, validate, async (req, res) => {
  try {
    const { company, role, status, dateApplied, salary, location, url, notes } = req.body;

    const application = await Application.create({
      user: req.user._id,
      company,
      role,
      status: status || 'Applied',
      dateApplied: dateApplied || Date.now(),
      salary: salary || '',
      location: location || '',
      url: url || '',
      notes: notes || '',
    });

    res.status(201).json({ success: true, data: application });
  } catch (err) {
    console.error('Create application error:', err);
    res.status(500).json({ success: false, message: 'Failed to create application.' });
  }
});

/* ---- PUT /api/applications/:id ---- */
router.put('/:id', appRules, validate, async (req, res) => {
  try {
    const { company, role, status, dateApplied, salary, location, url, notes } = req.body;

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { company, role, status, dateApplied, salary, location, url, notes },
      { new: true, runValidators: true }
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid application ID.' });
    }
    console.error('Update application error:', err);
    res.status(500).json({ success: false, message: 'Failed to update application.' });
  }
});

/* ---- PATCH /api/applications/:id/status ---- */
router.patch('/:id/status', statusRule, validate, async (req, res) => {
  try {
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid application ID.' });
    }
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

/* ---- DELETE /api/applications/:id ---- */
router.delete('/:id', async (req, res) => {
  try {
    const application = await Application.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    res.status(200).json({ success: true, message: 'Application deleted successfully.' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid application ID.' });
    }
    console.error('Delete application error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete application.' });
  }
});

module.exports = router;
