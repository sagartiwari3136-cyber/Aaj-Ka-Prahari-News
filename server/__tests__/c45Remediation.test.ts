import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

function setupIsolatedWorkdir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(path.join(dirPath, 'data'), { recursive: true });
  fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(dirPath, 'node_modules'));
  fs.symlinkSync(path.join(process.cwd(), 'dist'), path.join(dirPath, 'dist'));
  fs.symlinkSync(path.join(process.cwd(), 'package.json'), path.join(dirPath, 'package.json'));

  const fixtureStore = {
    articles: [
      {
        id: 'art-legacy-metrics',
        title: 'Legacy Engagement Fields Article',
        slug: 'legacy-engagement-fields-article',
        summary: 'Summary',
        content: 'Body content',
        category: 'देश',
        author: {
          name: 'राजेश शर्मा',
          role: 'प्रधान संपादक',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
        },
        publishedAt: '2026-10-01T10:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800',
        isBreaking: false,
        isFeatured: false,
        tags: ['c45'],
        status: 'published',
        location: 'नई दिल्ली',
        views: 999,
        likes: 88,
        commentsCount: 12,
      },
    ],
    stateNews: {
      दिल्ली: [
        {
          id: 'st-c45-1',
          state: 'दिल्ली',
          city: 'नई दिल्ली',
          title: 'Delhi Metro Expansion',
          summary: 'Summary',
          content: 'Content',
          imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800',
          publishedAt: '2026-10-01T10:00:00Z',
          reporter: 'दिल्ली ब्यूरो',
          readTime: '2 मिनट',
          tags: ['दिल्ली'],
          isHeadline: true,
        },
      ],
      महाराष्ट्र: [],
      'उत्तर प्रदेश': [],
      बिहार: [],
      पंजाब: [],
    },
    videos: [
      {
        id: 'vid-legacy-1',
        title: 'Legacy Video',
        description: 'Desc',
        thumbnailUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800',
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        duration: '04:00',
        category: 'विशेष बुलेटिन',
        publishedAt: 'अभी-अभी',
        anchor: 'प्रहरी एंकर',
        views: 500,
        viewsCount: 500,
        viewsDisplay: '500K',
      },
    ],
    editors: [
      {
        id: 'ed-c45-1',
        name: 'Editor One',
        role: 'Anchor',
        imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
      },
    ],
    liveUpdates: [
      {
        id: 'live-c45-1',
        timestamp: 'अभी-अभी',
        title: 'Live Wire C45',
        content: 'Live body',
        category: 'देश',
        isBreaking: true,
        author: 'Desk',
        verified: true,
      },
    ],
    logs: [],
    lastSavedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(dirPath, 'data', 'store.json'),
    JSON.stringify(fixtureStore, null, 2),
    { mode: 0o644 }
  );
  // Intentionally start with loose permissions (0o644) to test server tightening on load
  fs.chmodSync(path.join(dirPath, 'data', 'store.json'), 0o644);
}

