import jwt from 'jsonwebtoken';
import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const prisma = new PrismaClient();
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies.Token ||
      (req.header('Authorization') && req.header('Authorization').replace('Bearer ', ''));

    if (!token) {
      throw new ApiError(401, ' Token is missing or invalid');
    }
    const decodedToken = await jwt.verify(token, process.env.TOKEN_SECRET);

    console.log('decodedToken', decodedToken);

    const user = await prisma.user.findUnique({
      where: {
        username: decodedToken.username,
      },
    });
    const { password, ...userData } = user;
    console.log(userData);
    if (!userData) {
      throw new ApiError(401, 'Invalid Token');
    }
    req.user = userData;
    next();
  } catch (error) {
    next(error);
  }
});
