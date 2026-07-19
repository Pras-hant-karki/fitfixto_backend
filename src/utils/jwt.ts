import jwt, { VerifyOptions, JwtPayload as JwtPayloadType } from 'jsonwebtoken';
import { Request } from 'express';
import env from '../config/env';
import { JwtPayload, UserRole } from '../types/index';
import { AppError } from './appError';

const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  try {
    const token = jwt.sign(payload, env.ACCESS_TOKEN_SECRET as string, {
      expiresIn: env.ACCESS_TOKEN_EXPIRY,
      algorithm: 'HS256',
    } as jwt.SignOptions);
    return token;
  } catch (error) {
    throw new AppError('Failed to generate access token', 500);
  }
};

const generateRefreshToken = (userId: string): string => {
  try {
    const payload: Omit<JwtPayload, 'email' | 'role'> & { userId: string } = {
      userId,
    };
    const token = jwt.sign(payload, env.REFRESH_TOKEN_SECRET as string, {
      expiresIn: env.REFRESH_TOKEN_EXPIRY,
      algorithm: 'HS256',
    } as jwt.SignOptions);
    return token;
  } catch (error) {
    throw new AppError('Failed to generate refresh token', 500);
  }
};

const generateTokenPair = (
  userId: string,
  email: string,
  role: UserRole
): { accessToken: string; refreshToken: string } => {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId,
    email,
    role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(userId);

  return { accessToken, refreshToken };
};

const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET as string, {
      algorithms: ['HS256'],
    } as VerifyOptions) as JwtPayloadType & JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Access token has expired', 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid access token', 401);
    }
    throw new AppError('Failed to verify access token', 500);
  }
};

const verifyRefreshToken = (token: string): { userId: string } => {
  try {
    const decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET as string, {
      algorithms: ['HS256'],
    } as VerifyOptions) as JwtPayloadType & { userId: string };

    return { userId: decoded.userId };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token has expired', 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid refresh token', 401);
    }
    throw new AppError('Failed to verify refresh token', 500);
  }
};

const decodeToken = (token: string): JwtPayloadType | null => {
  try {
    return jwt.decode(token) as JwtPayloadType | null;
  } catch (error) {
    return null;
  }
};

const extractTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

const extractBearerToken = (header: string): string | null => {
  const match = header.match(/^Bearer\s+(\S+)$/);
  return match ? match[1] : null;
};

export {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  extractTokenFromRequest,
  extractBearerToken,
};
