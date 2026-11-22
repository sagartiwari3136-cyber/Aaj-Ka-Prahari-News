import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateStorageDriverConfig,
  parseTrustProxyConfig,
  getAllowedCorsOrigins,
} from '../config/env';
import { atomicWriteFileSync } from '../utils/atomicFile';
import { persistStoreSnapshot } from '../store';
import { isSafeHttpUrl, articlesQuerySchema, MAX_ARTICLES_LIMIT } from '../validation/schemas';

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return;
    } catch {
      // retry until ready
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`Server did not respond in time at ${url}`);
}

function setupIsolatedWorkdir(dirPath: string, withSeedStore = true): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(path.join(dirPath, 'data'), { recursive: true });
  fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(dirPath, 'node_modules'));
  fs.symlinkSync(path.join(process.cwd(), 'dist'), path.join(dirPath, 'dist'));
  fs.symlinkSync(path.join(process.cwd(), 'package.json'), path.join(dirPath, 'package.json'));

  if (withSeedStore) {
    const fixtureStore = {
      articles: [
        {
          id: 'pub-c43-1',
          title: 'B_Public Article',
          slug: 'b-public-article',
          summary: 'Public summary B',
          content: 'Public content B',
          category: 'देश',
          author: { name: 'Desk', role: 'Editor', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120' },
          publishedAt: '2026-10-01T10:00:00Z',
          readTime: '2 मिनट',
          imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800',
          isBreaking: false,
          isFeatured: true,
          tags: ['c43'],
          status: 'published',
          location: 'नई दिल्ली',
        },
        {
          id: 'pub-c43-2',
          title: 'A_Public Article',
          slug: 'a-public-article',
          summary: 'Public summary A',
          content: 'Public content A',
          category: 'कारोबार',
          author: { name: 'Desk', role: 'Editor', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120' },
          publishedAt: '2026-10-02T10:00:00Z',
          readTime: '2 मिनट',
          imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800',
          isBreaking: true,
          isFeatured: false,
          tags: ['c43'],
          status: 'published',
          location: 'मुंबई',
        },
        {
          id: 'draft-c43-1',
          title: 'Secret C43 Draft',
          slug: 'secret-c43-draft',
          summary: 'Hidden summary',
          content: 'Hidden content',
          category: 'देश',
          author: { name: 'Desk', role: 'Editor', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120' },
          publishedAt: '2026-10-03T10:00:00Z',
          readTime: '2 मिनट',
          imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800',
          isBreaking: true,
          isFeatured: true,
          tags: ['c43'],
          status: 'draft',
          location: 'पटना',
        },
      ],
      stateNews: { दिल्ली: [], महाराष्ट्र: [], 'उत्तर प्रदेश': [], बिहार: [], पंजाब: [] },
      videos: [],
      editors: [],
      liveUpdates: [],
      logs: [],
      lastSavedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(dirPath, 'data', 'store.json'),
      JSON.stringify(fixtureStore, null, 2)
    );
  }
}

describe('Phase C4.3 Unit Guards: Storage Driver, Trust Proxy, CORS, URLs & Atomic Files', () => {
  it('validates STORAGE_DRIVER fail-closed configuration', () => {
    assert.equal(validateStorageDriverConfig(undefined), 'json');
    assert.equal(validateStorageDriverConfig('json'), 'json');
    assert.throws(() => validateStorageDriverConfig('postgres'), /PostgreSQL/i);
    assert.throws(() => validateStorageDriverConfig('mysql'), /Invalid STORAGE_DRIVER/i);
    assert.throws(() => validateStorageDriverConfig(''), /Invalid STORAGE_DRIVER/i);
  });

  it('parses TRUST_PROXY safely and rejects unsafe TRUST_PROXY=true', () => {
    assert.equal(parseTrustProxyConfig(undefined), false);
    assert.equal(parseTrustProxyConfig('false'), false);
    assert.equal(parseTrustProxyConfig('1'), 1);
    assert.equal(parseTrustProxyConfig('loopback'), 'loopback');
    assert.deepEqual(parseTrustProxyConfig('loopback, 10.0.0.0/8'), ['loopback', '10.0.0.0/8']);
    assert.throws(() => parseTrustProxyConfig('true'), /disallowed/i);
    assert.throws(() => parseTrustProxyConfig('99'), /hop count/i);
  });

  it('validates CORS_ALLOWED_ORIGINS strictly without wildcards', () => {
    const empty = getAllowedCorsOrigins('');
    assert.equal(empty.size, 0);

    const parsed = getAllowedCorsOrigins('https://cms.akpnews.example/path, http://localhost:4000');
    assert.deepEqual(Array.from(parsed).sort(), [
      'http://localhost:4000',
      'https://cms.akpnews.example',
    ]);

    assert.throws(() => getAllowedCorsOrigins('*'), /Wildcard/);
    assert.throws(() => getAllowedCorsOrigins('javascript:alert(1)'), /http:\/\/ or https:\/\//i);
  });

  it('enforces safe http/https URL validation and query normalization', () => {
    assert.equal(isSafeHttpUrl('https://images.unsplash.com/photo-1.jpg'), true);
    assert.equal(isSafeHttpUrl('http://cdn.example.com/news.mp4'), true);
    assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
    assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isSafeHttpUrl('file:///etc/passwd'), false);
    assert.equal(isSafeHttpUrl('https://user:secret@example.com/img.png'), false);
    assert.equal(isSafeHttpUrl('not-a-url'), false);

    const capped = articlesQuerySchema.parse({ limit: '5000', sort: 'title', order: 'asc' });
    assert.equal(capped.limit, MAX_ARTICLES_LIMIT);
    assert.equal(capped.sort, 'title');
    assert.equal(capped.order, 'asc');

    assert.equal(articlesQuerySchema.safeParse({ limit: '-5' }).success, false);
    assert.equal(articlesQuerySchema.safeParse({ limit: 'abc' }).success, false);
    assert.equal(articlesQuerySchema.safeParse({ sort: '__proto__' }).success, false);
    assert.equal(articlesQuerySchema.safeParse({ order: 'random' }).success, false);
  });

  it('performs atomic writes with no leftover temp files and preserves original file on write failure', () => {
    const tmpRoot = '/tmp/akp-c43-atomic-unit';
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.mkdirSync(tmpRoot, { recursive: true });
    const targetFile = path.join(tmpRoot, 'test-store.json');

    try {
      atomicWriteFileSync(targetFile, JSON.stringify({ step: 1 }), 0o600);
      assert.equal(JSON.parse(fs.readFileSync(targetFile, 'utf8')).step, 1);
      assert.equal(fs.statSync(targetFile).mode & 0o777, 0o600);
      assert.deepEqual(fs.readdirSync(tmpRoot), ['test-store.json']);

      // Simulate concurrent atomic writes
      for (let i = 2; i <= 20; i++) {
        atomicWriteFileSync(targetFile, JSON.stringify({ step: i, payload: 'x'.repeat(100) }), 0o600);
      }
      assert.equal(JSON.parse(fs.readFileSync(targetFile, 'utf8')).step, 20);
      assert.deepEqual(fs.readdirSync(tmpRoot), ['test-store.json']);

      // Simulate failure: serialize error in persistStoreSnapshot must leave original file uncorrupted
      const cyclic: any = { intact: true };
      cyclic.self = cyclic;
      assert.throws(() => {
        persistStoreSnapshot(cyclic, targetFile);
      });
      assert.equal(JSON.parse(fs.readFileSync(targetFile, 'utf8')).step, 20);
      assert.deepEqual(fs.readdirSync(tmpRoot), ['test-store.json']);

      // Simulate rename failure even when running as root (renaming file over a directory fails with EISDIR/EEXIST)
      const failDir = path.join(tmpRoot, 'fail-rename');
      const dirAsTarget = path.join(failDir, 'blocked-target');
      fs.mkdirSync(dirAsTarget, { recursive: true });
      fs.writeFileSync(path.join(dirAsTarget, 'sentinel.txt'), 'keep');

      assert.throws(() => {
        atomicWriteFileSync(dirAsTarget, JSON.stringify({ overwrite: true }), 0o600);
      });

      // Temp file was cleaned up and sentinel remains intact
      assert.deepEqual(fs.readdirSync(failDir), ['blocked-target']);
      assert.equal(fs.readFileSync(path.join(dirAsTarget, 'sentinel.txt'), 'utf8'), 'keep');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('Phase C4.3 Startup Guards (Fail-Closed Process Exit)', () => {
  it('refuses startup when STORAGE_DRIVER=postgres, invalid driver, or TRUST_PROXY=true', () => {
    const tmpDir = '/tmp/akp-c43-startup-guard';
    setupIsolatedWorkdir(tmpDir, false);

    try {
      const cases = [
        { STORAGE_DRIVER: 'postgres' },
        { STORAGE_DRIVER: 'sqlite' },
        { STORAGE_DRIVER: 'json', TRUST_PROXY: 'true' },
      ];

      for (const extraEnv of cases) {
        const res = spawnSync('node', ['dist/server.cjs'], {
          cwd: tmpDir,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: '3199',
            ...extraEnv,
          },
          encoding: 'utf-8',
          timeout: 5000,
        });
        assert.notEqual(res.status, 0, `Expected non-zero exit for ${JSON.stringify(extraEnv)}`);
        assert.match(res.stderr, /FATAL:/);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Phase C4.3 Bootstrap Concurrency & Auth Store Permissions', () => {
  const TMP_DIR = '/tmp/akp-c43-bootstrap-race';
  const TEST_PORT = 3113;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  let serverProc: ChildProcess | null = null;

  before(async () => {
    setupIsolatedWorkdir(TMP_DIR, true);
    serverProc = spawn('node', ['dist/server.cjs'], {
      cwd: TMP_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(TEST_PORT),
        STORAGE_DRIVER: 'json',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      stdio: 'ignore',
      detached: true,
    });
    await waitForServer(`${BASE_URL}/api/admin/bootstrap-status`);
  });

  after(() => {
    if (serverProc?.pid) {
      try {
        process.kill(-serverProc.pid, 'SIGKILL');
      } catch {
        // already stopped
      }
    }
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('serializes simultaneous bootstrap requests so exactly one Chief Admin is created with 0600 permissions', async () => {
    const attempts = Array.from({ length: 8 }, (_, idx) =>
      fetch(`${BASE_URL}/api/admin/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `race_admin_${idx}`,
          password: 'StrongPassword#C43',
          name: `Admin ${idx}`,
        }),
      })
    );

    const responses = await Promise.all(attempts);
    const statuses = responses.map((r) => r.status);
    const createdCount = statuses.filter((s) => s === 201).length;
    const rejectedCount = statuses.filter((s) => s === 403 || s === 409).length;

    assert.equal(createdCount, 1, `Expected exactly 1 created admin, got statuses: ${statuses.join(',')}`);
    assert.equal(rejectedCount, 7);

    // Inspect auth-store.json on disk: strictly valid JSON, 0600 mode, and exactly 1 user
    const authFile = path.join(TMP_DIR, 'data', 'auth-store.json');
    const mode = fs.statSync(authFile).mode & 0o777;
    assert.equal(mode, 0o600);

    const authJson = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    assert.equal(authJson.users.length, 1);
    assert.equal(authJson.users[0].roleCode, 'chief_admin');

    // No stray .tmp files left behind
    const filesInData = fs.readdirSync(path.join(TMP_DIR, 'data'));
    assert.equal(filesInData.some((f) => f.endsWith('.tmp')), false);
  });
});

describe('Phase C4.3 HTTP Hardening Integration (Headers, CORS, Rate Limit, URL/Query Validation, Error Sanitization, Regression)', () => {
  const TMP_DIR = '/tmp/akp-c43-http-hardening';
  const TEST_PORT = 3114;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  const ALLOWED_CORS_ORIGIN = 'https://trusted-cms.akpnews.example';
  let serverProc: ChildProcess | null = null;
  let adminToken = '';

  before(async () => {
    setupIsolatedWorkdir(TMP_DIR, true);
    serverProc = spawn('node', ['dist/server.cjs'], {
      cwd: TMP_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(TEST_PORT),
        STORAGE_DRIVER: 'json',
        TRUST_PROXY: 'false',
        CORS_ALLOWED_ORIGINS: ALLOWED_CORS_ORIGIN,
        ADMIN_LOGIN_MAX_ATTEMPTS: '3',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      stdio: 'ignore',
      detached: true,
    });
    await waitForServer(`${BASE_URL}/api/admin/bootstrap-status`);

    const boot = await fetch(`${BASE_URL}/api/admin/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'c43_chief',
        password: 'StrongPassword#C43',
        name: 'C43 Chief Admin',
      }),
    });
    assert.equal(boot.status, 201);
    const bootJson = await boot.json();
    adminToken = bootJson.token;
    assert.ok(adminToken);
  });

  after(() => {
    if (serverProc?.pid) {
      try {
        process.kill(-serverProc.pid, 'SIGKILL');
      } catch {
        // already stopped
      }
    }
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('emits production HTTP security headers & CSP compatible with the built frontend and no-store on Admin routes', async () => {
    const publicHtmlRes = await fetch(`${BASE_URL}/`);
    assert.equal(publicHtmlRes.status, 200);
    assert.equal(publicHtmlRes.headers.get('x-powered-by'), null);
    assert.equal(publicHtmlRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(publicHtmlRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(publicHtmlRes.headers.get('x-frame-options'), 'DENY');
    assert.ok(publicHtmlRes.headers.get('permissions-policy')?.includes('camera=()'));

    const csp = publicHtmlRes.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("script-src 'self'"));
    assert.equal(csp.includes("script-src 'self' 'unsafe-inline'"), false);
    assert.equal(csp.includes("'unsafe-eval'"), false);

    // Verify dist/index.html scripts & stylesheets match CSP rules and are actually fetchable
    const htmlBody = await publicHtmlRes.text();
    const scriptMatches = Array.from(htmlBody.matchAll(/<script[^>]+src="([^"]+)"/g));
    assert.ok(scriptMatches.length > 0);
    for (const match of scriptMatches) {
      assert.ok(match[1].startsWith('/assets/'));
      const assetRes = await fetch(`${BASE_URL}${match[1]}`);
      assert.equal(assetRes.status, 200);
    }

    // Verify Admin/Auth cache headers
    const adminCheckRes = await fetch(`${BASE_URL}/api/admin/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminCheckRes.status, 200);
    assert.ok(adminCheckRes.headers.get('cache-control')?.includes('no-store'));
    assert.equal(adminCheckRes.headers.get('pragma'), 'no-cache');

    const adminHtmlRes = await fetch(`${BASE_URL}/admin/login`);
    assert.equal(adminHtmlRes.status, 200);
    assert.ok(adminHtmlRes.headers.get('cache-control')?.includes('no-store'));
  });

  it('enforces explicit-allowlist CORS and rejects untrusted cross-origin requests cleanly', async () => {
    // Direct request without Origin -> allowed, no ACAO header
    const directRes = await fetch(`${BASE_URL}/api/articles`);
    assert.equal(directRes.status, 200);
    assert.equal(directRes.headers.get('access-control-allow-origin'), null);

    // Untrusted origin -> 403 and no ACAO
    const evilGet = await fetch(`${BASE_URL}/api/articles`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    assert.equal(evilGet.status, 403);
    assert.equal(evilGet.headers.get('access-control-allow-origin'), null);

    const evilPreflight = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(evilPreflight.status, 403);
    assert.equal(evilPreflight.headers.get('access-control-allow-origin'), null);

    // Same-origin browser request -> allowed
    const sameOriginRes = await fetch(`${BASE_URL}/api/articles`, {
      headers: { Origin: BASE_URL },
    });
    assert.equal(sameOriginRes.status, 200);

    // Explicitly allowlisted origin -> exact reflected ACAO, no wildcard, no credentials
    const allowedPreflight = await fetch(`${BASE_URL}/api/articles`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_CORS_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(allowedPreflight.status, 204);
    assert.equal(allowedPreflight.headers.get('access-control-allow-origin'), ALLOWED_CORS_ORIGIN);
    assert.equal(allowedPreflight.headers.get('access-control-allow-credentials'), null);
  });

  it('blocks spoofed X-Forwarded-For from bypassing login rate limits when TRUST_PROXY=false', async () => {
    for (let i = 1; i <= 3; i++) {
      const attempt = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `203.0.113.${i}`,
        },
        body: JSON.stringify({ username: 'spoof_target', password: 'WrongPassword!' }),
      });
      assert.equal(attempt.status, 401);
    }

    // 4th attempt with a fresh spoofed X-Forwarded-For MUST still hit 429 lockout
    const blocked = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.99',
      },
      body: JSON.stringify({ username: 'spoof_target', password: 'WrongPassword!' }),
    });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  });

  it('rejects dangerous URLs and malformed query params while allowing valid http/https and capped pagination', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // Dangerous URLs rejected
    for (const badUrl of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'https://admin:pass@evil.example/a.jpg',
      'not-a-valid-url',
    ]) {
      const artRes = await fetch(`${BASE_URL}/api/articles`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Bad URL Test',
          content: 'Body content',
          category: 'देश',
          imageUrl: badUrl,
        }),
      });
      assert.equal(artRes.status, 400, `Expected 400 for imageUrl=${badUrl}`);

      const vidRes = await fetch(`${BASE_URL}/api/videos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Bad Video URL',
          description: 'Desc',
          videoUrl: badUrl,
        }),
      });
      assert.equal(vidRes.status, 400, `Expected 400 for videoUrl=${badUrl}`);
    }

    // Invalid pagination & sorting rejected
    for (const badQuery of [
      '/api/articles?limit=-1',
      '/api/articles?limit=0',
      '/api/articles?limit=abc',
      '/api/articles?sort=passwordHash',
      '/api/articles?sort=__proto__',
      '/api/articles?order=sideways',
    ]) {
      const qRes = await fetch(`${BASE_URL}${badQuery}`);
      assert.equal(qRes.status, 400, `Expected 400 for ${badQuery}`);
    }

    // Valid allowlisted sort & excessive limit capping succeed
    const sortedRes = await fetch(`${BASE_URL}/api/articles?sort=title&order=asc&limit=5000`);
    assert.equal(sortedRes.status, 200);
    const sortedJson = await sortedRes.json();
    assert.deepEqual(
      sortedJson.data.map((a: any) => a.id),
      ['pub-c43-2', 'pub-c43-1']
    );
  });

  it('sanitizes malformed JSON and forced internal persistence errors with zero stack traces or paths', async () => {
    // Malformed JSON payload -> 400 sanitized JSON
    const badJsonRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"username": "broken"',
    });
    assert.equal(badJsonRes.status, 400);
    const badJsonText = await badJsonRes.text();
    assert.deepEqual(JSON.parse(badJsonText), {
      success: false,
      error: 'Invalid JSON request body',
    });

    // Force an internal FS rename error (EISDIR) on /api/system/reset (works even as root)
    const storePath = path.join(TMP_DIR, 'data', 'store.json');
    const backupStore = fs.readFileSync(storePath, 'utf-8');
    fs.rmSync(storePath);
    fs.mkdirSync(storePath, { recursive: true });
    fs.writeFileSync(path.join(storePath, 'lock'), 'busy');

    let errText = '';
    let errStatus = 0;
    try {
      const errRes = await fetch(`${BASE_URL}/api/system/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      errStatus = errRes.status;
      errText = await errRes.text();
    } finally {
      fs.rmSync(storePath, { recursive: true, force: true });
      fs.writeFileSync(storePath, backupStore, 'utf-8');
    }

    assert.equal(errStatus, 500);
    assert.deepEqual(JSON.parse(errText), {
      success: false,
      error: 'Internal server error',
    });
    assert.equal(errText.includes('/tmp/'), false);
    assert.equal(errText.includes('EISDIR'), false);
    assert.equal(errText.includes('EACCES'), false);
  });

  it('preserves C4.1 sensitive file blocks, Admin CMS login/CRUD/logout, and C4.2 public visibility', async () => {
    // C4.1 sensitive paths blocked
    for (const p of ['/data/auth-store.json', '/data/store.json', '/server.ts', '/package.json']) {
      const res = await fetch(`${BASE_URL}${p}`);
      assert.equal(res.status, 403, `Expected 403 for ${p}`);
    }

    // Authenticated CRUD + Public Visibility
    const createRes = await fetch(`${BASE_URL}/api/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'C43 Valid HTTPS Article',
        content: 'Verified editorial body',
        category: 'देश',
        imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800',
        status: 'published',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()).data;

    assert.equal((await fetch(`${BASE_URL}/api/articles/${created.id}`)).status, 200);
    assert.equal((await fetch(`${BASE_URL}/api/articles/draft-c43-1`)).status, 404);

    // Logout revokes token immediately
    const logoutRes = await fetch(`${BASE_URL}/api/admin/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(logoutRes.status, 200);

    const postLogoutMe = await fetch(`${BASE_URL}/api/admin/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(postLogoutMe.status, 401);
  });
});

describe('Phase C4.3 Trusted Proxy Rate Limiting (TRUST_PROXY=1)', () => {
  const TMP_DIR = '/tmp/akp-c43-trusted-proxy';
  const TEST_PORT = 3115;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  let serverProc: ChildProcess | null = null;

  before(async () => {
    setupIsolatedWorkdir(TMP_DIR, true);
    serverProc = spawn('node', ['dist/server.cjs'], {
      cwd: TMP_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(TEST_PORT),
        STORAGE_DRIVER: 'json',
        TRUST_PROXY: '1',
        ADMIN_LOGIN_MAX_ATTEMPTS: '2',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      stdio: 'ignore',
      detached: true,
    });
    await waitForServer(`${BASE_URL}/api/admin/bootstrap-status`);
  });

  after(() => {
    if (serverProc?.pid) {
      try {
        process.kill(-serverProc.pid, 'SIGKILL');
      } catch {
        // already stopped
      }
    }
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('uses trusted proxy client IP for independent per-client rate limiting', async () => {
    // Client A (198.51.100.10) fails twice -> locked on 3rd attempt
    for (let i = 0; i < 2; i++) {
      const r = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.10',
        },
        body: JSON.stringify({ username: 'proxy_user', password: 'WrongPassword!' }),
      });
      assert.equal(r.status, 401);
    }

    const lockedA = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.10',
      },
      body: JSON.stringify({ username: 'proxy_user', password: 'WrongPassword!' }),
    });
    assert.equal(lockedA.status, 429);

    // Client B (198.51.100.20) must NOT be blocked by Client A's attempts
    const clientB = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.20',
      },
      body: JSON.stringify({ username: 'proxy_user', password: 'WrongPassword!' }),
    });
    assert.equal(clientB.status, 401);
  });
});
