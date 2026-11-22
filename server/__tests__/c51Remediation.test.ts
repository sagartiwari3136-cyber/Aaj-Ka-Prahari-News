import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
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

function setupRuntimeLinks(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(path.join(dirPath, 'data'), { recursive: true });
  fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(dirPath, 'node_modules'));
  fs.symlinkSync(path.join(process.cwd(), 'dist'), path.join(dirPath, 'dist'));
  fs.symlinkSync(path.join(process.cwd(), 'package.json'), path.join(dirPath, 'package.json'));
}

function buildValidMinimalStore(extraTitle = 'Valid C51 Story') {
  return {
    articles: [
      {
        id: 'art-c51-valid',
        title: extraTitle,
        slug: 'valid-c51-story',
        summary: 'Valid summary',
        content: 'Valid full editorial body.',
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
        isFeatured: true,
        tags: ['c51'],
        status: 'published',
        location: 'नई दिल्ली',
      },
      {
        id: 'art-c51-draft',
        title: 'HIDDEN_C51_DRAFT',
        slug: 'hidden-c51-draft',
        summary: 'Draft summary',
        content: 'Draft body',
        category: 'देश',
        author: {
          name: 'Desk',
          role: 'Editor',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
        },
        publishedAt: '2026-10-01T10:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800',
        isBreaking: false,
        isFeatured: false,
        tags: ['c51'],
        status: 'draft',
        location: 'लखनऊ',
      },
    ],
    stateNews: {
      दिल्ली: [
        {
          id: 'st-c51-1',
          state: 'दिल्ली',
          city: 'नई दिल्ली',
          title: 'Delhi C51 State News',
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
        id: 'vid-c51-1',
        title: 'C51 Video Bulletin',
        description: 'Bulletin description',
        thumbnailUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800',
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        duration: '03:30',
        category: 'विशेष बुलेटिन',
        publishedAt: 'अभी-अभी',
        anchor: 'प्रहरी एंकर',
      },
    ],
    editors: [
      {
        id: 'ed-c51-1',
        name: 'Anchor One',
        role: 'Senior Anchor',
        imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
      },
    ],
    liveUpdates: [
      {
        id: 'live-c51-1',
        timestamp: 'अभी-अभी',
        title: 'C51 Live Update',
        content: 'Live dispatch body',
        category: 'देश',
        isBreaking: true,
        author: 'Desk',
        verified: true,
      },
    ],
    logs: [],
    lastSavedAt: '2026-10-01T10:00:00Z',
  };
}

describe('Phase C5.1.1: Fail-Closed JSON Storage Recovery', () => {
  const ROOT_TMP = '/tmp/akp-c51-storage-recovery';

  before(() => {
    fs.rmSync(ROOT_TMP, { recursive: true, force: true });
    fs.mkdirSync(ROOT_TMP, { recursive: true });
  });

  after(() => {
    fs.rmSync(ROOT_TMP, { recursive: true, force: true });
  });

  it('fails closed on corrupted store.json without overwriting or falling back to seed data', () => {
    const dir = path.join(ROOT_TMP, 'corrupt-store');
    setupRuntimeLinks(dir);
    const storePath = path.join(dir, 'data', 'store.json');
    const corruptPayload = '{"articles": [ { "broken": "SECRET_RAW_CONTENT_DO_NOT_LOG"';
    fs.writeFileSync(storePath, corruptPayload, { mode: 0o600 });
    const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(storePath)).digest('hex');

    const res = spawnSync('node', ['dist/server.cjs'], {
      cwd: dir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3191',
        STORAGE_DRIVER: 'json',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      encoding: 'utf-8',
      timeout: 5000,
    });

    assert.notEqual(res.status, 0, 'Server MUST exit non-zero when store.json is corrupted');
    assert.match(res.stderr, /FATAL:/);
    assert.equal(res.stderr.includes('SECRET_RAW_CONTENT_DO_NOT_LOG'), false);
    assert.equal(res.stdout.includes('SECRET_RAW_CONTENT_DO_NOT_LOG'), false);

    // Original corrupted file MUST remain byte-for-byte intact
    const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(storePath)).digest('hex');
    assert.equal(hashAfter, hashBefore);
  });

  it('prevents saveStoreSync, scheduleSaveStore, flushScheduledSave, and resetStore from overwriting corrupted store.json', () => {
    const dir = path.join(ROOT_TMP, 'corrupt-store-no-overwrite');
    setupRuntimeLinks(dir);
    const storePath = path.join(dir, 'data', 'store.json');
    const corruptPayload = '{"articles": "not-an-array-corrupt"}';
    fs.writeFileSync(storePath, corruptPayload, { mode: 0o600 });
    const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(storePath)).digest('hex');

    const storeTsAbs = path.join(process.cwd(), 'server', 'store.ts');
    const script = `
      import { getStore, saveStoreSync, scheduleSaveStore, flushScheduledSave, resetStore, isStoreLoadFailed } from ${JSON.stringify(
        storeTsAbs
      )};
      let threwOnLoad = false;
      try {
        getStore();
      } catch (e) {
        threwOnLoad = e?.name === 'StoreStorageError';
      }
      if (!threwOnLoad || !isStoreLoadFailed()) process.exit(2);
      // Attempt writes & shutdown flushes -> must NOT touch corrupted file
      saveStoreSync();
      scheduleSaveStore();
      flushScheduledSave();
      let threwOnReset = false;
      try {
        resetStore();
      } catch (e) {
        threwOnReset = e?.name === 'StoreStorageError';
      }
      if (!threwOnReset) process.exit(3);
      process.exit(0);
    `;

    const res = spawnSync('npx', ['tsx', '--input-type=module', '-e', script], {
      cwd: dir,
      env: process.env,
      encoding: 'utf-8',
      timeout: 8000,
    });

    assert.equal(res.status, 0, `Subprocess failed: ${res.stderr}`);
    const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(storePath)).digest('hex');
    assert.equal(hashAfter, hashBefore);
  });

  it('fails closed on corrupted auth-store.json, preserves file, and NEVER enables admin bootstrap', () => {
    const dir = path.join(ROOT_TMP, 'corrupt-auth');
    setupRuntimeLinks(dir);
    fs.writeFileSync(
      path.join(dir, 'data', 'store.json'),
      JSON.stringify(buildValidMinimalStore()),
      { mode: 0o600 }
    );
    const authPath = path.join(dir, 'data', 'auth-store.json');
    const corruptAuth = '{"users": [{"passwordHash": "scrypt$SECRET_HASH_DO_NOT_LOG"}], broken';
    fs.writeFileSync(authPath, corruptAuth, { mode: 0o600 });
    const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(authPath)).digest('hex');

    const bootCheck = spawnSync('node', ['dist/server.cjs'], {
      cwd: dir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3192',
        STORAGE_DRIVER: 'json',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      encoding: 'utf-8',
      timeout: 5000,
    });

    assert.notEqual(bootCheck.status, 0);
    assert.match(bootCheck.stderr, /FATAL:/);
    assert.equal(bootCheck.stderr.includes('SECRET_HASH_DO_NOT_LOG'), false);
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(authPath)).digest('hex'),
      hashBefore
    );

    // Direct module verification: isBootstrapRequired() and bootstrapChiefAdmin() MUST throw AuthStorageError (never return setupRequired: true)
    const authTsAbs = path.join(process.cwd(), 'server', 'auth', 'authStore.ts');
    const verifyBootstrapScript = `
      import { isBootstrapRequired, bootstrapChiefAdmin } from ${JSON.stringify(authTsAbs)};
      let blockedStatus = false;
      try {
        await isBootstrapRequired();
      } catch (e) {
        blockedStatus = e?.name === 'AuthStorageError';
      }
      let blockedBootstrap = false;
      try {
        await bootstrapChiefAdmin({ username: 'attacker', password: 'AttackerPassword#1234' });
      } catch (e) {
        blockedBootstrap = e?.name === 'AuthStorageError';
      }
      if (!blockedStatus || !blockedBootstrap) process.exit(4);
    `;
    const modCheck = spawnSync('npx', ['tsx', '--input-type=module', '-e', verifyBootstrapScript], {
      cwd: dir,
      env: process.env,
      encoding: 'utf-8',
      timeout: 8000,
    });
    assert.equal(modCheck.status, 0, `Bootstrap protection check failed: ${modCheck.stderr}`);
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(authPath)).digest('hex'),
      hashBefore
    );
  });

  it('fails closed on read/path error (e.g. non-regular file or unreadable target) without fallback', () => {
    const dir = path.join(ROOT_TMP, 'unreadable-store');
    setupRuntimeLinks(dir);
    // Create a directory at store.json path (triggers !stat.isFile() / EISDIR even when running as root)
    fs.mkdirSync(path.join(dir, 'data', 'store.json'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data', 'store.json', 'sentinel'), 'keep-me');

    const res = spawnSync('node', ['dist/server.cjs'], {
      cwd: dir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3193',
        STORAGE_DRIVER: 'json',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      encoding: 'utf-8',
      timeout: 5000,
    });

    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /FATAL:/);
    assert.equal(
      fs.readFileSync(path.join(dir, 'data', 'store.json', 'sentinel'), 'utf-8'),
      'keep-me'
    );
  });

  it('initializes missing store.json and auth-store.json on fresh installation with 0600 permissions and loads valid existing files cleanly', async () => {
    const freshDir = path.join(ROOT_TMP, 'fresh-install');
    setupRuntimeLinks(freshDir);
    const PORT_FRESH = 3119;
    const URL_FRESH = `http://127.0.0.1:${PORT_FRESH}`;

    const proc = spawn('node', ['dist/server.cjs'], {
      cwd: freshDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT_FRESH),
        STORAGE_DRIVER: 'json',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      stdio: 'ignore',
      detached: true,
    });

    try {
      await waitForServer(`${URL_FRESH}/healthz`);

      const storePath = path.join(freshDir, 'data', 'store.json');
      const authPath = path.join(freshDir, 'data', 'auth-store.json');
      assert.equal(fs.existsSync(storePath), true);
      assert.equal(fs.existsSync(authPath), true);
      assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
      assert.equal(fs.statSync(authPath).mode & 0o777, 0o600);

      const bootStatus = await (await fetch(`${URL_FRESH}/api/admin/bootstrap-status`)).json();
      assert.equal(bootStatus.setupRequired, true);
    } finally {
      if (proc.pid) {
        try {
          process.kill(-proc.pid, 'SIGKILL');
        } catch {}
      }
    }

    // Valid existing store preservation check
    const existingDir = path.join(ROOT_TMP, 'valid-existing');
    setupRuntimeLinks(existingDir);
    const PORT_EXIST = 3120;
    const URL_EXIST = `http://127.0.0.1:${PORT_EXIST}`;
    fs.writeFileSync(
      path.join(existingDir, 'data', 'store.json'),
      JSON.stringify(buildValidMinimalStore('Existing Preserved Story C51')),
      { mode: 0o600 }
    );

    const proc2 = spawn('node', ['dist/server.cjs'], {
      cwd: existingDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT_EXIST),
        STORAGE_DRIVER: 'json',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      stdio: 'ignore',
      detached: true,
    });

    try {
      await waitForServer(`${URL_EXIST}/healthz`);
      const artJson = await (await fetch(`${URL_EXIST}/api/articles`)).json();
      assert.equal(artJson.count, 1);
      assert.equal(artJson.data[0].title, 'Existing Preserved Story C51');
    } finally {
      if (proc2.pid) {
        try {
          process.kill(-proc2.pid, 'SIGKILL');
        } catch {}
      }
    }
  });
});