describe('Phase C4.5 Priority 2: Auth Store Concurrency & State Preservation', () => {
  const TMP_DIR = '/tmp/akp-c45-auth-concurrency';
  let originalCwd = '';

  before(() => {
    originalCwd = process.cwd();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.join(TMP_DIR, 'data'), { recursive: true });
    process.chdir(TMP_DIR);
  });

  after(() => {
    process.chdir(originalCwd);
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('serializes simultaneous sessions, revocations, deletions, and env syncs without lost writes or corruption', async () => {
    // Dynamic import inside isolated CWD so AUTH_STORE_FILE resolves inside TMP_DIR/data
    const authStore = await import('../auth/authStore');

    const chief = await authStore.bootstrapChiefAdmin({
      username: 'c45_chief',
      password: 'StrongPassword#C45',
      name: 'Chief Admin C45',
    });

    const editorA = await authStore.createAdminUser({
      username: 'c45_editor_a',
      password: 'StrongPassword#EdA',
      roleCode: 'senior_editor',
      name: 'Editor A',
    });

    const editorB = await authStore.createAdminUser({
      username: 'c45_editor_b',
      password: 'StrongPassword#EdB',
      roleCode: 'senior_editor',
      name: 'Editor B',
    });

    // Pre-create one session for editorB that will be concurrently deleted and one for chief to revoke
    const sessionToRevoke = await authStore.createSessionForUser(chief.id, {
      ipAddress: '127.0.0.1',
      userAgent: 'revoke-target',
    });
    const sessionOfDeletedUser = await authStore.createSessionForUser(editorB.id, {
      ipAddress: '127.0.0.1',
      userAgent: 'deleted-user',
    });

    // Launch mixed concurrent auth mutations including env sync with ADMIN_USERNAME/ADMIN_PASSWORD
    process.env.ADMIN_USERNAME = 'c45_env_admin';
    process.env.ADMIN_PASSWORD = 'StrongEnvPassword#C45';
    delete process.env.ADMIN_PASSWORD_HASH;

    try {
      const sessionPromises = Array.from({ length: 10 }, (_, idx) =>
        authStore.createSessionForUser(idx % 2 === 0 ? chief.id : editorA.id, {
          ipAddress: '127.0.0.1',
          userAgent: `concurrent-worker-${idx}`,
        })
      );

      const [sessions, revokedResult, deleteResult] = await Promise.all([
        Promise.all(sessionPromises),
        authStore.revokeSessionToken(sessionToRevoke.rawToken),
        authStore.deleteAdminUser(editorB.id, chief.id),
        authStore.ensureEnvAdminAccountsSynced(),
      ]);

      assert.equal(revokedResult, true);
      assert.equal(deleteResult, true);
      assert.equal(sessions.length, 10);

      // Every concurrently created session for surviving users MUST be valid
      for (const s of sessions) {
        const verified = authStore.verifySessionToken(s.rawToken);
        assert.ok(verified, 'Concurrently created session was dropped!');
      }

      // Revoked session MUST stay revoked
      assert.equal(authStore.verifySessionToken(sessionToRevoke.rawToken), null);

      // Deleted user and their sessions MUST stay deleted
      assert.equal(authStore.verifySessionToken(sessionOfDeletedUser.rawToken), null);
      const users = authStore.listAdminUsers();
      assert.equal(
        users.some((u) => u.id === editorB.id),
        false
      );
      assert.equal(
        users.some((u) => u.username === 'c45_editor_a'),
        true
      );
      assert.equal(
        users.filter((u) => u.username === 'c45_env_admin').length,
        1
      );

      // auth-store.json on disk MUST be valid JSON with 0600 permissions and no leftover .tmp files
      const authFile = path.join(TMP_DIR, 'data', 'auth-store.json');
      assert.equal(fs.statSync(authFile).mode & 0o777, 0o600);
      assert.deepEqual(fs.readdirSync(path.join(TMP_DIR, 'data')), ['auth-store.json']);
      const parsed = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      const activeStored = parsed.sessions.filter((s: any) => s.revokedAt === null);
      const revokedStored = parsed.sessions.filter((s: any) => s.revokedAt !== null);
      assert.equal(activeStored.length, 10);
      assert.equal(revokedStored.length, 2);
    } finally {
      delete process.env.ADMIN_USERNAME;
      delete process.env.ADMIN_PASSWORD;
    }
  });
});

describe('Phase C4.5 Priority 7: Store File Permissions (0600) Without Content Mutation', () => {
  const TMP_DIR = '/tmp/akp-c45-store-perms';
  let originalCwd = '';
  let storeModule: typeof import('../store');

  before(async () => {
    originalCwd = process.cwd();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.join(TMP_DIR, 'data'), { recursive: true });
    process.chdir(TMP_DIR);
    storeModule = await import('../store');
  });

  after(() => {
    process.chdir(originalCwd);
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('enforces 0o600 permissions on store.json on load without altering content and on persistStoreSnapshot', () => {
    const targetStore = path.join(TMP_DIR, 'data', 'store.json');
    const content = JSON.stringify({
      articles: [],
      stateNews: { दिल्ली: [], महाराष्ट्र: [], 'उत्तर प्रदेश': [], बिहार: [], पंजाब: [] },
      videos: [],
      editors: [],
      liveUpdates: [],
      logs: [],
      lastSavedAt: '2026-11-21T00:00:00.000Z',
    });
    fs.writeFileSync(targetStore, content, { mode: 0o644 });
    fs.chmodSync(targetStore, 0o644);
    const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(targetStore)).digest('hex');

    storeModule.getStore();
    assert.equal(fs.statSync(targetStore).mode & 0o777, 0o600);
    const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(targetStore)).digest('hex');
    assert.equal(hashAfter, hashBefore);

    const freshTarget = path.join(TMP_DIR, 'data', 'fresh-store.json');
    storeModule.persistStoreSnapshot(
      {
        articles: [],
        stateNews: { दिल्ली: [], महाराष्ट्र: [], 'उत्तर प्रदेश': [], बिहार: [], पंजाब: [] },
        videos: [],
        editors: [],
        liveUpdates: [],
        logs: [],
        lastSavedAt: '2026-11-21T01:00:00.000Z',
      },
      freshTarget
    );
    assert.equal(fs.statSync(freshTarget).mode & 0o777, 0o600);
  });
});

