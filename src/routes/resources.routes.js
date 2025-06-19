import express from 'express';
import {
  createResource,
  deleteResource,
  getResourceById,
  updateResource,
} from '../controller/resources.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
const router = express.Router();

router.route('/create').post(verifyJWT, createResource);
router.route('/update').post(verifyJWT, updateResource);
router.route('/delete/:id').post(verifyJWT, deleteResource);
router.route('/:id').post(verifyJWT, getResourceById);

export default router;
