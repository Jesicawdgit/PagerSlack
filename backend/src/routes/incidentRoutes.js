const express = require('express');
const { body, param } = require('express-validator');
const incidentController = require('../controllers/incidentController');
const validateRequest = require('../middleware/validateRequest');
const { protect } = require('../middleware/authMiddleware');
const { SEVERITIES } = require('../models/Incident');

const router = express.Router();

router.use(protect);

router.get('/', incidentController.listIncidents);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('severity').isIn(SEVERITIES).withMessage('Invalid severity'),
    body('channel').isMongoId().withMessage('Invalid channel id'),
  ],
  validateRequest,
  incidentController.createIncident
);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid incident id')],
  validateRequest,
  incidentController.getIncident
);

router.get(
  '/:id/history',
  [param('id').isMongoId().withMessage('Invalid incident id')],
  validateRequest,
  incidentController.getIncidentHistory
);

module.exports = router;
