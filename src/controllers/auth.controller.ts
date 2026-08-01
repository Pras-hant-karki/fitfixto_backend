import { Request, Response } from 'express';
import crypto from 'crypto';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { extractTokenFromRequest, generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { buildSessionEnvelope } from '../utils/sessionEnvelope';
import { formatZodError } from '../utils/validationError';
import env from '../config/env';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  strongPasswordSchema,
} from '../validations/auth.validation';
import User, { IUser } from '../models/User';
import { RequestWithUser } from '../middlewares/auth';
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from '../services/emailService';

/**
 * Raised when an account has exhausted its login attempts. Carries LOGIN_LOCKED so the
 * frontend can show a countdown rather than a generic credential error.
 */
const lockedOutError = (retryAfterSeconds: number) =>
  new AppError(
    `Too many failed sign-in attempts for this account. Please try again in ${retryAfterSeconds} second${
      retryAfterSeconds === 1 ? '' : 's'
    }.`,
    HTTP_STATUS.TOO_MANY_REQUESTS,
    true,
    'LOGIN_LOCKED'
  );

const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validationResult = registerSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new AppError(
      `Validation error: ${formatZodError(validationResult.error)}`,
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

  const verificationToken = newUser.generateEmailVerificationToken();
  await newUser.save();

  let verificationEmailSent = true;
  try {
    await sendEmailVerificationEmail(newUser.email, verificationToken, env.FRONTEND_URL);
  } catch (error) {
    verificationEmailSent = false;
    console.error('Failed to send verification email', error);
  }

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
    isEmailVerified: newUser.isEmailVerified,
  };

  return sendSuccess(
    res,
    'User registered successfully',
    {
      user: userResponse,
      verificationEmailSent,
      tokens: {
        accessToken,
        refreshToken,
      },
      session: buildSessionEnvelope(newUser, accessToken),
    },
    HTTP_STATUS.CREATED
  ) as any;
});

const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validationResult = loginSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new AppError(
      `Validation error: ${formatZodError(validationResult.error)}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const { email, password } = validationResult.data;

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  if (user.isLoginLocked()) {
    throw lockedOutError(user.loginLockRetryAfterSeconds());
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    user.registerFailedLogin();
    await user.save();

    if (user.isLoginLocked()) {
      throw lockedOutError(user.loginLockRetryAfterSeconds());
    }

    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  if (user.role === 'admin') {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been suspended. Please contact support.', HTTP_STATUS.FORBIDDEN);
  }

  user.clearLoginAttempts();
  await user.save();

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

  const passwordIsWeak = !strongPasswordSchema.safeParse(password).success;

  return sendSuccess(
    res,
    'Login successful',
    {
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken,
      },
      session: buildSessionEnvelope(user, accessToken),
      passwordIsWeak,
    },
    HTTP_STATUS.OK
  ) as any;
});

const adminLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validationResult = loginSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new AppError(
      `Validation error: ${formatZodError(validationResult.error)}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const { email, password } = validationResult.data;
  const user = await User.findOne({ email }).select('+password');

  if (!user || user.role !== 'admin') {
    throw new AppError('Invalid admin credentials', HTTP_STATUS.UNAUTHORIZED);
  }

  if (user.isLoginLocked()) {
    throw lockedOutError(user.loginLockRetryAfterSeconds());
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    user.registerFailedLogin();
    await user.save();

    if (user.isLoginLocked()) {
      throw lockedOutError(user.loginLockRetryAfterSeconds());
    }

    throw new AppError('Invalid admin credentials', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!user.isActive) {
    throw new AppError('This account has been suspended.', HTTP_STATUS.FORBIDDEN);
  }

  user.clearLoginAttempts();
  await user.save();

  const { accessToken, refreshToken } = generateTokenPair(
    user._id.toString(),
    user.email,
    user.role
  );

  return sendSuccess(
    res,
    'Admin login successful',
    {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
      session: buildSessionEnvelope(user, accessToken),
    },
    HTTP_STATUS.OK
  ) as any;
});

const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new AppError('Refresh token is required', HTTP_STATUS.BAD_REQUEST);
  }

  // Throws 401 AppError if expired or invalid
  const { userId } = verifyRefreshToken(token);

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been suspended.', HTTP_STATUS.FORBIDDEN);
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(
    user._id.toString(),
    user.email,
    user.role
  );

  return sendSuccess(
    res,
    'Token refreshed successfully',
    {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
        bio: user.bio,
        address: user.address,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      },
      session: buildSessionEnvelope(user, accessToken),
    },
    HTTP_STATUS.OK
  ) as any;
});

const getCurrentUser = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  return sendSuccess(
    res,
    'Current user fetched successfully',
    {
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        profilePicture: req.user.profilePicture,
        bio: req.user.bio,
        address: req.user.address,
        isEmailVerified: req.user.isEmailVerified,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt,
      },
    },
    HTTP_STATUS.OK
  ) as any;
});

