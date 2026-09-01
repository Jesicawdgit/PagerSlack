const express = require('express');
const { param } = require('express-validator');
const demoController = require('../controllers/demoController');
const validateRequest = require('../middleware/validateRequest');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/services', demoController.listServices);

router.post(
  '/services/:id/fail',
  [param('id').isMongoId().withMessage('Invalid service id')],
  validateRequest,
  demoController.failService
);

router.post(
  '/services/:id/restore',
  [param('id').isMongoId().withMessage('Invalid service id')],
  validateRequest,
  demoController.restoreService
);

router.get('/orders', demoController.getOrders);

module.exports = router;
