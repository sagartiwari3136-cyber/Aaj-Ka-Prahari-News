import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  isArticlePubliclyVisible,
  filterPublicArticles,
  findPublicArticleByIdOrSlug,
  filterPublicLiveUpdates,
} from '../utils/articleVisibility';

describe('articleVisibility unit helpers (fail-closed)', () => {
  const nowMs = Date.parse('2026-11-21T12:00:00Z');

  it('allows explicitly published articles with past or current publishedAt', () => {
    assert.equal(
      isArticlePubliclyVisible(
        { id: 'pub-1', status: 'published', publishedAt: '2026-11-20T12:00:00Z' },
        nowMs
      ),
      true
    );
    assert.equal(
      isArticlePubliclyVisible(
        { id: 'pub-exact', status: 'published', publishedAt: '2026-11-21T12:00:00Z' },
        nowMs
      ),
      true
    );
  });

  it('rejects draft, archived, scheduled, unpublished, private, unknown, missing statuses, and invalid/missing/future publishedAt', () => {
    const hiddenCases: any[] = [
      { id: 'd-1', status: 'draft', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'a-1', status: 'archived', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 's-1', status: 'scheduled', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'u-1', status: 'unpublished', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'p-1', status: 'private', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'x-1', status: 'unknown_state', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'm-1', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'm-2', status: null, publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'm-3', status: '', publishedAt: '2026-11-20T12:00:00Z' },
      { id: 'f-1', status: 'published', publishedAt: '2026-12-01T00:00:00Z' }, // future scheduled
      { id: 'bad-d1', status: 'published' }, // missing publishedAt
      { id: 'bad-d2', status: 'published', publishedAt: null },
      { id: 'bad-d3', status: 'published', publishedAt: '' },
      { id: 'bad-d4', status: 'published', publishedAt: '   ' },
      { id: 'bad-d5', status: 'published', publishedAt: 'not-a-date' },
      { id: 'bad-d6', status: 'published', publishedAt: '2026-13-45' },
      null,
      undefined,
    ];

    for (const item of hiddenCases) {
      assert.equal(isArticlePubliclyVisible(item, nowMs), false);
    }
  });

  it('filters lists and detail lookups strictly before returning results', () => {
    const fixtures: any[] = [
      { id: 'pub-1', slug: 'pub-one', status: 'published', publishedAt: '2026-11-20T10:00:00Z' },
      { id: 'draft-1', slug: 'draft-one', status: 'draft', publishedAt: '2026-11-20T10:00:00Z' },
      { id: 'arch-1', slug: 'arch-one', status: 'archived', publishedAt: '2026-11-20T10:00:00Z' },
      { id: 'sched-1', slug: 'sched-one', status: 'published', publishedAt: '2099-01-01T00:00:00Z' },
      { id: 'malformed-1', slug: 'malformed-one', status: 'published', publishedAt: 'invalid-date' },
      { id: 'missing-dt-1', slug: 'missing-dt-one', status: 'published' },
    ];

    const visible = filterPublicArticles(fixtures, nowMs);
    assert.deepEqual(
      visible.map((a) => a.id),
      ['pub-1']
    );

    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'pub-1', nowMs)?.id, 'pub-1');
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'pub-one', nowMs)?.id, 'pub-1');
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'draft-1', nowMs), null);
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'draft-one', nowMs), null);
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'arch-1', nowMs), null);
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'sched-1', nowMs), null);
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'malformed-1', nowMs), null);
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'missing-dt-1', nowMs), null);
    assert.equal(findPublicArticleByIdOrSlug(fixtures, 'missing-id', nowMs), null);
  });

  it('hides live updates linked to non-public or deleted/orphaned articles (fail-closed)', () => {
    const articles: any[] = [
      { id: 'pub-1', status: 'published', publishedAt: '2026-11-20T10:00:00Z' },
      { id: 'draft-1', status: 'draft', publishedAt: '2026-11-20T10:00:00Z' },
      { id: 'bad-date-1', status: 'published', publishedAt: 'not-a-date' },
    ];
    const updates: any[] = [
      { id: 'u1', title: 'Public breaking', linkArticleId: 'pub-1' },
      { id: 'u2', title: 'Secret draft breaking', linkArticleId: 'draft-1' },
      { id: 'u3', title: 'Standalone ticker' },
      { id: 'u4', title: 'Empty link ticker', linkArticleId: '   ' },
      { id: 'u5', title: 'Orphaned deleted link', linkArticleId: 'deleted-art-999' },
      { id: 'u6', title: 'Bad-date linked article', linkArticleId: 'bad-date-1' },
    ];
    const filtered = filterPublicLiveUpdates(updates, articles, nowMs);
    assert.deepEqual(
      filtered.map((u) => u.id),
      ['u1', 'u3', 'u4']
    );
  });
});

