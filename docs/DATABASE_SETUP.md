# आज का प्रहरी (AKP News) — PostgreSQL & Drizzle ORM Setup Guide (Phase A)

This guide documents **Phase A (Database Foundation)** for local development and production PostgreSQL setup. During Phase A, the running web application continues using `data/store.json` (`STORAGE_DRIVER=json`) with zero breaking changes.

---

## 1. Environment Variables

Copy `.env.example` to `.env` (`.env*` is already ignored in `.gitignore`):

```bash
cp .env.example .env
```

Never commit `.env`, database passwords, or tokens to Git.

| Variable | Required For | Description | Example Placeholder |
| --- | --- | --- | --- |
| `STORAGE_DRIVER` | Runtime | Active persistence backend (`json` in Phase A; `postgres` later) | `json` |
| `SQL_HOST` | Runtime & Migrations | Hostname, IP, or Cloud SQL Auth Proxy Unix socket path | `localhost` |
| `SQL_PORT` | Runtime & Migrations | PostgreSQL TCP port (ignored when `SQL_HOST` is a Unix socket) | `5432` |
| `SQL_DB_NAME` | Runtime & Migrations | Target PostgreSQL database name | `akp_news` |
| `SQL_USER` | Runtime App Pool | Least-privilege application role (DML only: SELECT/INSERT/UPDATE/DELETE) | `akp_app_user` |
| `SQL_PASSWORD` | Runtime App Pool | Password for `SQL_USER` | `CHANGE_ME_APP_PASSWORD` |
| `SQL_ADMIN_USER` | Drizzle Migrations | Privileged owner role used exclusively by `drizzle-kit` | `akp_admin` |
| `SQL_ADMIN_PASSWORD` | Drizzle Migrations | Password for `SQL_ADMIN_USER` | `CHANGE_ME_ADMIN_PASSWORD` |
| `SQL_SSL` | Runtime & Migrations | `'false'` (local / Auth Proxy), `'true'` (strict TLS), `'require'` (managed cloud TLS without custom CA) | `false` |
| `SQL_POOL_MAX` | Runtime App Pool | Max concurrent connections in `pg.Pool` (1–50, default `10`) | `10` |
| `SQL_IDLE_TIMEOUT_MS` | Runtime App Pool | Idle client timeout in ms (default `30000`) | `30000` |
| `SQL_CONNECTION_TIMEOUT_MS` | Runtime App Pool | Connection acquisition timeout in ms (default `15000`) | `15000` |

> **Connection Security Note:** The application uses the `pg.Pool` **Object Method** (`host`, `port`, `user`, `password`, `database`, `ssl`) instead of a single `DATABASE_URL` string. This avoids URL-encoding issues on passwords and supports both TCP hosts and Unix domain sockets cleanly.

---

## 2. Local PostgreSQL Setup

### Option A: Docker (Recommended for Local Development)

1. Start a local PostgreSQL 16 container with UTF-8 encoding (required for Hindi/Devanagari text):

```bash
docker run -d \
  --name akp-news-postgres \
  -e POSTGRES_DB=akp_news \
  -e POSTGRES_USER=akp_admin \
  -e POSTGRES_PASSWORD=YOUR_LOCAL_ADMIN_PASSWORD \
  -e POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale=C.UTF-8" \
  -p 5432:5432 \
  postgres:16-alpine
```

2. Create the least-privilege runtime application role (`akp_app_user`) inside PostgreSQL:

```sql
CREATE ROLE akp_app_user WITH LOGIN PASSWORD 'YOUR_LOCAL_APP_PASSWORD';
GRANT CONNECT ON DATABASE akp_news TO akp_app_user;
GRANT USAGE ON SCHEMA public TO akp_app_user;

-- After applying migrations (Section 3), grant DML rights on tables & sequences:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO akp_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO akp_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO akp_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO akp_app_user;
```

### Option B: Native Local PostgreSQL (`psql`)

```sql
CREATE ROLE akp_admin WITH LOGIN PASSWORD 'YOUR_LOCAL_ADMIN_PASSWORD';
CREATE DATABASE akp_news WITH OWNER = akp_admin ENCODING = 'UTF8';
CREATE ROLE akp_app_user WITH LOGIN PASSWORD 'YOUR_LOCAL_APP_PASSWORD';
```

Then connect to `akp_news` and run the same `GRANT` statements shown above.

---

## 3. Drizzle Migration Generation & Execution

1. **Generate SQL migrations** from `src/db/schema.ts` (offline, non-destructive):

```bash
npm run db:generate
```

2. **Apply pending migrations** to the configured PostgreSQL database using `SQL_ADMIN_USER`:

```bash
npm run db:migrate
```

3. *(Optional in early local development)* Push schema directly without migration history:

```bash
npm run db:push
```

4. *(Optional)* Inspect tables and relations in Drizzle Studio:

```bash
npm run db:studio
```

---

## 4. Testing the Database Connection

Run the standalone non-destructive health check script (`SELECT 1`, database name, PostgreSQL version, and table count in `public`):

```bash
npm run db:health
```

- If `SQL_*` environment variables are missing, the command exits cleanly with `status: "unconfigured"` (without exposing secrets or crashing).
- If PostgreSQL is reachable and credentials are valid, it prints `status: "healthy"`, latency in milliseconds, database name, PostgreSQL version, and table count.

---

## 5. Production Database Setup Guidelines

1. **Managed PostgreSQL / Cloud SQL:**
   - Provision PostgreSQL 15/16 with `UTF8` encoding, automated daily backups, and point-in-time recovery (PITR).
   - Never expose PostgreSQL port `5432` to `0.0.0.0/0`; use Cloud SQL Auth Proxy (Unix socket via `SQL_HOST=/cloudsql/<connection-name>`, `SQL_SSL=false`) or private VPC networking with TLS (`SQL_SSL=require` or `SQL_SSL=true`).
2. **Least-Privilege Roles:**
   - Run migrations in CI/CD or a controlled maintenance job using `SQL_ADMIN_USER`.
   - Run the Node.js application runtime using `SQL_USER`, which cannot execute `DROP`, `ALTER`, or schema DDL.
3. **Pooling & Serverless Limits:**
   - Keep `SQL_POOL_MAX` conservative (`5`–`10` per container instance) so autoscaling containers do not exhaust PostgreSQL `max_connections`.
   - The pool is initialized lazily on demand—never via eager startup loops—preventing `429` proxy throttling or crash loops if the database is temporarily unavailable.
4. **Secrets Management:**
   - Inject `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, and TLS settings via secret manager / Cloud Run environment variables. Never bake `.env` into Docker images.
