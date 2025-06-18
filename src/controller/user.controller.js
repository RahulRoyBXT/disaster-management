import { asyncHandler } from '../utils/asyncHandler';

export const registerController = asyncHandler(async (req, res) => {
  const { email, fullName, username, password } = req.body;

  // Taking response from ZOD
  const paths = Object.values(req.files)
    .flat()
    .map(file => file.path);
  const avatarLocalPath = paths?.[0];
  const coveImageLocalPath = paths?.[1];

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    DeleteLocalFile(avatarLocalPath, coveImageLocalPath);
    throw new ApiError(409, 'User with email or username is already exists');
  }

  const avatar = await cloudinaryUploader(avatarLocalPath);
  console.log(avatar);
  const coverImage = await cloudinaryUploader(coveImageLocalPath);

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
    email,
    password,
    username,
  });

  const createdUser = await User.findById(user._id).select('-password -refreshToken');

  if (!createdUser) {
    throw new ApiError(500, 'Something Went wrong while creating user');
  }

  return res.status(201).json(new ApiResponse(200, createdUser, 'Users created successfully'));
});



export const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // DB query works on either email or username
  const queryConditionArr = [];

  if (email && email.trim() !== '') {
    queryConditionArr.push({ email });
  }
  if (username && username.trim() !== '') {
    queryConditionArr.push({ username });
  }

  if (queryConditionArr.length === 0) {
    throw new ApiError(400, 'username or email is required');
  }
  const user = await User.findOne({
    $or: queryConditionArr,
  });

  if (!user) {
    throw new ApiError(404, 'User Does not exits');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid Credentials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        'User Logged In successfully'
      )
    );
});



export const logOut = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'user Logged out successfully'));
});