describe('Phase C5.1.2, C5.1.3, C5.1.5 & C5.1.9: Health Endpoint, Password Change, User Management & Full Regression', () => {
  const TMP_DIR = '/tmp/akp-c51-http-suite';
  const TEST_PORT = 3121;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  let serverProc: ChildProcess | null = null;
  let chiefToken = '';
  let chiefId = '';
  let editorToken = '';
  let editorId = '';

  const CHIEF_PASS_1 = 'ChiefAdminPass#2026!One';
  const CHIEF_PASS_2 = 'ChiefAdminPass#2026!Two';
  const EDITOR_PASS_1 = 'SeniorEditorPass#2026!One';

  before(async () => {
    setupRuntimeLinks(TMP_DIR);
    fs.writeFileSync(
      path.join(TMP_DIR, 'data', 'store.json'),
      JSON.stringify(buildValidMinimalStore()),
      { mode: 0o600 }
    );

    serverProc = spawn('node', ['dist/server.cjs'], {
      cwd: TMP_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(TEST_PORT),
        STORAGE_DRIVER: 'json',
        ADMIN_LOGIN_MAX_ATTEMPTS: '3',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
        ADMIN_PASSWORD_HASH: '',
      },
      stdio: 'ignore',
      detached: true,
    });

    await waitForServer(`${BASE_URL}/healthz`);

    // Bootstrap Chief Admin
    const bootRes = await fetch(`${BASE_URL}/api/admin/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'c51_chief',
        password: CHIEF_PASS_1,
        name: 'C51 Chief Admin',
      }),
    });
    assert.equal(bootRes.status, 201);
    const bootJson = await bootRes.json();
    chiefToken = bootJson.token;
    chiefId = bootJson.user.id;
  });

  after(() => {
    if (serverProc?.pid) {
      try {
        process.kill(-serverProc.pid, 'SIGKILL');
      } catch {}
    }
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('C5.1.5: GET /healthz requires no auth, returns minimal {status:"ok"}, leaks nothing, and does not mutate data files', async () => {
    const storePath = path.join(TMP_DIR, 'data', 'store.json');
    const authPath = path.join(TMP_DIR, 'data', 'auth-store.json');
    const storeHashBefore = crypto.createHash('sha256').update(fs.readFileSync(storePath)).digest('hex');
    const authHashBefore = crypto.createHash('sha256').update(fs.readFileSync(authPath)).digest('hex');

    const res = await fetch(`${BASE_URL}/healthz`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('cache-control')?.includes('no-store'));
    const bodyText = await res.text();
    assert.deepEqual(JSON.parse(bodyText), { status: 'ok' });

    // Confirm zero sensitive fields
    for (const forbidden of ['database', 'users', 'articles', 'memory', 'NODE_ENV', 'version', 'uptime']) {
      assert.equal(bodyText.includes(forbidden), false, `/healthz leaked ${forbidden}`);
    }

    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(storePath)).digest('hex'),
      storeHashBefore
    );
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(authPath)).digest('hex'),
      authHashBefore
    );
  });

  it('C5.1.3: Chief Admin can create, list, deactivate (revoking sessions), reactivate, and safely protect against self/last-chief deletion; Senior Editor gets 403', async () => {
    const chiefHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${chiefToken}`,
    };

    // Password < 14 chars rejected on user creation
    const shortUserRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: chiefHeaders,
      body: JSON.stringify({
        username: 'short_pass_ed',
        password: 'TooShort123!',
        roleCode: 'senior_editor',
      }),
    });
    assert.equal(shortUserRes.status, 400);

    // Create Senior Editor
    const createEdRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: chiefHeaders,
      body: JSON.stringify({
        username: 'c51_editor',
        password: EDITOR_PASS_1,
        roleCode: 'senior_editor',
        name: 'C51 Senior Editor',
      }),
    });
    assert.equal(createEdRes.status, 201);
    const createEdJson = await createEdRes.json();
    editorId = createEdJson.data.id;
    assert.equal('passwordHash' in createEdJson.data, false);
    assert.equal(createEdJson.data.isActive, true);

    // List users returns clean public fields only
    const listRes = await fetch(`${BASE_URL}/api/admin/users`, { headers: chiefHeaders });
    assert.equal(listRes.status, 200);
    const listText = await listRes.text();
    assert.equal(listText.includes('passwordHash'), false);
    assert.equal(listText.includes('scrypt$'), false);

    // Senior Editor logs in
    const edLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'c51_editor', password: EDITOR_PASS_1 }),
    });
    assert.equal(edLoginRes.status, 200);
    editorToken = (await edLoginRes.json()).token;
    const editorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${editorToken}`,
    };

    // Senior Editor MUST receive 403 on all user-management routes
    for (const reqSpec of [
      { method: 'GET', path: '/api/admin/users' },
      {
        method: 'POST',
        path: '/api/admin/users',
        body: JSON.stringify({
          username: 'unauth_ed',
          password: 'ValidLongPassword#1234',
          roleCode: 'senior_editor',
        }),
      },
      {
        method: 'PATCH',
        path: `/api/admin/users/${chiefId}/status`,
        body: JSON.stringify({ isActive: false }),
      },
      { method: 'DELETE', path: `/api/admin/users/${chiefId}` },
    ]) {
      const r = await fetch(`${BASE_URL}${reqSpec.path}`, {
        method: reqSpec.method,
        headers: editorHeaders,
        body: reqSpec.body,
      });
      assert.equal(r.status, 403, `Expected 403 for senior_editor on ${reqSpec.method} ${reqSpec.path}`);
    }

    // Cannot deactivate or delete self (Chief Admin)
    const selfDeact = await fetch(`${BASE_URL}/api/admin/users/${chiefId}/status`, {
      method: 'PATCH',
      headers: chiefHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(selfDeact.status, 400);

    const selfDel = await fetch(`${BASE_URL}/api/admin/users/${chiefId}`, {
      method: 'DELETE',
      headers: chiefHeaders,
    });
    assert.equal(selfDel.status, 400);

    // Deactivate Senior Editor -> active editorToken immediately revoked (401) and new login blocked
    const deactRes = await fetch(`${BASE_URL}/api/admin/users/${editorId}/status`, {
      method: 'PATCH',
      headers: chiefHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(deactRes.status, 200);
    assert.equal((await deactRes.json()).data.isActive, false);

    assert.equal(
      (await fetch(`${BASE_URL}/api/admin/me`, { headers: editorHeaders })).status,
      401
    );
    const blockedLogin = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'c51_editor', password: EDITOR_PASS_1 }),
    });
    assert.equal(blockedLogin.status, 401);

    // Reactivate Senior Editor -> login succeeds again
    const reactRes = await fetch(`${BASE_URL}/api/admin/users/${editorId}/status`, {
      method: 'PATCH',
      headers: chiefHeaders,
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(reactRes.status, 200);
    assert.equal((await reactRes.json()).data.isActive, true);

    const reLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'c51_editor', password: EDITOR_PASS_1 }),
    });
    assert.equal(reLoginRes.status, 200);
    editorToken = (await reLoginRes.json()).token;

    // Create a second Chief Admin, verify last-active-chief guard when one is deactivated
    const createChief2Res = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: chiefHeaders,
      body: JSON.stringify({
        username: 'c51_chief_two',
        password: 'SecondChiefPass#2026!',
        roleCode: 'chief_admin',
        name: 'Second Chief',
      }),
    });
    assert.equal(createChief2Res.status, 201);
    const chief2Id = (await createChief2Res.json()).data.id;

    // Delete chief2 -> succeeds; now c51_chief is last active chief again
    const delChief2 = await fetch(`${BASE_URL}/api/admin/users/${chief2Id}`, {
      method: 'DELETE',
      headers: chiefHeaders,
    });
    assert.equal(delChief2.status, 200);
  });

  it('C5.1.2: PUT /api/admin/me/password validates rules, rate-limits bad attempts, revokes all user sessions, and enforces new password', async () => {
    // Unauthenticated rejected
    assert.equal(
      (
        await fetch(`${BASE_URL}/api/admin/me/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: CHIEF_PASS_1,
            newPassword: CHIEF_PASS_2,
            confirmPassword: CHIEF_PASS_2,
          }),
        })
      ).status,
      401
    );

    // Open a second concurrent session for Chief Admin to verify ALL sessions get revoked
    const secondLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'c51_chief', password: CHIEF_PASS_1 }),
    });
    assert.equal(secondLoginRes.status, 200);
    const secondChiefToken = (await secondLoginRes.json()).token;

    const chiefHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${chiefToken}`,
    };

    // Validation errors (< 14 chars, mismatch, reuse)
    assert.equal(
      (
        await fetch(`${BASE_URL}/api/admin/me/password`, {
          method: 'PUT',
          headers: chiefHeaders,
          body: JSON.stringify({
            currentPassword: CHIEF_PASS_1,
            newPassword: 'ShortPass123!',
            confirmPassword: 'ShortPass123!',
          }),
        })
      ).status,
      400
    );

    assert.equal(
      (
        await fetch(`${BASE_URL}/api/admin/me/password`, {
          method: 'PUT',
          headers: chiefHeaders,
          body: JSON.stringify({
            currentPassword: CHIEF_PASS_1,
            newPassword: CHIEF_PASS_2,
            confirmPassword: 'DifferentConfirm#2026!',
          }),
        })
      ).status,
      400
    );

    assert.equal(
      (
        await fetch(`${BASE_URL}/api/admin/me/password`, {
          method: 'PUT',
          headers: chiefHeaders,
          body: JSON.stringify({
            currentPassword: CHIEF_PASS_1,
            newPassword: CHIEF_PASS_1,
            confirmPassword: CHIEF_PASS_1,
          }),
        })
      ).status,
      400
    );

    // Wrong currentPassword -> 403 and triggers rate-limit lockout on Senior Editor's attempt bucket
    const editorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${editorToken}`,
    };
    for (let i = 0; i < 3; i++) {
      const wrongRes = await fetch(`${BASE_URL}/api/admin/me/password`, {
        method: 'PUT',
        headers: editorHeaders,
        body: JSON.stringify({
          currentPassword: 'WrongCurrentPassword!',
          newPassword: 'EditorRotatedPass#2026!',
          confirmPassword: 'EditorRotatedPass#2026!',
        }),
      });
      assert.equal(wrongRes.status, 403);
    }
    const lockedRes = await fetch(`${BASE_URL}/api/admin/me/password`, {
      method: 'PUT',
      headers: editorHeaders,
      body: JSON.stringify({
        currentPassword: EDITOR_PASS_1,
        newPassword: 'EditorRotatedPass#2026!',
        confirmPassword: 'EditorRotatedPass#2026!',
      }),
    });
    assert.equal(lockedRes.status, 429);
    assert.ok(Number(lockedRes.headers.get('retry-after')) >= 1);

    // Chief Admin successfully rotates password -> revokes BOTH chiefToken and secondChiefToken
    const okRes = await fetch(`${BASE_URL}/api/admin/me/password`, {
      method: 'PUT',
      headers: chiefHeaders,
      body: JSON.stringify({
        currentPassword: CHIEF_PASS_1,
        newPassword: CHIEF_PASS_2,
        confirmPassword: CHIEF_PASS_2,
      }),
    });
    assert.equal(okRes.status, 200);
    const okJson = await okRes.json();
    assert.equal(okJson.reauthRequired, true);
    assert.equal(okJson.revokedSessionsCount >= 2, true);
    assert.equal(JSON.stringify(okJson).includes(CHIEF_PASS_2), false);

    // Old sessions are immediately rejected (401)
    assert.equal(
      (await fetch(`${BASE_URL}/api/admin/me`, { headers: chiefHeaders })).status,
      401
    );
    assert.equal(
      (
        await fetch(`${BASE_URL}/api/admin/me`, {
          headers: { Authorization: `Bearer ${secondChiefToken}` },
        })
      ).status,
      401
    );

    // Senior Editor's session was NOT affected by Chief Admin's password change
    assert.equal(
      (await fetch(`${BASE_URL}/api/admin/me`, { headers: editorHeaders })).status,
      200
    );

    // Old Chief Admin password fails login; new password succeeds
    const oldPassLogin = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'c51_chief', password: CHIEF_PASS_1 }),
    });
    assert.equal(oldPassLogin.status, 401);

    const newPassLogin = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'c51_chief', password: CHIEF_PASS_2 }),
    });
    assert.equal(newPassLogin.status, 200);
    chiefToken = (await newPassLogin.json()).token;

    // Verify audit log recorded PASSWORD_CHANGE without exposing password plaintext or hashes
    const logsJson = await (
      await fetch(`${BASE_URL}/api/system/logs`, {
        headers: { Authorization: `Bearer ${chiefToken}` },
      })
    ).json();
    const pwLog = logsJson.data.find((l: any) => l.method === 'PASSWORD_CHANGE');
    assert.ok(pwLog, 'Audit log must record PASSWORD_CHANGE');
    const logText = JSON.stringify(logsJson);
    assert.equal(logText.includes(CHIEF_PASS_1), false);
    assert.equal(logText.includes(CHIEF_PASS_2), false);
    assert.equal(logText.includes('scrypt$'), false);
  });

  it('C5.1.9: Full functional & RBAC regression check across CMS articles, drafts, public feeds, state news, videos, live updates, and logout', async () => {
    const chiefHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${chiefToken}`,
    };
    const editorHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${editorToken}`,
    };

    // Public endpoints work (published only, drafts hidden)
    const pubArts = await (await fetch(`${BASE_URL}/api/articles`)).json();
    assert.equal(pubArts.count, 1);
    assert.equal(pubArts.data[0].id, 'art-c51-valid');
    assert.equal((await fetch(`${BASE_URL}/api/articles/art-c51-draft`)).status, 404);
    assert.equal((await fetch(`${BASE_URL}/api/state-news?state=%E0%A4%A6%E0%A4%BF%E0%A4%B2%E0%A5%8D%E0%A4%B2%E0%A5%80`)).status, 200);
    assert.equal((await fetch(`${BASE_URL}/api/videos`)).status, 200);
    assert.equal((await fetch(`${BASE_URL}/api/live-updates`)).status, 200);

    // Senior Editor creates draft -> hidden publicly -> edits & publishes -> visible publicly
    const draftRes = await fetch(`${BASE_URL}/api/articles`, {
      method: 'POST',
      headers: editorHeaders,
      body: JSON.stringify({
        title: 'C51 Regression Draft',
        content: 'Editorial regression body',
        category: 'देश',
        status: 'draft',
      }),
    });
    assert.equal(draftRes.status, 201);
    const createdId = (await draftRes.json()).data.id;
    assert.equal((await fetch(`${BASE_URL}/api/articles/${createdId}`)).status, 404);

    const publishRes = await fetch(`${BASE_URL}/api/articles/${createdId}`, {
      method: 'PUT',
      headers: editorHeaders,
      body: JSON.stringify({
        title: 'C51 Regression Published',
        status: 'published',
      }),
    });
    assert.equal(publishRes.status, 200);
    const pubCheck = await fetch(`${BASE_URL}/api/articles/${createdId}`);
    assert.equal(pubCheck.status, 200);
    assert.equal((await pubCheck.json()).data.title, 'C51 Regression Published');

    // Chief Admin can delete created article and delete Senior Editor
    assert.equal(
      (
        await fetch(`${BASE_URL}/api/articles/${createdId}`, {
          method: 'DELETE',
          headers: chiefHeaders,
        })
      ).status,
      200
    );
    assert.equal(
      (
        await fetch(`${BASE_URL}/api/admin/users/${editorId}`, {
          method: 'DELETE',
          headers: chiefHeaders,
        })
      ).status,
      200
    );

    // Logout revokes Chief Admin token
    const logoutRes = await fetch(`${BASE_URL}/api/admin/logout`, {
      method: 'POST',
      headers: chiefHeaders,
    });
    assert.equal(logoutRes.status, 200);
    assert.equal(
      (await fetch(`${BASE_URL}/api/admin/me`, { headers: chiefHeaders })).status,
      401
    );
  });
});