describe('HTTP API Public Draft Protection & Admin Regression (isolated temp server)', () => {
  const TMP_DIR = '/tmp/akp-c42-visibility-test';
  const TEST_PORT = 3112;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  let serverProc: ChildProcess | null = null;
  let adminToken = '';

  async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(url);
        if (res.status > 0) return;
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Server did not respond in time at ${url}`);
  }

  before(async () => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.join(TMP_DIR, 'data'), { recursive: true });
    fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(TMP_DIR, 'node_modules'));
    fs.symlinkSync(path.join(process.cwd(), 'dist'), path.join(TMP_DIR, 'dist'));
    fs.symlinkSync(path.join(process.cwd(), 'package.json'), path.join(TMP_DIR, 'package.json'));

    const fixtureArticles = [
      {
        id: 'pub-art-1',
        title: 'सार्वजनिक प्रकाशित समाचार 1',
        slug: 'public-news-1',
        summary: 'Published summary 1',
        content: 'Full published body 1',
        category: 'देश',
        author: { name: 'राजेश शर्मा', role: 'संपादक', avatar: 'https://example.com/a.jpg' },
        publishedAt: '2026-08-20T10:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/p1.jpg',
        isBreaking: true,
        isFeatured: true,
        tags: ['visibility-test', 'देश'],
        status: 'published',
        location: 'नई दिल्ली',
      },
      {
        id: 'pub-art-2',
        title: 'सार्वजनिक प्रकाशित समाचार 2',
        slug: 'public-news-2',
        summary: 'Published summary 2',
        content: 'Full published body 2',
        category: 'देश',
        author: { name: 'अनामिका सिंह', role: 'संवाददाता', avatar: 'https://example.com/b.jpg' },
        publishedAt: '2026-08-19T10:00:00Z',
        readTime: '3 मिनट',
        imageUrl: 'https://example.com/p2.jpg',
        isBreaking: false,
        isFeatured: false,
        tags: ['visibility-test'],
        status: 'published',
        location: 'लखनऊ',
      },
      {
        id: 'draft-art-1',
        title: 'SECRET_DRAFT_HEADLINE',
        slug: 'secret-draft-slug',
        summary: 'SECRET_DRAFT_SUMMARY',
        content: 'SECRET_DRAFT_CONTENT_TOKEN',
        category: 'देश',
        author: { name: 'Draft Author', role: 'Editor', avatar: 'https://example.com/d.jpg' },
        publishedAt: '2026-08-21T10:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/draft.jpg',
        isBreaking: true,
        isFeatured: true,
        tags: ['visibility-test', 'secret-tag'],
        status: 'draft',
        location: 'मुंबई',
      },
      {
        id: 'arch-art-1',
        title: 'SECRET_ARCHIVED_HEADLINE',
        slug: 'secret-archived-slug',
        summary: 'SECRET_ARCHIVED_SUMMARY',
        content: 'SECRET_ARCHIVED_CONTENT_TOKEN',
        category: 'देश',
        author: { name: 'Archived Author', role: 'Editor', avatar: 'https://example.com/arch.jpg' },
        publishedAt: '2026-08-21T09:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/arch.jpg',
        isBreaking: true,
        isFeatured: true,
        tags: ['visibility-test', 'secret-tag'],
        status: 'archived',
        location: 'पटना',
      },
      {
        id: 'sched-status-art',
        title: 'SECRET_SCHEDULED_STATUS',
        slug: 'secret-scheduled-status',
        summary: 'SECRET_SCHEDULED_SUMMARY',
        content: 'SECRET_SCHEDULED_CONTENT',
        category: 'देश',
        author: { name: 'Sched Author', role: 'Editor', avatar: 'https://example.com/s.jpg' },
        publishedAt: '2026-08-21T08:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/sched.jpg',
        isBreaking: true,
        isFeatured: true,
        tags: ['visibility-test'],
        status: 'scheduled',
      },
      {
        id: 'sched-future-art',
        title: 'SECRET_FUTURE_DATED',
        slug: 'secret-future-dated',
        summary: 'SECRET_FUTURE_SUMMARY',
        content: 'SECRET_FUTURE_CONTENT',
        category: 'देश',
        author: { name: 'Future Author', role: 'Editor', avatar: 'https://example.com/f.jpg' },
        publishedAt: '2099-01-01T00:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/future.jpg',
        isBreaking: true,
        isFeatured: true,
        tags: ['visibility-test'],
        status: 'published',
      },
      {
        id: 'unpub-art-1',
        title: 'SECRET_UNPUBLISHED',
        slug: 'secret-unpublished',
        summary: 'SECRET_UNPUBLISHED_SUMMARY',
        content: 'SECRET_UNPUBLISHED_CONTENT',
        category: 'देश',
        author: { name: 'Unpub Author', role: 'Editor', avatar: 'https://example.com/u.jpg' },
        publishedAt: '2026-08-21T07:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/u.jpg',
        isBreaking: false,
        isFeatured: false,
        tags: ['visibility-test'],
        status: 'unpublished',
      },
      {
        id: 'missing-status-art',
        title: 'SECRET_MISSING_STATUS',
        slug: 'secret-missing-status',
        summary: 'SECRET_MISSING_SUMMARY',
        content: 'SECRET_MISSING_CONTENT',
        category: 'देश',
        author: { name: 'Missing Status Author', role: 'Editor', avatar: 'https://example.com/m.jpg' },
        publishedAt: '2026-08-21T06:00:00Z',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/m.jpg',
        isBreaking: false,
        isFeatured: false,
        tags: ['visibility-test'],
      },
      {
        id: 'missing-date-pub',
        title: 'SECRET_MISSING_DATE_PUB',
        slug: 'secret-missing-date-pub',
        summary: 'SECRET_MISSING_DATE_SUMMARY',
        content: 'SECRET_MISSING_DATE_CONTENT',
        category: 'देश',
        author: { name: 'Missing Date Author', role: 'Editor', avatar: 'https://example.com/md.jpg' },
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/md.jpg',
        isBreaking: false,
        isFeatured: false,
        tags: ['visibility-test'],
        status: 'published',
      },
      {
        id: 'empty-date-pub',
        title: 'SECRET_EMPTY_DATE_PUB',
        slug: 'secret-empty-date-pub',
        summary: 'SECRET_EMPTY_DATE_SUMMARY',
        content: 'SECRET_EMPTY_DATE_CONTENT',
        category: 'देश',
        author: { name: 'Empty Date Author', role: 'Editor', avatar: 'https://example.com/ed.jpg' },
        publishedAt: '   ',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/ed.jpg',
        isBreaking: false,
        isFeatured: false,
        tags: ['visibility-test'],
        status: 'published',
      },
      {
        id: 'malformed-date-pub',
        title: 'SECRET_MALFORMED_DATE_PUB',
        slug: 'secret-malformed-date-pub',
        summary: 'SECRET_MALFORMED_DATE_SUMMARY',
        content: 'SECRET_MALFORMED_DATE_CONTENT',
        category: 'देश',
        author: { name: 'Malformed Date Author', role: 'Editor', avatar: 'https://example.com/bd.jpg' },
        publishedAt: 'not-a-valid-date',
        readTime: '2 मिनट',
        imageUrl: 'https://example.com/bd.jpg',
        isBreaking: false,
        isFeatured: false,
        tags: ['visibility-test'],
        status: 'published',
      },
    ];

    const fixtureStore = {
      articles: fixtureArticles,
      stateNews: { दिल्ली: [], महाराष्ट्र: [], 'उत्तर प्रदेश': [], बिहार: [], पंजाब: [] },
      videos: [],
      editors: [],
      liveUpdates: [
        {
          id: 'live-pub',
          timestamp: 'अभी-अभी',
          title: 'Public Live Update',
          content: 'Public live body',
          category: 'देश',
          isBreaking: true,
          author: 'Desk',
          verified: true,
          linkArticleId: 'pub-art-1',
        },
        {
          id: 'live-standalone',
          timestamp: 'अभी-अभी',
          title: 'Standalone Live Wire',
          content: 'Standalone bulletin',
          category: 'देश',
          isBreaking: false,
          author: 'Desk',
          verified: true,
        },
        {
          id: 'live-draft-leak',
          timestamp: 'अभी-अभी',
          title: 'SECRET_DRAFT_LIVE_UPDATE',
          content: 'SECRET_DRAFT_SUMMARY',
          category: 'देश',
          isBreaking: true,
          author: 'Draft Author',
          verified: true,
          linkArticleId: 'draft-art-1',
        },
        {
          id: 'live-orphan-link',
          timestamp: 'अभी-अभी',
          title: 'SECRET_ORPHAN_LIVE_UPDATE',
          content: 'Deleted article link',
          category: 'देश',
          isBreaking: true,
          author: 'Desk',
          verified: true,
          linkArticleId: 'deleted-nonexistent-999',
        },
        {
          id: 'live-bad-date-link',
          timestamp: 'अभी-अभी',
          title: 'SECRET_BAD_DATE_LIVE_UPDATE',
          content: 'Malformed date article link',
          category: 'देश',
          isBreaking: true,
          author: 'Desk',
          verified: true,
          linkArticleId: 'malformed-date-pub',
        },
      ],
      logs: [],
      lastSavedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(TMP_DIR, 'data', 'store.json'),
      JSON.stringify(fixtureStore, null, 2)
    );

    serverProc = spawn('node', ['dist/server.cjs'], {
      cwd: TMP_DIR,
      env: { ...process.env, NODE_ENV: 'production', PORT: String(TEST_PORT) },
      stdio: 'ignore',
      detached: true,
    });

    await waitForServer(`${BASE_URL}/api/admin/bootstrap-status`);

    // Bootstrap admin for CMS regression tests
    const bootRes = await fetch(`${BASE_URL}/api/admin/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'c42_admin',
        password: 'TestPassword#C42',
        name: 'C42 Chief Admin',
      }),
    });
    assert.equal(bootRes.status, 201);
    const bootJson = await bootRes.json();
    adminToken = bootJson.token;
    assert.ok(adminToken);
  });

  after(() => {
    if (serverProc?.pid) {
      try {
        process.kill(-serverProc.pid, 'SIGKILL');
      } catch {
        // already exited
      }
    }
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('Public GET /api/articles returns ONLY published articles and blocks all bypass query params', async () => {
    const publicUrls = [
      '/api/articles',
      '/api/articles?status=all',
      '/api/articles?status=draft',
      '/api/articles?status=archived',
      '/api/articles?status=scheduled',
      '/api/articles?status=unpublished',
      '/api/articles?status[]=draft&status[]=published',
      '/api/articles?category=%E0%A4%A6%E0%A5%87%E0%A4%B6',
      '/api/articles?tag=visibility-test',
      '/api/articles?featured=true',
      '/api/articles?breaking=true',
      '/api/articles?limit=100',
    ];

    for (const url of publicUrls) {
      const res = await fetch(`${BASE_URL}${url}`);
      assert.equal(res.status, 200, `Expected 200 for ${url}`);
      const json = await res.json();
      assert.equal(json.count, json.data.length);
      for (const art of json.data) {
        assert.equal(art.status, 'published', `Non-published article leaked via ${url}`);
        assert.ok(
          ['pub-art-1', 'pub-art-2'].includes(art.id),
          `Unexpected hidden article ID ${art.id} via ${url}`
        );
      }
    }

    // Verify pagination / count excludes hidden articles even when limit=2
    const pagedRes = await fetch(`${BASE_URL}/api/articles?limit=2`);
    const pagedJson = await pagedRes.json();
    assert.equal(pagedJson.count, 2);
    assert.deepEqual(
      pagedJson.data.map((a: any) => a.id),
      ['pub-art-1', 'pub-art-2']
    );

    // Invalid Bearer token must NOT unlock hidden articles
    const badAuthRes = await fetch(`${BASE_URL}/api/articles?status=draft`, {
      headers: { Authorization: 'Bearer invalid-forged-token-1234567890' },
    });
    const badAuthJson = await badAuthRes.json();
    assert.equal(badAuthJson.count, 0);
  });

  it('Public search and tag queries cannot find hidden or invalid-date articles', async () => {
    for (const q of [
      'SECRET_DRAFT',
      'SECRET_ARCHIVED',
      'SECRET_SCHEDULED',
      'SECRET_FUTURE',
      'SECRET_UNPUBLISHED',
      'SECRET_MISSING',
      'SECRET_EMPTY_DATE',
      'SECRET_MALFORMED_DATE',
    ]) {
      const res = await fetch(`${BASE_URL}/api/articles?search=${encodeURIComponent(q)}`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.count, 0, `Search leaked hidden article for query ${q}`);
      assert.deepEqual(json.data, []);
    }

    const tagRes = await fetch(`${BASE_URL}/api/articles?tag=secret-tag`);
    const tagJson = await tagRes.json();
    assert.equal(tagJson.count, 0);
  });

  it('Public GET /api/articles/:id returns 200 for published and uniform 404 with zero leakage for all hidden/invalid-date/missing articles', async () => {
    const pubRes = await fetch(`${BASE_URL}/api/articles/pub-art-1`);
    assert.equal(pubRes.status, 200);
    const pubJson = await pubRes.json();
    assert.equal(pubJson.data.id, 'pub-art-1');

    const pubSlugRes = await fetch(`${BASE_URL}/api/articles/public-news-2`);
    assert.equal(pubSlugRes.status, 200);

    const hiddenTargets = [
      'draft-art-1',
      'secret-draft-slug',
      'arch-art-1',
      'secret-archived-slug',
      'sched-status-art',
      'sched-future-art',
      'unpub-art-1',
      'missing-status-art',
      'missing-date-pub',
      'empty-date-pub',
      'malformed-date-pub',
      'totally-nonexistent-id',
    ];

    for (const target of hiddenTargets) {
      const res = await fetch(`${BASE_URL}/api/articles/${target}`);
      assert.equal(res.status, 404, `Expected 404 for ${target}`);
      const text = await res.text();
      assert.deepEqual(JSON.parse(text), { success: false, error: 'Article not found' });
      assert.equal(text.includes('SECRET_'), false);
    }
  });

  it('Public GET /api/live-updates hides dispatches linked to non-public or orphaned articles', async () => {
    const res = await fetch(`${BASE_URL}/api/live-updates`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(
      json.data.map((u: any) => u.id),
      ['live-pub', 'live-standalone']
    );
  });

  it('Admin CMS can view drafts/archived/invalid-date articles, edit them, publish, and unpublish/archive without weakening public protection', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // Admin sees all articles including drafts, archived, and invalid-date items
    const allRes = await fetch(`${BASE_URL}/api/articles`, { headers: authHeaders });
    assert.equal(allRes.status, 200);
    const allJson = await allRes.json();
    assert.equal(allJson.count, 11);

    const draftsRes = await fetch(`${BASE_URL}/api/articles?status=draft`, { headers: authHeaders });
    const draftsJson = await draftsRes.json();
    assert.equal(draftsJson.count, 1);
    assert.equal(draftsJson.data[0].id, 'draft-art-1');

    const archRes = await fetch(`${BASE_URL}/api/articles?status=archived`, { headers: authHeaders });
    const archJson = await archRes.json();
    assert.equal(archJson.count, 1);
    assert.equal(archJson.data[0].id, 'arch-art-1');

    // Admin can inspect draft and invalid-date article by ID and repair its publishedAt
    const draftDetailRes = await fetch(`${BASE_URL}/api/articles/draft-art-1`, { headers: authHeaders });
    assert.equal(draftDetailRes.status, 200);
    const badDateDetailRes = await fetch(`${BASE_URL}/api/articles/malformed-date-pub`, {
      headers: authHeaders,
    });
    assert.equal(badDateDetailRes.status, 200);

    const repairDateRes = await fetch(`${BASE_URL}/api/articles/malformed-date-pub`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ publishedAt: '2026-08-22T10:00:00Z' }),
    });
    assert.equal(repairDateRes.status, 200);
    assert.equal((await fetch(`${BASE_URL}/api/articles/malformed-date-pub`)).status, 200);

    // Admin creates a new breaking draft -> must remain hidden publicly & not emit public live update
    const createDraftRes = await fetch(`${BASE_URL}/api/articles`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'ADMIN_CREATED_DRAFT_TITLE',
        content: 'Draft editorial content',
        category: 'देश',
        status: 'draft',
        isBreaking: true,
      }),
    });
    assert.equal(createDraftRes.status, 201);
    const createdId = (await createDraftRes.json()).data.id;

    assert.equal((await fetch(`${BASE_URL}/api/articles/${createdId}`)).status, 404);
    const liveAfterDraft = await (await fetch(`${BASE_URL}/api/live-updates`)).json();
    assert.equal(
      liveAfterDraft.data.some((u: any) => u.linkArticleId === createdId),
      false
    );

    // Admin edits the draft
    const editRes = await fetch(`${BASE_URL}/api/articles/${createdId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ title: 'ADMIN_EDITED_DRAFT_TITLE' }),
    });
    assert.equal(editRes.status, 200);
    assert.equal((await fetch(`${BASE_URL}/api/articles/${createdId}`)).status, 404);

    // Admin publishes the draft -> now visible publicly (200)
    const pubRes = await fetch(`${BASE_URL}/api/articles/${createdId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(pubRes.status, 200);
    const pubCheck = await fetch(`${BASE_URL}/api/articles/${createdId}`);
    assert.equal(pubCheck.status, 200);
    assert.equal((await pubCheck.json()).data.title, 'ADMIN_EDITED_DRAFT_TITLE');

    // Admin archives/unpublishes the article -> immediately returns 404 publicly
    const archiveRes = await fetch(`${BASE_URL}/api/articles/${createdId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ status: 'archived' }),
    });
    assert.equal(archiveRes.status, 200);
    assert.equal((await fetch(`${BASE_URL}/api/articles/${createdId}`)).status, 404);
  });
});
