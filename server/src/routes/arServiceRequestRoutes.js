'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createArServiceRequestSchema } = require('../validators/arServiceRequestValidators');
const {
  createRequest,
  listMyRequests,
  getMyRequest,
} = require('../controllers/arServiceRequestController');

router.use(protect);

router.post('/', validate(createArServiceRequestSchema), createRequest);
router.get('/', listMyRequests);
router.get('/:id', getMyRequest);

module.exports = router;
