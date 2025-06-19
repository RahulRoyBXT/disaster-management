import express from 'express';
import {
  createReport,
  deleteReport,
  getReport,
  updateReport,
} from '../controller/report.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = express.Router();

// create a report
router.route('/create').post(verifyJWT, createReport);
// get a report, update an existing report, or delete a report
router
  .route('/:id')
  .get(verifyJWT, getReport)
  .put(verifyJWT, updateReport)
  .delete(verifyJWT, deleteReport);

// Export the router
export default router;
