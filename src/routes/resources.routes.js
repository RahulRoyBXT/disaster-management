import express from 'express';
import {
  createResource,
  deleteResource,
  getAllResources,
  getNearbyResources,
  getResourceById,
  getResourcesByDisasterId,
  updateResource,
} from '../controller/resources.controller.js';
import { validateParams, validateRequest } from '../middleware/validation.middleware.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';
import {
  createResourceSchema,
  disasterIdParamSchema,
  nearbyResourcesQuerySchema,
  resourceIdParamSchema,
  updateResourceSchema,
} from '../validation/resource.validation.js';

const router = express.Router();
router.use(verifyJWT);
router.use(verifyJWT);

router.route('/create').post(validateRequest(createResourceSchema), createResource);
router.route('/update').put(validateRequest(updateResourceSchema), updateResource);
router.route('/delete/:id').delete(validateParams(resourceIdParamSchema), deleteResource);
router.route('/:id').get(validateParams(resourceIdParamSchema), getResourceById);
router.route('/').get(getAllResources);
router
  .route('/disaster/:disasterId')
  .get(validateParams(disasterIdParamSchema), getResourcesByDisasterId);

// Geospatial query route - Find nearby resources
router.route('/nearby').get(validateRequest(nearbyResourcesQuerySchema), getNearbyResources);

export default router;
