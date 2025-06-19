import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateToken } from '../utils/generateToken.js';
const prisma = new PrismaClient();

// validation required
export const registerController = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  console.log(req.body);
  console.log(process.env.DATABASE_URL);
  if ((!email && !username) || !password) {
    throw new ApiError(400, 'All fields are required');
  }
  const existedUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existedUser) {
    throw new ApiError(409, 'User with email or username is already exists');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const createdUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      username,
    },
  });

  if (!createdUser) {
    throw new ApiError(500, 'Something Went wrong while creating user');
  }

  return res.status(201).json(new ApiResponse(200, createdUser, 'Users created successfully'));
});

export const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(400, 'Username and password are required');
  }

  // Get user with password field included
  const user = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'User does not exist');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const Token = generateToken(username);

  // Remove password from user object
  const { password: _, ...loggedInUser } = user;

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('Token', Token, options)
    .json(new ApiResponse(200, { user: loggedInUser, Token }, 'User logged in successfully'));
});

export const logOut = asyncHandler(async (req, res) => {
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie('token', options)
    .json(new ApiResponse(200, {}, 'user Logged out successfully'));
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return res.status(200).json(new ApiResponse(200, user, 'User profile retrieved successfully'));
});
