import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getDatabaseConfig } from '../../server/config/env.ts';
import { translateDatabaseError } from '../../server/db/errors.ts';
import * as schema from './schema.ts';

export type AppDatabase = NodePgDatabase<typeof schema>;

declare global {
  var _akpPostgresPool: Pool | undefined;
  var _akpDrizzleDb: AppDatabase | undefined;
}

/**
 * Lazily initializes and returns the singleton PostgreSQL connection pool
 * using the Object Method (never connection-string URIs).
 */
export function getPool(): Pool {
  if (!globalThis._akpPostgresPool) {
    const config = getDatabaseConfig('app');
    const pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
    });

    pool.on('error', (err) => {
      const safeError = translateDatabaseError(err, 'idle pool connection');
      console.error(`[PostgreSQL Pool Error] ${safeError.code}: ${safeError.message}`);
    });

    globalThis._akpPostgresPool = pool;
  }

  return globalThis._akpPostgresPool;
}

/**
 * Lazily initializes and returns the Drizzle ORM instance bound to the schema.
 * No connection socket is opened until a query is executed.
 */
export function getDb(): AppDatabase {
  if (!globalThis._akpDrizzleDb) {
    const pool = getPool();
    globalThis._akpDrizzleDb = drizzle(pool, { schema });
  }
  return globalThis._akpDrizzleDb;
}

/**
 * Executes a callback inside a PostgreSQL transaction with sanitized error handling.
 */
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
  try {
    const db = getDb();
    return await db.transaction(fn);
  } catch (err) {
    throw translateDatabaseError(err, 'database transaction');
  }
}

/**
 * Gracefully drains and closes the singleton connection pool.
 */
export async function closeDatabasePool(): Promise<void> {
  if (globalThis._akpPostgresPool) {
    const pool = globalThis._akpPostgresPool;
    globalThis._akpPostgresPool = undefined;
    globalThis._akpDrizzleDb = undefined;
    await pool.end();
  }
}
