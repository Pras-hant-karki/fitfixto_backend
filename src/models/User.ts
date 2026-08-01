import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRole } from '../types/index';
import { LOGIN_ATTEMPT_POLICY } from '../constants/app.constants';

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  profilePicture?: string;
  bio?: string;
  address?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  isActive: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  /** Failed logins inside the current window. Set to 0 in Compass to clear a lockout. */
  loginAttempts: number;
  /** Start of the current attempt window; null once the window has lapsed. */
  loginAttemptWindowStart?: Date | null;
  /** Locked until this moment. Set to null in Compass to unlock immediately. */
  loginLockedUntil?: Date | null;
  /** Timestamp of the last successful sign-in, for auditing. */
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  hashPassword(): Promise<void>;
  generateEmailVerificationToken(): string;
  verifyEmailToken(token: string): boolean;
  generatePasswordResetToken(): string;
  verifyResetPasswordToken(token: string): boolean;
  isLoginLocked(): boolean;
  loginLockRetryAfterSeconds(): number;
  registerFailedLogin(): void;
  clearLoginAttempts(): void;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Please provide a valid phone number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio must be at most 500 characters'],
    },
    address: {
      type: String,
      maxlength: [255, 'Address must be at most 255 characters'],
      default: '',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    // Login throttle counters. Deliberately NOT `select: false` so they are visible and
    // editable in MongoDB Compass without extra steps.
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    loginAttemptWindowStart: {
      type: Date,
      default: null,
    },
    loginLockedUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.hashPassword = async function (): Promise<void> {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
};

userSchema.methods.generateEmailVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationToken = hash;
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

userSchema.methods.verifyEmailToken = function (token: string): boolean {
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  if (!this.emailVerificationToken || this.emailVerificationToken !== hash) {
    return false;
  }

  if (!this.emailVerificationExpires || new Date() > this.emailVerificationExpires) {
    return false;
  }

  this.isEmailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;

  return true;
};

userSchema.methods.generatePasswordResetToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordToken = hash;
  this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  return token;
};

userSchema.methods.verifyResetPasswordToken = function (token: string): boolean {
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  if (!this.resetPasswordToken || this.resetPasswordToken !== hash) {
    return false;
  }

  if (!this.resetPasswordExpires || new Date() > this.resetPasswordExpires) {
    return false;
  }

  return true;
};

userSchema.methods.isLoginLocked = function (): boolean {
  return Boolean(this.loginLockedUntil && this.loginLockedUntil.getTime() > Date.now());
};

userSchema.methods.loginLockRetryAfterSeconds = function (): number {
  if (!this.isLoginLocked()) return 0;
  return Math.max(1, Math.ceil((this.loginLockedUntil.getTime() - Date.now()) / 1000));
};

/**
 * Records one failed sign-in against a rolling window.
 *
 * The window restarts whenever the previous one has lapsed, so ten failures spread over an
 * hour never lock the account — only ten inside the configured window do. Callers must save
 * the document afterwards.
 */
userSchema.methods.registerFailedLogin = function (): void {
  const now = Date.now();
  const windowStart = this.loginAttemptWindowStart ? this.loginAttemptWindowStart.getTime() : 0;
  const windowHasLapsed = !windowStart || now - windowStart >= LOGIN_ATTEMPT_POLICY.WINDOW_MS;

  if (windowHasLapsed) {
    this.loginAttemptWindowStart = new Date(now);
    this.loginAttempts = 1;
  } else {
    this.loginAttempts += 1;
  }

  if (this.loginAttempts >= LOGIN_ATTEMPT_POLICY.MAX_ATTEMPTS) {
    this.loginLockedUntil = new Date(now + LOGIN_ATTEMPT_POLICY.LOCK_MS);
  }
};

/** Clears the throttle after a successful sign-in. Callers must save the document. */
userSchema.methods.clearLoginAttempts = function (): void {
  this.loginAttempts = 0;
  this.loginAttemptWindowStart = null;
  this.loginLockedUntil = null;
  this.lastLoginAt = new Date();
};

const User = model<IUser>('User', userSchema);

export default User;
