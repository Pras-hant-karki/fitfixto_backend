import crypto from 'crypto';

const generateEmailVerificationToken = (): { token: string; hash: string } => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
};

const getEmailVerificationExpiry = (expiryMinutes: number = 24 * 60): Date => {
  return new Date(Date.now() + expiryMinutes * 60 * 1000);
};

const isEmailVerificationTokenExpired = (expiryDate: Date | undefined): boolean => {
  if (!expiryDate) return true;
  return new Date() > expiryDate;
};

export {
  generateEmailVerificationToken,
  getEmailVerificationExpiry,
  isEmailVerificationTokenExpired,
};
