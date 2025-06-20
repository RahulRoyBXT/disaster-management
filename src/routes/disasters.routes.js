import express from 'express';
import multer from 'multer';
import { Geolocation, verifyImage } from '../controller/AI.controller.js';
import {
  createDisaster,
  deleteDisaster,
  getAllDisasters,
  getAllReports,
  getDisasterById,
  getNearbyDisasters,
  getOfficialUpdates,
  socialMedia,
  updateDisaster,
} from '../controller/disaster.controller.js';
import { createDisasterLimiter, externalApiLimiter } from '../middleware/rateLimiter.js';
import { validateQuery, validateRequest } from '../middleware/validation.middleware.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';
import {
  createDisasterSchema,
  nearbyDisastersQuerySchema,
  officialUpdatesQuerySchema,
  socialMediaQuerySchema,
  updateDisasterSchema,
} from '../validation/disaster.validation.js';

const router = express();

router.use(verifyJWT);

// Store multer image in memory

const upload = multer({ storage: multer.memoryStorage() });

router.route('/').get(getAllDisasters);

router
  .route('/:id')
  .get(getDisasterById)
  .put(validateRequest(updateDisasterSchema), updateDisaster)
  .delete(deleteDisaster);

// Verify Disaster image
router.route('/:id/verify-image').post(upload.single('image'), verifyImage);

// Extract location from description
router.route('/geocode').post(upload.none(), Geolocation);

router
  .route('/create')
  .post(createDisasterLimiter, validateRequest(createDisasterSchema), createDisaster);

// Geospatial query route - Find nearby disasters
router.route('/nearby').get(validateRequest(nearbyDisastersQuerySchema), getNearbyDisasters);

router
  .route('/:id/social-media')
  .get(externalApiLimiter, validateQuery(socialMediaQuerySchema), socialMedia);
// all all reports for a disaster
router.route('/:id/reports').get(getAllReports);
// Get official updates for a disaster with rate limiting
router
  .route('/:id/official-updates')
  .get(externalApiLimiter, validateQuery(officialUpdatesQuerySchema), getOfficialUpdates);

export default router;
