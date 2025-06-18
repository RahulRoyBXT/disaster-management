import express from 'express';
import multer from 'multer';
import { Geolocation, verifyImage } from '../controller/AI.controller.js';
const router = express();

// Store multer image in memory

const upload = multer({ storage: multer.memoryStorage() });

// router.route('/').get(getAllDisasters);

// router.route('/:id').get(getDisasterById).put(updateDisaster).delete(deleteDisaster);

// router.route('/create').post(createDisaster);

// Verify Disaster image
router.route('/:id/verify-image').post(upload.single('image'), verifyImage);

// Extract location from description
router.route('/geocode').post(upload.none(), Geolocation);

export default router;
