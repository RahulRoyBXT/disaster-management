import express from 'express';
import { loginUser, logOut, registerController } from '../controller/user.controller.js';

const router = express.Router();

router.route('/register').post(registerController);

router.route('/login').post(loginUser);

router.route('/logout').post(logOut);

export default router;
