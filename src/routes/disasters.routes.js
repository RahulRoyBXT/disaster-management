import express from 'express';
import { verifyImage } from '../controller/AI.controller.js';
const router = express();

// router.route('/').get(getAllDisasters);

// router.route('/:id').get(getDisasterById).put(updateDisaster).delete(deleteDisaster);
router.route('/:id/verify-image').post(verifyImage);

// router.route('/create').post(createDisaster);

export default router;
