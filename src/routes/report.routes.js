import express from 'express';
import multer from 'multer';
import {
  createReport,
  deleteReport,
  getAllReports,
  getReport,
  updateReport,
} from '../controller/report.controller.js';
import { validateParams, validateRequest } from '../middleware/validation.middleware.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';
import {
  createReportSchema,
  reportIdParamSchema,
  updateReportSchema,
} from '../validation/report.validation.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Configure multer for file uploads

router.use(verifyJWT);

router.route('/create').post(upload.none(), validateRequest(createReportSchema), createReport);

// get a report, update an existing report, or delete a report
router.get('/', getAllReports);
router
  .route('/:id')
  .get(validateParams(reportIdParamSchema), getReport)
  .put(validateParams(reportIdParamSchema), validateRequest(updateReportSchema), updateReport)
  .delete(validateParams(reportIdParamSchema), deleteReport);

export default router;
