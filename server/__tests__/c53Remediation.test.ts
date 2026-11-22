import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

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

function buildMinimalStore() {
  return {
    articles: [
      {
        id: 'art-c53-1',
        title: 'प्रारंभिक राष्ट्रीय समाचार',
        slug: 'initial-national-story',
        summary: 'Initial summary',
        content: 'Initial full content for testing.',
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
        tags: ['c53'],
        status: 'published',
        location: 'नई दिल्ली',
      },
      {
        id: 'art-c53-2',
        title: 'द्वितीय शहर समाचार',
        slug: 'second-city-story',
        summary: 'Second summary',
        content: 'Second full content for testing.',
        category: 'शहर',
        author: {
          name: 'अनामिका सिंह',
          role: 'संवाददाता',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
        },
        publishedAt: '2026-10-01T09:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800',
        isBreaking: false,
        isFeatured: false,
        tags: ['c53'],
        status: 'published',
        location: 'मुंबई',
      },
    ],
    stateNews: {
      दिल्ली: [
        {
          id: 'st-c53-del-1',
          state: 'दिल्ली',
          city: 'नई दिल्ली',
          title: 'दिल्ली मुख्य खबर',
          summary: 'Summary 1',
          content: 'Content 1',
          imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800',
          publishedAt: '2026-10-01T10:00:00Z',
          reporter: 'दिल्ली ब्यूरो',
          readTime: '2 मिनट',
          tags: ['दिल्ली'],
          isHeadline: true,
        },
        {
          id: 'st-c53-del-2',
          state: 'दिल्ली',
          city: 'द्वारका',
          title: 'दिल्ली दूसरी खबर',
          summary: 'Summary 2',
          content: 'Content 2',
          imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800',
          publishedAt: '2026-10-01T09:00:00Z',
          reporter: 'दिल्ली ब्यूरो',
          readTime: '2 मिनट',
          tags: ['दिल्ली'],
          isHeadline: false,
        },
      ],
      महाराष्ट्र: [],
      'उत्तर प्रदेश': [],
      बिहार: [
        {
          id: 'st-c53-bih-1',
          state: 'बिहार',
          city: 'पटना',
          title: 'बिहार पुरानी हेडलाइन',
          summary: 'Bihar headline summary',
          content: 'Bihar content',
          imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800',
          publishedAt: '2026-10-01T08:00:00Z',
          reporter: 'पटना ब्यूरो',
          readTime: '2 मिनट',
          tags: ['बिहार'],
          isHeadline: true,
        },
      ],
      पंजाब: [],
    },
    videos: [
      {
        id: 'vid-c53-1',
        title: 'प्राइम बुलेटिन C53',
        description: 'Bulletin description',
        thumbnailUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800',
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        duration: '04:00',
        category: 'विशेष बुलेटिन',
        publishedAt: 'अभी-अभी',
        anchor: 'प्रहरी एंकर',
        tag: 'विशेष',
        isLive: false,
      },
    ],
    editors: [
      {
        id: 'ed-c53-1',
        name: 'संपादक एक',
        role: 'वरिष्ठ संपादक',
        showName: 'प्राइम शो',
        imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
        bio: 'अनुभवी पत्रकार',
        twitter: '@akpnews',
        experience: '15 वर्ष',
      },
    ],
    liveUpdates: [],
    logs: [],
    lastSavedAt: '2026-10-01T10:00:00Z',
  };
}

function startProdServer(
  cwd: string,
  port: number,
  extraEnv: Record<string, string> = {}
): { proc: ChildProcess; logs: () => string } {
  let output = '';
  const proc = spawn('node', ['dist/server.cjs'], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      STORAGE_DRIVER: 'json',
      ADMIN_USERNAME: 'c53chief',
      ADMIN_PASSWORD: 'ChiefAdmin!Strong#2026',
      EDITOR_USERNAME: 'c53editor',
      EDITOR_PASSWORD: 'SeniorEditor!Strong#2026',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => {
    output += d.toString();
  });
  proc.stderr?.on('data', (d) => {
    output += d.toString();
  });
  return { proc, logs: () => output };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  return json.token;
}

