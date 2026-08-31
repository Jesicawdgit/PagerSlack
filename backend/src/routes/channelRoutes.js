const express = require('express');
const { param } = require('express-validator');
const channelController = require('../controllers/channelController');
const validateRequest = require('../middleware/validateRequest');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid channel id')],
  validateRequest,
  channelController.getChannel
);

module.exports = router;
