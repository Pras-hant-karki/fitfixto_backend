export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  // Machine-readable discriminator so clients can react to specific failures
  // (e.g. SESSION_TAMPERED must force an immediate sign-out, not a token refresh).
  public readonly code?: string;

  constructor(message: string, statusCode: number, isOperational: boolean = true, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}
