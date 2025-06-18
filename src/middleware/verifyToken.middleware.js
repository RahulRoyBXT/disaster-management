import { PrismaClient } from '../generated/prisma/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const prisma = new PrismaClient();
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies.accessToken ||
      (req.header('Authorization') && req.header('Authorization').replace('Bearer ', ''));

    if (!token) {
      throw new ApiError(401, 'Access token is missing or invalid');
    }
    const decodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await prisma.user.findFirst({
      where: {
        username: decodedToken.username,
      },
      select: {
        password: false,
      },
    });
    if (!user) {
      throw new ApiError(401, 'Invalid Access Token');
    }
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid Access Token');
  }
});
