import { RequestHandler } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { UserRole } from '../types/index';
import { RequestWithUser } from './auth';

export const authorizeRoles = (...roles: UserRole[]): RequestHandler => {
  return (req: RequestWithUser, _res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED));
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: insufficient role', HTTP_STATUS.FORBIDDEN));
    }

    return next();
  };
};