describe('Phase C4.5 Priorities 3, 4 & 7 HTTP Verification (Write :id validation, Output Sanitization, RBAC, Store 0600)', () => {
  const TMP_DIR = '/tmp/akp-c45-http-remediation';
  const TEST_PORT = 3116;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  let serverProc: ChildProcess | null = null;
  let chiefToken = '';
  let editorToken = '';

  before(async () => {
    setupIsolatedWorkdir(TMP_DIR);
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

    // Bootstrap Chief Admin
    const bootRes = await fetch(`${BASE_URL}/api/admin/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'c45_chief_http',
        password: 'StrongPassword#C45',
        name: 'C45 Chief HTTP',
      }),
    });
    assert.equal(bootRes.status, 201);
    chiefToken = (await bootRes.json()).token;

    // Create Senior Editor and log in
    const createEdRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chiefToken}`,
      },
      body: JSON.stringify({
        username: 'c45_senior_ed',
        password: 'StrongEditorPass#C45',
        roleCode: 'senior_editor',
        name: 'C45 Senior Editor',
      }),
    });
    assert.equal(createEdRes.status, 201);

    const loginEdRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'c45_senior_ed',
        password: 'StrongEditorPass#C45',
      }),
    });
    assert.equal(loginEdRes.status, 200);
    editorToken = (await loginEdRes.json()).token;
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

  it('tightens loose store.json and auth-store.json permissions to 0600 on startup', async () => {
    // Hit an article endpoint to ensure getStore() has run
    const res = await fetch(`${BASE_URL}/api/articles`);
    assert.equal(res.status, 200);
    assert.equal(fs.statSync(path.join(TMP_DIR, 'data', 'store.json')).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(TMP_DIR, 'data', 'auth-store.json')).mode & 0o777, 0o600);
  });

  it('rejects invalid :id parameters with 400 across all content and user write routes', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${chiefToken}`,
    };

    const badIds = ['%20%20%20', 'a%2fb', 'a%5cb', '%1fbad', '%7fbad', 'x'.repeat(205)];

    for (const badId of badIds) {
      const r1 = await fetch(`${BASE_URL}/api/articles/${badId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Updated' }),
      });
      assert.equal(r1.status, 400, `Expected 400 for PUT /api/articles/${badId}`);

      const r2 = await fetch(`${BASE_URL}/api/articles/${badId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert.equal(r2.status, 400, `Expected 400 for DELETE /api/articles/${badId}`);

      const r3 = await fetch(`${BASE_URL}/api/state-news/${badId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Updated' }),
      });
      assert.equal(r3.status, 400, `Expected 400 for PUT /api/state-news/${badId}`);

      const r4 = await fetch(`${BASE_URL}/api/state-news/${badId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert.equal(r4.status, 400, `Expected 400 for DELETE /api/state-news/${badId}`);

      const r5 = await fetch(`${BASE_URL}/api/videos/${badId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert.equal(r5.status, 400, `Expected 400 for DELETE /api/videos/${badId}`);

      const r6 = await fetch(`${BASE_URL}/api/editors/${badId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert.equal(r6.status, 400, `Expected 400 for DELETE /api/editors/${badId}`);

      const r7 = await fetch(`${BASE_URL}/api/live-updates/${badId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert.equal(r7.status, 400, `Expected 400 for DELETE /api/live-updates/${badId}`);

      const r8 = await fetch(`${BASE_URL}/api/admin/users/${badId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert.equal(r8.status, 400, `Expected 400 for DELETE /api/admin/users/${badId}`);
    }
  });

  it('sanitizes legacy engagement fields from POST, PUT, and DELETE article & video write responses', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${chiefToken}`,
    };

    // Update legacy article -> must omit views, likes, commentsCount
    const putLegacyRes = await fetch(`${BASE_URL}/api/articles/art-legacy-metrics`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ title: 'Sanitized Updated Article' }),
    });
    assert.equal(putLegacyRes.status, 200);
    const putLegacyJson = await putLegacyRes.json();
    assert.equal('views' in putLegacyJson.data, false);
    assert.equal('likes' in putLegacyJson.data, false);
    assert.equal('commentsCount' in putLegacyJson.data, false);

    // Delete legacy article -> must omit views, likes, commentsCount
    const delLegacyRes = await fetch(`${BASE_URL}/api/articles/art-legacy-metrics`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.equal(delLegacyRes.status, 200);
    const delLegacyJson = await delLegacyRes.json();
    assert.equal('views' in delLegacyJson.data, false);
    assert.equal('likes' in delLegacyJson.data, false);
    assert.equal('commentsCount' in delLegacyJson.data, false);

    // Create new article -> must omit views, likes, commentsCount
    const createArtRes = await fetch(`${BASE_URL}/api/articles`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Clean Output Article',
        content: 'Clean editorial body',
        category: 'देश',
        status: 'published',
      }),
    });
    assert.equal(createArtRes.status, 201);
    const createArtJson = await createArtRes.json();
    assert.equal('views' in createArtJson.data, false);
    assert.equal('likes' in createArtJson.data, false);
    assert.equal('commentsCount' in createArtJson.data, false);

    // Create video -> must omit views, viewsCount, viewsDisplay
    const createVidRes = await fetch(`${BASE_URL}/api/videos`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Clean Video',
        description: 'Clean video description',
      }),
    });
    assert.equal(createVidRes.status, 201);
    const createVidJson = await createVidRes.json();
    assert.equal('views' in createVidJson.data, false);
    assert.equal('viewsCount' in createVidJson.data, false);
    assert.equal('viewsDisplay' in createVidJson.data, false);

    // Delete legacy video -> must omit views, viewsCount, viewsDisplay
    const delVidRes = await fetch(`${BASE_URL}/api/videos/vid-legacy-1`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.equal(delVidRes.status, 200);
    const delVidJson = await delVidRes.json();
    assert.equal('views' in delVidJson.data, false);
    assert.equal('viewsCount' in delVidJson.data, false);
    assert.equal('viewsDisplay' in delVidJson.data, false);
  });

  it('enforces backend RBAC on chief_admin console routes while allowing senior_editor editorial operations', async () => {
    const editorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${editorToken}`,
    };

    for (const chiefRoute of [
      { method: 'GET', path: '/api/system/health' },
      { method: 'GET', path: '/api/system/logs' },
      { method: 'GET', path: '/api/analytics/dashboard' },
      { method: 'GET', path: '/api/system/export' },
      { method: 'POST', path: '/api/system/reset' },
      { method: 'GET', path: '/api/admin/users' },
    ]) {
      const res = await fetch(`${BASE_URL}${chiefRoute.path}`, {
        method: chiefRoute.method,
        headers: editorHeaders,
      });
      assert.equal(res.status, 403, `Expected 403 for senior_editor on ${chiefRoute.path}`);
    }

    // Senior editor CAN create/edit articles
    const edArtRes = await fetch(`${BASE_URL}/api/articles`, {
      method: 'POST',
      headers: editorHeaders,
      body: JSON.stringify({
        title: 'Senior Editor Permitted Story',
        content: 'Story content',
        category: 'देश',
        status: 'draft',
      }),
    });
    assert.equal(edArtRes.status, 201);
  });
});
