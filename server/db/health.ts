import { sql } from 'drizzle-orm';
import { isDatabaseConfigured } from '../config/env.ts';
import { getDb } from '../../src/db/index.ts';
import { translateDatabaseError, type DatabaseErrorCode } from './errors.ts';

export interface DatabaseHealthReport {
  status: 'healthy' | 'unconfigured' | 'unhealthy';
  configured: boolean;
  latencyMs: number | null;
  databaseName?: string;
  serverVersion?: string;
  tableCount?: number;
  errorCode?: DatabaseErrorCode;
  message: string;
  checkedAt: string;
}

/**
 * Executes a non-destructive read-only connectivity probe against PostgreSQL.
 * Safe to invoke on demand without crashing unconfigured environments.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthReport> {
  const checkedAt = new Date().toISOString();

  if (!isDatabaseConfigured('app')) {
    return {
      status: 'unconfigured',
      configured: false,
      latencyMs: null,
      errorCode: 'DB_NOT_CONFIGURED',
      message:
        'PostgreSQL runtime environment variables (SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD) are not configured.',
      checkedAt,
    };
  }

  const startedAt = performance.now();

  try {
    const db = getDb();

    const pingResult = await db.execute<{
      ok: number;
      database_name: string;
      server_version: string;
    }>(sql`SELECT 1 AS ok, current_database() AS database_name, version() AS server_version`);

    const tableCountResult = await db.execute<{ table_count: string }>(
      sql`SELECT COUNT(*)::text AS table_count FROM information_schema.tables WHERE table_schema = 'public'`
    );

    const latencyMs = Math.round(performance.now() - startedAt);
    const meta = pingResult.rows[0];
    const tableCount = Number(tableCountResult.rows[0]?.table_count ?? 0);

    return {
      status: 'healthy',
      configured: true,
      latencyMs,
      databaseName: meta?.database_name,
      serverVersion: meta?.server_version?.split(',')[0],
      tableCount,
      message: 'PostgreSQL connection pool is healthy and responsive.',
      checkedAt,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const safeError = translateDatabaseError(err, 'health check');
    return {
      status: 'unhealthy',
      configured: true,
      latencyMs,
      errorCode: safeError.code,
      message: safeError.message,
      checkedAt,
    };
  }
}