/**
 * Authoritative session check.
 *
 * `authenticate` has already verified the access token signature, confirmed the account is
 * active, confirmed the token's role still matches the database, and validated the client's
 * mirrored session cookie. Reaching this handler therefore means the session is genuine, so
 * the role returned here is the value the frontend is allowed to route and render on.
 */
const getSession = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const token = extractTokenFromRequest(req);

  if (!token) {
    throw new AppError('Authentication token missing', HTTP_STATUS.UNAUTHORIZED);
  }

  return sendSuccess(
    res,
    'Session is valid',
    {
      role: req.user.role,
      session: buildSessionEnvelope(req.user, token),
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        profilePicture: req.user.profilePicture,
        bio: req.user.bio,
        address: req.user.address,
        isEmailVerified: req.user.isEmailVerified,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt,
      },
    },
    HTTP_STATUS.OK
  ) as any;
});

const logout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return sendSuccess(res, 'Logout successful', { loggedOut: true }, HTTP_STATUS.OK) as any;
});

const verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validationResult = verifyEmailSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new AppError(
      `Validation error: ${formatZodError(validationResult.error)}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const { token, email } = validationResult.data;

  const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires');

  // Generic error — do not reveal whether the email exists
  if (!user) {
    throw new AppError(
      'Invalid or expired verification token',
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const isVerified = user.verifyEmailToken(token);

  if (!isVerified) {
    throw new AppError(
      'Invalid or expired verification token',
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  await user.save();

  return sendSuccess(
    res,
    'Email verified successfully',
    { email: user.email },
    HTTP_STATUS.OK
  ) as any;
});

const forgotPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const validationResult = forgotPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new AppError(
        `Validation error: ${formatZodError(validationResult.error)}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { email } = validationResult.data;

    const user = await User.findOne({ email });

    // Always return the same generic response to prevent user enumeration
    if (!user || user.role === 'admin') {
      return sendSuccess(
        res,
        'If an account with that email exists, a password reset link has been sent.',
        {},
        HTTP_STATUS.OK
      ) as any;
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, resetToken, env.FRONTEND_URL);
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      throw new AppError(
        'Error sending password reset email',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    return sendSuccess(
      res,
      'If an account with that email exists, a password reset link has been sent.',
      {},
      HTTP_STATUS.OK
    ) as any;
  }
);

const resetPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const validationResult = resetPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new AppError(
        `Validation error: ${formatZodError(validationResult.error)}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { token, password } = validationResult.data;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      throw new AppError(
        'Invalid reset token',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const isValid = user.verifyResetPasswordToken(token);

    if (!isValid) {
      throw new AppError(
        'Invalid or expired reset token',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return sendSuccess(
      res,
      'Password reset successfully',
      { email: user.email },
      HTTP_STATUS.OK
    ) as any;
  }
);

const changePassword = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const validationResult = changePasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new AppError(
        `Validation error: ${formatZodError(validationResult.error)}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      throw new AppError(
        'Current password is incorrect',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    user.password = newPassword;
    await user.save();

    return sendSuccess(
      res,
      'Password changed successfully',
      { email: user.email },
      HTTP_STATUS.OK
    ) as any;
  }
);

const updateProfile = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const validationResult = updateProfileSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new AppError(
        `Validation error: ${formatZodError(validationResult.error)}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { firstName, lastName, phone, bio, address, profilePicture } = validationResult.data;

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Check if phone is being updated and if it's unique
    if (phone && phone !== user.phone) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        throw new AppError(
          'Phone number already registered',
          HTTP_STATUS.CONFLICT
        );
      }
    }

    // Update fields if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (address !== undefined) user.address = address;
    if (profilePicture) user.profilePicture = profilePicture;

    await user.save();

    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profilePicture: user.profilePicture,
      bio: user.bio,
      address: user.address,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return sendSuccess(
      res,
      'Profile updated successfully',
      { user: userResponse },
      HTTP_STATUS.OK
    ) as any;
  }
);

const uploadProfileImage = asyncHandler(
  async (req: any, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    if (!req.file) {
      throw new AppError(
        'No image file provided',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const relativePath = `users/${req.file.filename}`;
    user.profilePicture = relativePath;
    await user.save();

    return sendSuccess(
      res,
      'Profile image uploaded successfully',
      {
        profilePicture: user.profilePicture,
        message: 'Image uploaded and profile updated',
      },
      HTTP_STATUS.OK
    ) as any;
  }
);

export { register, login, adminLogin, refreshToken, logout, getCurrentUser, getSession, verifyEmail, forgotPassword, resetPassword, changePassword, updateProfile, uploadProfileImage };
