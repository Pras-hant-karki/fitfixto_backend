import User from '../models/User';
import { LOGIN_ATTEMPT_POLICY } from '../constants/app.constants';

/**
 * Exercises the per-account throttle directly on an unsaved document, so these run without
 * a database connection.
 */
const makeUser = () =>
  new User({
    firstName: 'Throttle',
    lastName: 'Tester',
    email: 'throttle@fitfixto.com',
    phone: '5551234567',
    password: 'Str0ng!Passw0rd',
  });

describe('per-account login throttle', () => {
  it('starts unlocked with a zeroed counter', () => {
    const user = makeUser();

    expect(user.loginAttempts).toBe(0);
    expect(user.isLoginLocked()).toBe(false);
    expect(user.loginLockedUntil ?? null).toBeNull();
  });

  it(`allows ${LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS - 1} failures then locks on the limit`, () => {
    const user = makeUser();

    for (let attempt = 1; attempt < LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS; attempt += 1) {
      user.registerFailedLogin();
      expect(user.loginAttempts).toBe(attempt);
      expect(user.isLoginLocked()).toBe(false);
    }

    user.registerFailedLogin();

    expect(user.loginAttempts).toBe(LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS);
    expect(user.isLoginLocked()).toBe(true);
    expect(user.loginLockRetryAfterSeconds()).toBeGreaterThan(0);
    expect(user.loginLockRetryAfterSeconds()).toBeLessThanOrEqual(LOGIN_ATTEMPT_POLICY.LOCK_MS / 1000);
  });

  it('restarts the window once it has lapsed, so slow failures never lock the account', () => {
    const user = makeUser();

    for (let attempt = 0; attempt < LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS - 1; attempt += 1) {
      user.registerFailedLogin();
    }
    expect(user.loginAttempts).toBe(LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS - 1);

    // Push the window start into the past so the next failure opens a fresh window.
    user.loginAttemptWindowStart = new Date(Date.now() - LOGIN_ATTEMPT_POLICY.WINDOW_MS - 1);
    user.registerFailedLogin();

    expect(user.loginAttempts).toBe(1);
    expect(user.isLoginLocked()).toBe(false);
  });

  it('clears the lock on a successful sign-in and records the timestamp', () => {
    const user = makeUser();

    for (let attempt = 0; attempt < LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS; attempt += 1) {
      user.registerFailedLogin();
    }
    expect(user.isLoginLocked()).toBe(true);

    user.clearLoginAttempts();

    expect(user.loginAttempts).toBe(0);
    expect(user.loginAttemptWindowStart).toBeNull();
    expect(user.loginLockedUntil).toBeNull();
    expect(user.isLoginLocked()).toBe(false);
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });

  it('unlocks by itself once the lock expires', () => {
    const user = makeUser();

    for (let attempt = 0; attempt < LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS; attempt += 1) {
      user.registerFailedLogin();
    }
    expect(user.isLoginLocked()).toBe(true);

    user.loginLockedUntil = new Date(Date.now() - 1);

    expect(user.isLoginLocked()).toBe(false);
    expect(user.loginLockRetryAfterSeconds()).toBe(0);
  });

  it('is unlocked by clearing the counters the way an operator would in Compass', () => {
    const user = makeUser();

    for (let attempt = 0; attempt < LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS; attempt += 1) {
      user.registerFailedLogin();
    }
    expect(user.isLoginLocked()).toBe(true);

    // Equivalent to editing the document: loginAttempts -> 0, loginLockedUntil -> null.
    user.loginAttempts = 0;
    user.loginLockedUntil = null;
    user.loginAttemptWindowStart = null;

    expect(user.isLoginLocked()).toBe(false);
  });
});
