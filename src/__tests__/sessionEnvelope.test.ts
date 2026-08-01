import { generateTokenPair } from '../utils/jwt';
import { buildSessionEnvelope, fingerprintToken, verifySessionState } from '../utils/sessionEnvelope';
import { UserRole } from '../types/index';

const customer = {
  _id: '507f1f77bcf86cd799439011',
  email: 'customer@fitfixto.com',
  role: UserRole.CUSTOMER,
};

const issueFor = (user: typeof customer) => {
  const { accessToken } = generateTokenPair(String(user._id), user.email, user.role);
  return { accessToken, envelope: buildSessionEnvelope(user, accessToken) };
};

/** Re-encodes a state payload after mutating it, simulating a hand-edited cookie. */
const reencodeWith = (state: string, changes: Record<string, unknown>): string => {
  const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  return Buffer.from(JSON.stringify({ ...decoded, ...changes }), 'utf8').toString('base64url');
};

describe('session envelope', () => {
  it('verifies an untouched envelope and exposes the signed role', () => {
    const { accessToken, envelope } = issueFor(customer);

    const verified = verifySessionState(envelope.state, envelope.signature);

    expect(verified).not.toBeNull();
    expect(verified?.uid).toBe(String(customer._id));
    expect(verified?.role).toBe(UserRole.CUSTOMER);
    expect(verified?.email).toBe(customer.email);
    expect(verified?.tid).toBe(fingerprintToken(accessToken));
    expect(verified?.exp).toBeGreaterThan(Date.now());
  });

  it('rejects a privilege escalation attempt in the cookie payload', () => {
    const { envelope } = issueFor(customer);

    const escalated = reencodeWith(envelope.state, { role: UserRole.ADMIN });

    // The old signature no longer matches the edited payload.
    expect(verifySessionState(escalated, envelope.signature)).toBeNull();
  });

  it('rejects any other edited field', () => {
    const { envelope } = issueFor(customer);

    expect(verifySessionState(reencodeWith(envelope.state, { uid: 'someone-else' }), envelope.signature)).toBeNull();
    expect(verifySessionState(reencodeWith(envelope.state, { email: 'attacker@evil.com' }), envelope.signature)).toBeNull();
    expect(
      verifySessionState(reencodeWith(envelope.state, { exp: Date.now() + 10 * 365 * 24 * 3600 * 1000 }), envelope.signature)
    ).toBeNull();
  });

  it('rejects a forged or swapped signature', () => {
    const { envelope } = issueFor(customer);

    expect(verifySessionState(envelope.state, 'deadbeef')).toBeNull();
    expect(verifySessionState(envelope.state, '')).toBeNull();
    expect(verifySessionState(envelope.state, envelope.signature.slice(0, -1) + '0')).toBeNull();
  });

  it('binds an envelope to the token it was issued with, blocking cross-account replay', () => {
    const victim = issueFor(customer);
    const attacker = issueFor({
      _id: '507f1f77bcf86cd799439022',
      email: 'attacker@evil.com',
      role: UserRole.CUSTOMER,
    });

    const verified = verifySessionState(victim.envelope.state, victim.envelope.signature);

    // Pairing the victim's (genuinely signed) envelope with a different account's token fails
    // the middleware fingerprint comparison, so a stolen envelope cannot be reused.
    expect(verified?.tid).toBe(fingerprintToken(victim.accessToken));
    expect(verified?.tid).not.toBe(fingerprintToken(attacker.accessToken));
  });

  it('issues an envelope whose role tracks the account it was built for', () => {
    const admin = { _id: '507f1f77bcf86cd799439099', email: 'admin@fitfixto.com', role: UserRole.ADMIN };

    const { envelope } = issueFor(admin);

    expect(envelope.role).toBe(UserRole.ADMIN);
    expect(verifySessionState(envelope.state, envelope.signature)?.role).toBe(UserRole.ADMIN);
  });
});
