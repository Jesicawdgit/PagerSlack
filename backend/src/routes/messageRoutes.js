const express = require('express');
const { param, body } = require('express-validator');
const messageController = require('../controllers/messageController');
const validateRequest = require('../middleware/validateRequest');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  protect,
  [param('id').isMongoId().withMessage('Invalid channel id')],
  validateRequest,
  messageController.listMessages
);

router.post(
  '/',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid channel id'),
    body('content').trim().notEmpty().withMessage('Message content is required').isLength({ max: 2000 }),
  ],
  validateRequest,
  messageController.createMessage
);

module.exports = router;
