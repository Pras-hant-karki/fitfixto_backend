import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { generateTokenPair } from '../utils/jwt';
import { registerSchema, loginSchema } from '../validations/auth.validation';
import User, { IUser } from '../models/User';

const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validationResult = registerSchema.safeParse(req.body);

  if (!validationResult.success) {
    const errors = validationResult.error.flatten().fieldErrors;
    throw new AppError(
      `Validation error: ${Object.values(errors)
        .flat()
        .join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const { firstName, lastName, email, phone, password, role } = validationResult.data;

  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  });

  if (existingUser) {
    throw new AppError(
      existingUser.email === email
        ? 'Email already registered'
        : 'Phone number already registered',
      HTTP_STATUS.CONFLICT
    );
  }

  const newUser = new User({
    firstName,
    lastName,
    email,
    phone,
    password,
    role,
  });

  await newUser.save();

  const { accessToken, refreshToken } = generateTokenPair(
    newUser._id.toString(),
    newUser.email,
    newUser.role
  );

  const userResponse = {
    id: newUser._id,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    email: newUser.email,
    phone: newUser.phone,
    role: newUser.role,
  };

  return sendSuccess(
    res,
    'User registered successfully',
    {
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken,
      },
    },
    HTTP_STATUS.CREATED
  ) as any;
});

const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validationResult = loginSchema.safeParse(req.body);

  if (!validationResult.success) {
    const errors = validationResult.error.flatten().fieldErrors;
    throw new AppError(
      `Validation error: ${Object.values(errors)
        .flat()
        .join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const { email, password } = validationResult.data;

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  const { accessToken, refreshToken } = generateTokenPair(
    user._id.toString(),
    user.email,
    user.role
  );

  const userResponse = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };

  return sendSuccess(
    res,
    'Login successful',
    {
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken,
      },
    },
    HTTP_STATUS.OK
  ) as any;
});

export { register, login };
