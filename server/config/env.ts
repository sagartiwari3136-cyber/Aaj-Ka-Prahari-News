import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const sslModeSchema = z
  .enum(['false', 'true', 'require'])
  .default('false')
  .transform((val) => {
    if (val === 'true') return true;
    if (val === 'require') return { rejectUnauthorized: false };
    return false;
  });

const baseAppEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  STORAGE_DRIVER: z.enum(['json', 'postgres']).default('json'),
  DATA_DIR: z.string().trim().optional(),
  TRUST_PROXY: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().optional(),
});

const dbRuntimeEnvSchema = z.object({
  SQL_HOST: z.string().trim().min(1, 'SQL_HOST is required'),
  SQL_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  SQL_DB_NAME: z.string().trim().min(1, 'SQL_DB_NAME is required'),
  SQL_USER: z.string().trim().min(1, 'SQL_USER is required'),
  SQL_PASSWORD: z.string().min(1, 'SQL_PASSWORD is required'),
  SQL_SSL: sslModeSchema,
  SQL_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  SQL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  SQL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
});

const dbAdminEnvSchema = z.object({
  SQL_HOST: z.string().trim().min(1, 'SQL_HOST is required'),
  SQL_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  SQL_DB_NAME: z.string().trim().min(1, 'SQL_DB_NAME is required'),
  SQL_ADMIN_USER: z.string().trim().min(1, 'SQL_ADMIN_USER is required'),
  SQL_ADMIN_PASSWORD: z.string().min(1, 'SQL_ADMIN_PASSWORD is required'),
  SQL_SSL: sslModeSchema,
});

export type AppEnv = z.infer<typeof baseAppEnvSchema>;
export type TrustProxySetting = boolean | number | string | string[];

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export class EnvValidationError extends Error {
  public readonly missingOrInvalidKeys: string[];

  constructor(message: string, keys: string[]) {
    super(message);
    this.name = 'EnvValidationError';
    this.missingOrInvalidKeys = keys;
  }
}

export function getAppEnv(): AppEnv {
  const parsed = baseAppEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join('.'));
    throw new EnvValidationError(
      `Invalid application environment configuration for: ${keys.join(', ')}`,
      keys
    );
  }
  return parsed.data;
}

export function getDataDir(rawDataDir = process.env.DATA_DIR): string {
  if (rawDataDir && rawDataDir.trim() !== '') {
    return path.resolve(process.cwd(), rawDataDir.trim());
  }
  return path.join(process.cwd(), 'data');
}

/**
 * Fail-closed storage driver guard.
 * Allows explicit 'json' (or unset -> explicit 'json' default).
 * Refuses unknown values and refuses 'postgres' until PostgreSQL persistence adapter is activated.
 */
export function validateStorageDriverConfig(rawDriver = process.env.STORAGE_DRIVER): 'json' {
  if (rawDriver === undefined) {
    return 'json';
  }

  const normalized = rawDriver.trim().toLowerCase();
  if (normalized === 'json') {
    return 'json';
  }

  if (normalized === 'postgres') {
    throw new EnvValidationError(
      'STORAGE_DRIVER="postgres" is selected, but the PostgreSQL runtime persistence adapter is not activated yet. Refusing to fall back silently to JSON storage.',
      ['STORAGE_DRIVER']
    );
  }

  throw new EnvValidationError(
    `Invalid STORAGE_DRIVER="${rawDriver}". Supported value in this phase is "json" (PostgreSQL adapter not yet active).`,
    ['STORAGE_DRIVER']
  );
}

const TRUST_PROXY_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

/**
 * Parses TRUST_PROXY safely for Express.
 * - Unset / 'false': false (direct socket IP; never trusts X-Forwarded-For)
 * - Non-negative integer string (e.g. '1'): exact reverse-proxy hop count
 * - Subnet/preset list (e.g. 'loopback' or 'loopback, 10.0.0.0/8'): trusted proxy addresses
 * - 'true': explicitly REJECTED to prevent X-Forwarded-For spoofing
 */
