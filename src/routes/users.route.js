import express from 'express';

import {
  getUserProfile,
  loginUser,
  logOut,
  registerController,
} from '../controller/user.controller.js';

import multer from 'multer';
import { validateRequest } from '../middleware/validation.middleware.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';
import { loginUserSchema, registerUserSchema } from '../validation/user.validation.js';

const upload = multer();

const router = express.Router();

router.route('/profile').get(verifyJWT, getUserProfile);

router
  .route('/register')
  .post(upload.none(), validateRequest(registerUserSchema), registerController);

router.route('/login').post(upload.none(), validateRequest(loginUserSchema), loginUser);

router.route('/logout').post(verifyJWT, logOut);

export default router;
