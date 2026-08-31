const express = require('express');
const { body, param } = require('express-validator');
const teamController = require('../controllers/teamController');
const validateRequest = require('../middleware/validateRequest');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', teamController.listTeams);

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Name is required')],
  validateRequest,
  teamController.createTeam
);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid team id')],
  validateRequest,
  teamController.getTeam
);

router.get(
  '/:teamId/channels',
  [param('teamId').isMongoId().withMessage('Invalid team id')],
  validateRequest,
  teamController.listChannels
);

router.post(
  '/:teamId/channels',
  [
    param('teamId').isMongoId().withMessage('Invalid team id'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ],
  validateRequest,
  teamController.createChannel
);

module.exports = router;
