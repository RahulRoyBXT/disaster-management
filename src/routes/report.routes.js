import express from 'express';
import {
  createReport,
  deleteReport,
  getReport,
  updateReport,
} from '../controller/report.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyJWT);
// create a report
router.route('/').post(createReport);

// get a report, update an existing report, or delete a report
router.route('/:id').get(getReport).put(updateReport).delete(deleteReport);
