import { Request, Response, NextFunction, RequestHandler } from 'express';
import { extractTokenFromRequest, verifyAccessToken } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { AppError } from '../utils/appError';
import { HTTP_STATUS } from '../constants/app.constants';
import { UserRole } from '../types/index';

export interface RequestWithUser extends Request {
  user?: IUser;
}

export const authenticate: RequestHandler = async (req: RequestWithUser, _res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      throw new AppError('Authentication token missing', HTTP_STATUS.UNAUTHORIZED);
    }

    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.userId).select('-password');

    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.UNAUTHORIZED);
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const optionalAuthenticate: RequestHandler = async (req: RequestWithUser, _res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return next();
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select('-password');

    if (user) {
      req.user = user;
    }

    return next();
  } catch {
    return next();
  }
};

export const authorize = (...roles: UserRole[]): RequestHandler => {
  return (req: RequestWithUser, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED));
    }

    if (roles.length > 0 && !roles.includes(user.role)) {
      return next(new AppError('Forbidden', HTTP_STATUS.FORBIDDEN));
    }

    return next();
  };
};