export function parseTrustProxyConfig(rawValue = process.env.TRUST_PROXY): TrustProxySetting {
  if (rawValue === undefined || rawValue.trim() === '') {
    return false;
  }

  const trimmed = rawValue.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'false' || lower === '0') {
    return false;
  }

  if (lower === 'true') {
    throw new EnvValidationError(
      'TRUST_PROXY="true" is disallowed because it trusts arbitrary X-Forwarded-For headers. Use an explicit hop count (e.g., "1") or named/CIDR subnets (e.g., "loopback").',
      ['TRUST_PROXY']
    );
  }

  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
      throw new EnvValidationError(
        `Invalid TRUST_PROXY hop count "${trimmed}". Expected an integer between 1 and 10.`,
        ['TRUST_PROXY']
      );
    }
    return hops;
  }

  const entries = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new EnvValidationError('TRUST_PROXY cannot be empty when specified.', ['TRUST_PROXY']);
  }

  for (const entry of entries) {
    const isPreset = TRUST_PROXY_PRESETS.has(entry.toLowerCase());
    const isIpv4OrCidr = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(entry);
    const isIpv6OrCidr = /^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(entry) && entry.includes(':');
    if (!isPreset && !isIpv4OrCidr && !isIpv6OrCidr) {
      throw new EnvValidationError(
        `Invalid TRUST_PROXY entry "${entry}". Expected "false", a hop count ("1"), preset ("loopback"), or IP/CIDR.`,
        ['TRUST_PROXY']
      );
    }
  }

  return entries.length === 1 ? entries[0] : entries;
}

/**
 * Parses CORS_ALLOWED_ORIGINS (comma-separated http/https origins) into a normalized allowlist.
 * Wildcard '*' is strictly disallowed. Same-origin requests work automatically without
 * needing entries here.
 */
export function getAllowedCorsOrigins(
  rawOrigins = process.env.CORS_ALLOWED_ORIGINS
): Set<string> {
  const allowed = new Set<string>();

  if (rawOrigins && rawOrigins.trim() !== '') {
    for (const entry of rawOrigins.split(',')) {
      const candidate = entry.trim();
      if (!candidate) continue;
      if (candidate === '*') {
        throw new EnvValidationError(
          'Wildcard "*" is disallowed in CORS_ALLOWED_ORIGINS. Specify explicit origins.',
          ['CORS_ALLOWED_ORIGINS']
        );
      }
      let parsed: URL;
      try {
        parsed = new URL(candidate);
      } catch {
        throw new EnvValidationError(
          `Invalid origin "${candidate}" in CORS_ALLOWED_ORIGINS.`,
          ['CORS_ALLOWED_ORIGINS']
        );
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new EnvValidationError(
          `CORS origin "${candidate}" must use http:// or https://.`,
          ['CORS_ALLOWED_ORIGINS']
        );
      }
      allowed.add(parsed.origin);
    }
  }

  return allowed;
}

export function isDatabaseConfigured(mode: 'app' | 'admin' = 'app'): boolean {
  if (mode === 'admin') {
    return dbAdminEnvSchema.safeParse(process.env).success;
  }
  return dbRuntimeEnvSchema.safeParse(process.env).success;
}

export function getDatabaseConfig(mode: 'app' | 'admin' = 'app'): DatabaseConnectionConfig {
  if (mode === 'admin') {
    const parsed = dbAdminEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const keys = Array.from(new Set(parsed.error.issues.map((i) => String(i.path[0] || 'unknown'))));
      throw new EnvValidationError(
        `Admin database environment variables are missing or invalid: ${keys.join(', ')}`,
        keys
      );
    }

    return {
      host: parsed.data.SQL_HOST,
      port: parsed.data.SQL_PORT,
      database: parsed.data.SQL_DB_NAME,
      user: parsed.data.SQL_ADMIN_USER,
      password: parsed.data.SQL_ADMIN_PASSWORD,
      ssl: parsed.data.SQL_SSL,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    };
  }

  const parsed = dbRuntimeEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = Array.from(new Set(parsed.error.issues.map((i) => String(i.path[0] || 'unknown'))));
    throw new EnvValidationError(
      `Runtime database environment variables are missing or invalid: ${keys.join(', ')}`,
      keys
    );
  }

  return {
    host: parsed.data.SQL_HOST,
    port: parsed.data.SQL_PORT,
    database: parsed.data.SQL_DB_NAME,
    user: parsed.data.SQL_USER,
    password: parsed.data.SQL_PASSWORD,
    ssl: parsed.data.SQL_SSL,
    max: parsed.data.SQL_POOL_MAX,
    idleTimeoutMillis: parsed.data.SQL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: parsed.data.SQL_CONNECTION_TIMEOUT_MS,
  };
}
