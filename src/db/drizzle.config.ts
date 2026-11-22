import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isOfflineGenerate = process.argv.includes('generate');

const host = process.env.SQL_HOST?.trim() || '';
const port = Number(process.env.SQL_PORT || 5432);
const database = process.env.SQL_DB_NAME?.trim() || '';
const user = process.env.SQL_ADMIN_USER?.trim() || '';
const password = process.env.SQL_ADMIN_PASSWORD || '';
const sslEnv = process.env.SQL_SSL?.trim() || 'false';

if (!isOfflineGenerate) {
  const missing: string[] = [];
  if (!host) missing.push('SQL_HOST');
  if (!database) missing.push('SQL_DB_NAME');
  if (!user) missing.push('SQL_ADMIN_USER');
  if (!password) missing.push('SQL_ADMIN_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required Drizzle migration environment variable(s): ${missing.join(', ')}`
    );
  }
}

const ssl =
  sslEnv === 'true'
    ? true
    : sslEnv === 'require'
      ? { rejectUnauthorized: false }
      : false;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
  dbCredentials: {
    host: host || 'localhost',
    port: Number.isFinite(port) && port > 0 ? port : 5432,
    user: user || 'postgres',
    password,
    database: database || 'akp_news',
    ssl,
  },
});
