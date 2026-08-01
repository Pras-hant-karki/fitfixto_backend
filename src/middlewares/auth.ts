import { Request, Response, NextFunction, RequestHandler } from 'express';
import { extractTokenFromRequest, verifyAccessToken } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { AppError } from '../utils/appError';
import { HTTP_STATUS } from '../constants/app.constants';
import { UserRole } from '../types/index';
import { fingerprintToken, verifySessionState } from '../utils/sessionEnvelope';

export interface RequestWithUser extends Request {
  user?: IUser;
}

export const SESSION_STATE_HEADER = 'x-session-state';
export const SESSION_SIGNATURE_HEADER = 'x-session-sig';

const tamperError = () =>
  new AppError(
    'Session integrity check failed. Please sign in again.',
    HTTP_STATUS.UNAUTHORIZED,
    true,
    'SESSION_TAMPERED'
  );

const readHeader = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/**
 * Validates the client's mirrored session cookie against server-side truth.
 *
 * The client sends its cookie snapshot on every authenticated request. If the snapshot
 * is absent entirely we skip the check (non-browser API consumers still work on the
 * bearer token alone), but the moment a partial or altered snapshot shows up we reject
 * with SESSION_TAMPERED so the frontend can sign the user out immediately.
 */
const enforceSessionIntegrity = (req: Request, token: string, user: IUser): void => {
  const state = readHeader(req, SESSION_STATE_HEADER);
  const signature = readHeader(req, SESSION_SIGNATURE_HEADER);

  if (!state && !signature) return;
  if (!state || !signature) throw tamperError();

  const verified = verifySessionState(state, signature);

  if (!verified) throw tamperError();
  if (verified.uid !== user._id.toString()) throw tamperError();
  if (verified.role !== user.role) throw tamperError();
  if (verified.email !== user.email) throw tamperError();
  if (verified.tid !== fingerprintToken(token)) throw tamperError();

  if (verified.exp <= Date.now()) {
    throw new AppError('Session has expired. Please sign in again.', HTTP_STATUS.UNAUTHORIZED, true, 'SESSION_EXPIRED');
  }
};

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

    if (!user.isActive) {
      throw new AppError('Your account has been suspended. Please contact support.', HTTP_STATUS.FORBIDDEN);
    }

    // The role baked into the token must still match the database. If an admin was
    // demoted mid-session their old token must not keep admin privileges.
    if (payload.role !== user.role) {
      throw new AppError(
        'Your account permissions have changed. Please sign in again.',
        HTTP_STATUS.UNAUTHORIZED,
        true,
        'ROLE_CHANGED'
      );
    }

    enforceSessionIntegrity(req, token, user);

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
