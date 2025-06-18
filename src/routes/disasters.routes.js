import express from 'express';
import multer from 'multer';
import { Geolocation, verifyImage } from '../controller/AI.controller.js';
import {
  createDisaster,
  deleteDisaster,
  getAllDisasters,
  getDisasterById,
  updateDisaster,
<<<<<<< HEAD
} from '../controller/disaster.controller';
import verifyJWT from '../middleware/verifyToken.middleware.js';
const router = express();

router.route('/').get(verifyJWT, getAllDisasters);

router
  .route('/:id')
  .get(verifyJWT, getDisasterById)
  .put(verifyJWT, updateDisaster)
  .delete(verifyJWT, deleteDisaster);

=======
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

export default router;
>>>>>>> b4eea64afcef86c76dc5f1de8f73c96d3894e23d
router.route('/create').post(verifyJWT, createDisaster);
