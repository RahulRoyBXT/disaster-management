import express from 'express';
import multer from 'multer';
import { loginUser, logOut, registerController } from '../controller/user.controller.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';

const upload = multer();

const router = express.Router();

router.route('/register').post(upload.none(), registerController);

router.route('/login').post(upload.none(), loginUser);

router.route('/logout').post(verifyJWT, logOut);

export default router;