describe('Phase C5.3: Deployment-Blocker Remediation', () => {
  const ROOT_TMP = '/tmp/akp-c53-remediation';

  before(() => {
    fs.rmSync(ROOT_TMP, { recursive: true, force: true });
    fs.mkdirSync(ROOT_TMP, { recursive: true });
  });

  after(() => {
    fs.rmSync(ROOT_TMP, { recursive: true, force: true });
  });

  it('persists editorial writes synchronously before response so immediate SIGKILL cannot lose data', async () => {
    const dir = path.join(ROOT_TMP, 'sigkill-durability');
    setupRuntimeLinks(dir);
    fs.writeFileSync(path.join(dir, 'data', 'store.json'), JSON.stringify(buildMinimalStore(), null, 2), {
      mode: 0o600,
    });

    const port = 3211;
    const baseUrl = `http://127.0.0.1:${port}`;
    const s1 = startProdServer(dir, port);

    try {
      await waitForServer(`${baseUrl}/healthz`);
      const token = await login(baseUrl, 'c53chief', 'ChiefAdmin!Strong#2026');

      const createRes = await fetch(`${baseUrl}/api/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'तत्काल SIGKILL सुरक्षा परीक्षण लेख',
          content: 'Crash durability test content saved synchronously before HTTP 201.',
          category: 'देश',
          status: 'published',
        }),
      });
      assert.equal(createRes.status, 201);
      const created = await createRes.json();

      // Kill process immediately (<5ms) without graceful flush
      s1.proc.kill('SIGKILL');
      await new Promise((r) => s1.proc.once('exit', r));

      // Verify disk store already has the article
      const diskStore = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'store.json'), 'utf8'));
      assert.equal(
        diskStore.articles.some((a: any) => a.id === created.data.id),
        true,
        'Created article must exist on disk immediately after HTTP 201 even on SIGKILL'
      );

      // Restart fresh server and verify API returns the article
      const s2 = startProdServer(dir, port);
      try {
        await waitForServer(`${baseUrl}/healthz`);
        const getRes = await fetch(`${baseUrl}/api/articles/${created.data.id}`);
        assert.equal(getRes.status, 200);
        const getJson = await getRes.json();
        assert.equal(getJson.data.title, 'तत्काल SIGKILL सुरक्षा परीक्षण लेख');
      } finally {
        s2.proc.kill('SIGTERM');
        await new Promise((r) => s2.proc.once('exit', r));
      }
    } finally {
      if (s1.proc.exitCode === null) {
        s1.proc.kill('SIGKILL');
      }
    }
  });

  it('prevents duplicate articles, enforces unique slugs, supports cross-state moves, and provides PUT /api/videos/:id & PUT /api/editors/:id with RBAC', async () => {
    const dir = path.join(ROOT_TMP, 'integrity-and-crud');
    setupRuntimeLinks(dir);
    fs.writeFileSync(path.join(dir, 'data', 'store.json'), JSON.stringify(buildMinimalStore(), null, 2), {
      mode: 0o600,
    });

    const port = 3212;
    const baseUrl = `http://127.0.0.1:${port}`;
    const s1 = startProdServer(dir, port);

    try {
      await waitForServer(`${baseUrl}/healthz`);
      const chiefToken = await login(baseUrl, 'c53chief', 'ChiefAdmin!Strong#2026');
      const editorToken = await login(baseUrl, 'c53editor', 'SeniorEditor!Strong#2026');

      // 1. Duplicate title in same category -> 409
      const dupSameCat = await fetch(`${baseUrl}/api/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chiefToken}`,
        },
        body: JSON.stringify({
          title: '  प्रारंभिक   राष्ट्रीय समाचार  ',
          content: 'Duplicate attempt',
          category: 'देश',
          status: 'published',
        }),
      });
      assert.equal(dupSameCat.status, 409);

      // 2. Explicit duplicate slug -> 409
      const dupSlug = await fetch(`${baseUrl}/api/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chiefToken}`,
        },
        body: JSON.stringify({
          title: 'बिल्कुल नया शीर्षक',
          slug: 'initial-national-story',
          content: 'Slug collision test',
          category: 'देश',
          status: 'published',
        }),
      });
      assert.equal(dupSlug.status, 409);

      // 3. Same title in different category -> auto-deduplicated unique slug (-2)
      const sameTitleDiffCat = await fetch(`${baseUrl}/api/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chiefToken}`,
        },
        body: JSON.stringify({
          title: 'Unique Cross Category Story',
          content: 'First category body',
          category: 'देश',
          status: 'published',
        }),
      });
      assert.equal(sameTitleDiffCat.status, 201);
      const firstJson = await sameTitleDiffCat.json();
      assert.equal(firstJson.data.slug, 'unique-cross-category-story');

      const secondCat = await fetch(`${baseUrl}/api/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chiefToken}`,
        },
        body: JSON.stringify({
          title: 'Unique Cross Category Story',
          content: 'Second category body',
          category: 'तकनीक',
          status: 'published',
        }),
      });
      assert.equal(secondCat.status, 201);
      const secondJson = await secondCat.json();
      assert.equal(secondJson.data.slug, 'unique-cross-category-story-2');

      // 4. PUT /api/articles/:id colliding with art-c53-1 slug -> 409
      const putCollision = await fetch(`${baseUrl}/api/articles/art-c53-2`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chiefToken}`,
        },
        body: JSON.stringify({
          slug: 'initial-national-story',
        }),
      });
      assert.equal(putCollision.status, 409);

      // 5. State News PUT: cross-state move + single isHeadline enforcement
      const moveRes = await fetch(`${baseUrl}/api/state-news/st-c53-del-2`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({
          state: 'बिहार',
          city: 'गया',
          title: 'बिहार स्थानांतरित प्रमुख खबर',
          isHeadline: true,
        }),
      });
      assert.equal(moveRes.status, 200);
      const movedJson = await moveRes.json();
      assert.equal(movedJson.data.state, 'बिहार');
      assert.equal(movedJson.data.isHeadline, true);

      const delList = await (await fetch(`${baseUrl}/api/state-news?state=${encodeURIComponent('दिल्ली')}`)).json();
      assert.equal(
        delList.data.some((i: any) => i.id === 'st-c53-del-2'),
        false,
        'Moved item must no longer be in source state'
      );

      const bihList = await (await fetch(`${baseUrl}/api/state-news?state=${encodeURIComponent('बिहार')}`)).json();
      const movedInBihar = bihList.data.find((i: any) => i.id === 'st-c53-del-2');
      const oldBiharHeadline = bihList.data.find((i: any) => i.id === 'st-c53-bih-1');
      assert.equal(movedInBihar?.isHeadline, true);
      assert.equal(oldBiharHeadline?.isHeadline, false, 'Previous headline in target state must be demoted');

      // 6. PUT /api/videos/:id (Senior Editor allowed, unauth rejected, 404 on missing)
      const vidUnauth = await fetch(`${baseUrl}/api/videos/vid-c53-1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Edit' }),
      });
      assert.equal(vidUnauth.status, 401);

      const vidEdit = await fetch(`${baseUrl}/api/videos/vid-c53-1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({
          title: 'अपडेटेड प्राइम बुलेटिन C53',
          isLive: true,
        }),
      });
      assert.equal(vidEdit.status, 200);
      const vidJson = await vidEdit.json();
      assert.equal(vidJson.data.title, 'अपडेटेड प्राइम बुलेटिन C53');
      assert.equal(vidJson.data.isLive, true);

      // 7. PUT /api/editors/:id (Senior Editor 403, Chief Admin 200)
      const edForbidden = await fetch(`${baseUrl}/api/editors/ed-c53-1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({ name: 'Should Be Forbidden' }),
      });
      assert.equal(edForbidden.status, 403);

      const edUpdate = await fetch(`${baseUrl}/api/editors/ed-c53-1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chiefToken}`,
        },
        body: JSON.stringify({
          name: 'अद्यतन संपादक एक',
          experience: '20+ वर्ष',
        }),
      });
      assert.equal(edUpdate.status, 200);
      const edJson = await edUpdate.json();
      assert.equal(edJson.data.name, 'अद्यतन संपादक एक');
    } finally {
      s1.proc.kill('SIGTERM');
      await new Promise((r) => s1.proc.once('exit', r));
    }
  });

  it('supports external DATA_DIR and exits promptly on SIGTERM even with idle HTTP keep-alive sockets', async () => {
    const dir = path.join(ROOT_TMP, 'data-dir-and-shutdown');
    const customDataDir = path.join(ROOT_TMP, 'external-persistent-volume');
    setupRuntimeLinks(dir);
    fs.rmSync(customDataDir, { recursive: true, force: true });
    fs.mkdirSync(customDataDir, { recursive: true });
    fs.writeFileSync(path.join(customDataDir, 'store.json'), JSON.stringify(buildMinimalStore(), null, 2), {
      mode: 0o600,
    });

    const port = 3213;
    const baseUrl = `http://127.0.0.1:${port}`;
    const s1 = startProdServer(dir, port, {
      DATA_DIR: customDataDir,
      TRUST_PROXY: '1',
    });

    let agent: http.Agent | null = null;
    try {
      await waitForServer(`${baseUrl}/healthz`);

      // Auth store and data store should resolve inside customDataDir, NOT <cwd>/data/
      assert.equal(fs.existsSync(path.join(customDataDir, 'auth-store.json')), true);
      assert.equal(fs.existsSync(path.join(dir, 'data', 'auth-store.json')), false);

      // Hold open an idle HTTP keep-alive socket against the server
      agent = new http.Agent({ keepAlive: true });
      await new Promise<void>((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/healthz', agent: agent! }, (res) => {
          res.resume();
          res.on('end', resolve);
        });
        req.on('error', reject);
      });

      const t0 = Date.now();
      s1.proc.kill('SIGTERM');
      const exitCode = await new Promise<number | null>((resolve) => {
        s1.proc.once('exit', (code) => resolve(code));
      });
      const elapsedMs = Date.now() - t0;

      assert.equal(exitCode, 0, 'Graceful SIGTERM shutdown must exit with code 0');
      assert.equal(
        elapsedMs < 3000,
        true,
        `Shutdown with open keep-alive socket took too long (${elapsedMs}ms)`
      );
    } finally {
      agent?.destroy();
      if (s1.proc.exitCode === null) {
        s1.proc.kill('SIGKILL');
      }
    }
  });
});
