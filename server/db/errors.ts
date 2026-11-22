import { EnvValidationError } from '../config/env.ts';

export type DatabaseErrorCode =
  | 'DB_NOT_CONFIGURED'
  | 'DB_CONNECTION_REFUSED'
  | 'DB_HOST_NOT_FOUND'
  | 'DB_AUTH_FAILED'
  | 'DB_NOT_FOUND'
  | 'DB_TLS_ERROR'
  | 'DB_TIMEOUT'
  | 'DB_UNIQUE_VIOLATION'
  | 'DB_FOREIGN_KEY_VIOLATION'
  | 'DB_CONSTRAINT_VIOLATION'
  | 'DB_QUERY_FAILED';

export class AppDatabaseError extends Error {
  public readonly code: DatabaseErrorCode;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: DatabaseErrorCode,
    statusCode = 500,
    isRetryable = false,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'AppDatabaseError';
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export function sanitizeErrorMessage(raw: string): string {
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[REDACTED_DSN]')
    .replace(/(password|secret|token|key)=([^\s&;'"]+)/gi, '$1=[REDACTED]');
}

interface PgLikeError {
  code?: string;
  errno?: string | number;
  message?: string;
}

export function translateDatabaseError(err: unknown, operation = 'database operation'): AppDatabaseError {
  if (err instanceof AppDatabaseError) {
    return err;
  }

  if (err instanceof EnvValidationError) {
    return new AppDatabaseError(
      'Database connection is not configured. Check SQL_* environment variables.',
      'DB_NOT_CONFIGURED',
      503,
      false,
      { cause: err }
    );
  }

  const pgErr = (err ?? {}) as PgLikeError;
  const code = String(pgErr.code || pgErr.errno || '');
  const message = sanitizeErrorMessage(String(pgErr.message || 'Unknown error'));

  // PostgreSQL authentication / database missing
  if (code === '28P01' || code === '28000') {
    return new AppDatabaseError(
      `Database authentication failed during ${operation}.`,
      'DB_AUTH_FAILED',
      503,
      false,
      { cause: err }
    );
  }

  if (code === '3D000') {
    return new AppDatabaseError(
      `Target PostgreSQL database does not exist during ${operation}.`,
      'DB_NOT_FOUND',
      503,
      false,
      { cause: err }
    );
  }

  // PostgreSQL constraint violations
  if (code === '23505') {
    return new AppDatabaseError(
      `A duplicate record prevented ${operation}.`,
      'DB_UNIQUE_VIOLATION',
      409,
      false,
      { cause: err }
    );
  }

  if (code === '23503') {
    return new AppDatabaseError(
      `Referenced record was not found or cannot be deleted during ${operation}.`,
      'DB_FOREIGN_KEY_VIOLATION',
      400,
      false,
      { cause: err }
    );
  }

  if (code === '23502' || code === '23514' || code === '22P02') {
    return new AppDatabaseError(
      `Invalid or missing column data during ${operation}.`,
      'DB_CONSTRAINT_VIOLATION',
      400,
      false,
      { cause: err }
    );
  }

  // Network / Socket / Timeout errors
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return new AppDatabaseError(
      `Unable to reach PostgreSQL server during ${operation}.`,
      'DB_CONNECTION_REFUSED',
      503,
      true,
      { cause: err }
    );
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new AppDatabaseError(
      `PostgreSQL host could not be resolved during ${operation}.`,
      'DB_HOST_NOT_FOUND',
      503,
      true,
      { cause: err }
    );
  }

  if (code === 'ETIMEDOUT' || message.toLowerCase().includes('timeout')) {
    return new AppDatabaseError(
      `PostgreSQL connection timed out during ${operation}.`,
      'DB_TIMEOUT',
      504,
      true,
      { cause: err }
    );
  }

  if (
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    message.toLowerCase().includes('ssl') ||
    message.toLowerCase().includes('tls')
  ) {
    return new AppDatabaseError(
      `PostgreSQL TLS/SSL handshake failed during ${operation}.`,
      'DB_TLS_ERROR',
      503,
      false,
      { cause: err }
    );
  }

  return new AppDatabaseError(
    `Database query failed during ${operation}.`,
    'DB_QUERY_FAILED',
    500,
    false,
    { cause: err }
  );
}
