import express from 'express';
import multer from 'multer';
import { Geolocation, verifyImage } from '../controller/AI.controller.js';
import {
  createDisaster,
  deleteDisaster,
  getAllDisasters,
  getAllReports,
  getDisasterById,
  socialMedia,
  updateDisaster,
} from '../controller/disaster.controller.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';

const router = express();

// Store multer image in memory

const upload = multer({ storage: multer.memoryStorage() });

// router.route('/').get(getAllDisasters);
router.route('/').get(verifyJWT, getAllDisasters);

// router.route('/:id').get(getDisasterById).put(updateDisaster).delete(deleteDisaster);
router
  .route('/:id')
  .get(verifyJWT, getDisasterById)
  .put(verifyJWT, updateDisaster)
  .delete(verifyJWT, deleteDisaster);

// router.route('/create').post(createDisaster);

// Verify Disaster image
router.route('/:id/verify-image').post(upload.single('image'), verifyImage);

// Extract location from description
router.route('/geocode').post(upload.none(), Geolocation);

router.route('/create').post(verifyJWT, createDisaster);

router.route('/social-media').get(verifyJWT, socialMedia);
// all all reports for a disaster
router.route('/:id/reports').get(verifyJWT, getAllReports);

export default router;
