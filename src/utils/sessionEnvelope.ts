import crypto from 'crypto';
import env from '../config/env';
import { UserRole } from '../types/index';
import { decodeToken } from './jwt';

/**
 * The session envelope is the server-signed snapshot of "who this session belongs to".
 *
 * The frontend mirrors it into a cookie so it can render role-specific UI on the very
 * first paint (no /auth/me round trip, no flash of the wrong navbar). Because the payload
 * is HMAC-signed with a server-only secret and bound to a specific access token, a user
 * editing the cookie by hand cannot produce a valid pair — the next authenticated request
 * fails the integrity check and the session is terminated.
 */
export interface SessionState {
  /** User id */
  uid: string;
  /** Authoritative role — the value the UI is allowed to trust */
  role: UserRole | string;
  email: string;
  /** Binds this envelope to one specific access token, preventing replay of an older envelope */
  tid: string;
  /** Absolute expiry (epoch ms), mirrored onto the cookie's max-age */
  exp: number;
}

export interface SessionEnvelope {
  state: string;
  signature: string;
  expiresAt: number;
  role: string;
}

interface SessionUserLike {
  _id: unknown;
  email: string;
  role: UserRole | string;
}

const DEFAULT_SESSION_TTL_MS = 20 * 24 * 60 * 60 * 1000;

const encodeState = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');

/** Binds an envelope to the exact access token it was issued alongside. */
export const fingerprintToken = (accessToken: string): string =>
  crypto.createHash('sha256').update(accessToken).digest('hex').slice(0, 32);

export const signSessionState = (state: string): string =>
  crypto.createHmac('sha256', env.ACCESS_TOKEN_SECRET).update(state).digest('hex');

const safeEquals = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) return false;

  return crypto.timingSafeEqual(bufferA, bufferB);
};

export const buildSessionEnvelope = (user: SessionUserLike, accessToken: string): SessionEnvelope => {
  const decoded = decodeToken(accessToken);
  const expiresAt =
    decoded && typeof decoded.exp === 'number'
      ? decoded.exp * 1000
      : Date.now() + DEFAULT_SESSION_TTL_MS;

  const state: SessionState = {
    uid: String(user._id),
    role: user.role,
    email: user.email,
    tid: fingerprintToken(accessToken),
    exp: expiresAt,
  };

  const encoded = encodeState(JSON.stringify(state));

  return {
    state: encoded,
    signature: signSessionState(encoded),
    expiresAt,
    role: String(user.role),
  };
};

/** Returns the decoded state only when the signature is authentic; null on any tampering. */
export const verifySessionState = (state: string, signature: string): SessionState | null => {
  if (!state || !signature) return null;
  if (!safeEquals(signSessionState(state), signature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as SessionState;

    if (!parsed || typeof parsed.uid !== 'string' || typeof parsed.role !== 'string') return null;
    if (typeof parsed.email !== 'string' || typeof parsed.tid !== 'string') return null;
    if (typeof parsed.exp !== 'number') return null;

    return parsed;
  } catch {
    return null;
  }
};
