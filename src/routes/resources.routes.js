import express from 'express';
import {
  createResource,
  deleteResource,
  getResourceById,
  updateResource,
} from '../controller/resources.controller.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';
const router = express.Router();


router.route('/create').post(createResource);
router.route('/update').post(updateResource);
router.route('/delete/:id').post(deleteResource);
router.route('/:id').post(getResourceById);

export default router;
