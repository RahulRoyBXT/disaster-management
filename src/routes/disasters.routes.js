import express from 'express';
import {
  createDisaster,
  deleteDisaster,
  getAllDisasters,
  getDisasterById,
  updateDisaster,
} from '../controller/disaster.controller';
const router = express();

router.route('/').get(getAllDisasters);

router.route('/:id').get(getDisasterById).put(updateDisaster).delete(deleteDisaster);

router.route('/create').post(createDisaster);
