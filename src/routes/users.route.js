import express from 'express';
import {
  getUserProfile,
  loginUser,
  logOut,
  registerController,
} from '../controller/user.controller.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';

const router = express.Router();

router.route('/register').post(registerController);

router.route('/login').post(loginUser);
router.route('/profile').post(verifyJWT, getUserProfile);

router.route('/logout').post(verifyJWT, logOut);

export default router;
