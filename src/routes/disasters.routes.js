import express from 'express';
import {
  createDisaster,
  deleteDisaster,
  getAllDisasters,
  getDisasterById,
  updateDisaster,
} from '../controller/disaster.controller';
import verifyJWT from '../middleware/verifyToken.middleware.js';
const router = express();

router.route('/').get(verifyJWT, getAllDisasters);

router
  .route('/:id')
  .get(verifyJWT, getDisasterById)
  .put(verifyJWT, updateDisaster)
  .delete(verifyJWT, deleteDisaster);

router.route('/create').post(verifyJWT, createDisaster);
