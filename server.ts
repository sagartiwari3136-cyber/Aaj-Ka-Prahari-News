import {
  getAppEnv,
  validateStorageDriverConfig,
  parseTrustProxyConfig,
  getAllowedCorsOrigins,
} from './server/config/env';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  getStore,
  saveStoreSync,
  scheduleSaveStore,
  flushScheduledSave,
  resetStore,
  logAudit,
  logSecurityEvent,
  StoreStorageError,
} from './server/store';
import {
  ensureEnvAdminAccountsSynced,
  isBootstrapRequired,
  bootstrapChiefAdmin,
  authenticateAdmin,
  createSessionForUser,
  verifySessionToken,
  revokeSessionToken,
  listAdminUsers,
  createAdminUser,
  changeAdminPassword,
  setAdminUserActiveStatus,
  deleteAdminUser,
  BootstrapConflictError,
  AuthConflictError,
  AuthDomainError,
  AuthStorageError,
  InvalidCurrentPasswordError,
} from './server/auth/authStore';
import {
  AuthenticatedRequest,
  extractBearerToken,
  requireAdminAuth,
  requireRole,
  resolveOptionalAdminAuth,
} from './server/middleware/auth';
import {
  isArticlePubliclyVisible,
  filterPublicArticles,
  findPublicArticleByIdOrSlug,
  filterPublicLiveUpdates,
} from './server/utils/articleVisibility';
import {
  loginRateLimitMiddleware,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  passwordChangeRateLimitMiddleware,
  recordFailedPasswordChangeAttempt,
  clearFailedPasswordChangeAttempts,
  getClientIp,
} from './server/middleware/rateLimit';
import {
  securityHeadersMiddleware,
  corsAndOriginMiddleware,
} from './server/middleware/security';
import {
  loginSchema,
  bootstrapAdminSchema,
  createAdminUserSchema,
  updateAdminUserStatusSchema,
  changePasswordSchema,
  createArticleSchema,
  updateArticleSchema,
  createStateNewsSchema,
  updateStateNewsSchema,
  createVideoSchema,
  updateVideoSchema,
  createEditorSchema,
  updateEditorSchema,
  createLiveUpdateSchema,
  aiEditorialAssistSchema,
  articlesQuerySchema,
  stateNewsQuerySchema,
  videosQuerySchema,
  idParamSchema,
} from './server/validation/schemas';
import {
  Article,
  LiveUpdate,
  MajorState,
  StateNewsItem,
  VideoNewsItem,
  EditorAnchor,
} from './src/types';

function logServerError(context: string, error: unknown): void {
  const safeDetail = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error';
  console.error(`[SERVER_ERROR] ${context}: ${safeDetail}`);
}

function sanitizeArticleForOutput(article: Article & Record<string, any>): Article {
  const { views: _v, likes: _l, commentsCount: _c, ...clean } = article;
  return clean as Article;
}

function sanitizeVideoForOutput(video: VideoNewsItem & Record<string, any>): VideoNewsItem {
  const { views: _v, viewsCount: _vc, viewsDisplay: _vd, ...clean } = video;
  return clean as VideoNewsItem;
}

function slugifyHeadline(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function normalizeTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function generateUniqueSlug(
  articles: Article[],
  rawBase: string,
  fallbackId: string,
  excludeId?: string
): string {
  const base = slugifyHeadline(rawBase) || fallbackId;
  const used = new Set(
    articles.filter((a) => a.id !== excludeId).map((a) => a.slug.toLowerCase())
  );
  if (!used.has(base.toLowerCase())) {
    return base;
  }
  let counter = 2;
  while (used.has(`${base}-${counter}`.toLowerCase())) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

// Lazy Gemini API initialization helper
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

declare const __AKP_PROD_BUNDLE__: boolean | undefined;

const SENSITIVE_ROOT_PREFIXES = [
  '/data',
  '/server',
  '/drizzle',
  '/docs',
  '/scripts',
  '/skills',
  '/dist',
];

const SENSITIVE_EXACT_PATHS = new Set([
  '/server.ts',
  '/server.js',
  '/server.cjs',
  '/server.cjs.map',
  '/package.json',
  '/package-lock.json',
  '/bun.lock',
  '/bun.lockb',
  '/pnpm-lock.yaml',
  '/yarn.lock',
  '/tsconfig.json',
  '/vite.config.ts',
  '/vite.config.js',
  '/drizzle.config.ts',
  '/metadata.json',
  '/readme.md',
  '/walkthrough.md',
]);

const ALWAYS_BLOCKED_EXTENSIONS = new Set([
  '.env',
  '.sql',
  '.sqlite',
  '.sqlite3',
  '.db',
  '.bak',
  '.log',
  '.pem',
  '.key',
  '.cjs',
  '.map',
  '.lock',
  '.lockb',
  '.yaml',
  '.yml',
  '.md',
]);

const PROD_BLOCKED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.jsx',
  '.mts',
  '.cts',
  '.mjs',
  '.json',
]);

function normalizeCandidatePath(rawInput: string): string | null {
  if (!rawInput || rawInput.includes('\0')) return null;

  let decoded = rawInput;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }

  if (decoded.includes('\0')) return null;
  const forwardSlashed = decoded.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const normalized = path.posix.normalize(
    forwardSlashed.startsWith('/') ? forwardSlashed : `/${forwardSlashed}`
  );
  return normalized.toLowerCase();
}

function isSensitiveStaticRequest(req: Request, isProduction: boolean): boolean {
  const urlWithoutQuery = (req.originalUrl || req.url || req.path || '/').split(/[?#]/)[0];
  const candidates = [normalizeCandidatePath(urlWithoutQuery), normalizeCandidatePath(req.path)];

  for (const candidate of candidates) {
    if (!candidate) {
      return true; // Malformed URI encoding or null byte
    }

    // Never block legitimate /api/* routes (normalization already resolved /api/../data/* above)
    if (candidate === '/api' || candidate.startsWith('/api/')) {
      continue;
    }

    // Block Vite raw source queries in dev mode (e.g. /src/main.tsx?raw)
    if (!isProduction && /(?:^|[?&])raw(?:=|&|$)/i.test(req.originalUrl || '')) {
      return true;
    }

    // Block /@fs/ references pointing to sensitive server/data/env paths in dev mode
    if (
      candidate.startsWith('/@fs/') &&
      (isProduction ||
        /\/(data|server|drizzle|docs|scripts|skills|dist)\/|\.(env|sql|cjs|map|db|sqlite|lock)|\/(server\.ts|package\.json|tsconfig\.json|vite\.config|metadata\.json)/i.test(
          candidate
        ))
    ) {
      return true;
    }

    // Block hidden dotfiles/directories (except Vite's dev cache /node_modules/.vite/ and /.well-known/)
    const isAllowedDevCache =
      !isProduction && candidate.startsWith('/node_modules/.vite/');
    const isWellKnown = candidate.startsWith('/.well-known/');
    if (!isAllowedDevCache && !isWellKnown && /(^|\/)\.[^/]+/.test(candidate)) {
      return true;
    }

    // Block exact sensitive root files
    if (SENSITIVE_EXACT_PATHS.has(candidate)) {
      return true;
    }

    // Block sensitive directory prefixes
    if (
      SENSITIVE_ROOT_PREFIXES.some(
        (prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`)
      )
    ) {
      return true;
    }

    // In production, also block /src, /node_modules, and TypeScript/JSON source files
    if (
      isProduction &&
      (candidate === '/src' ||
        candidate.startsWith('/src/') ||
        candidate === '/node_modules' ||
        candidate.startsWith('/node_modules/'))
    ) {
      return true;
    }

    const base = path.posix.basename(candidate);
    if (base.startsWith('.env')) {
      return true;
    }

    const ext = path.posix.extname(candidate);
    if (ALWAYS_BLOCKED_EXTENSIONS.has(ext)) {
      return true;
    }

    if (isProduction && PROD_BLOCKED_EXTENSIONS.has(ext)) {
      return true;
    }
  }

  return false;
}

const startTime = Date.now();

async function startServer() {
  const isProductionBundle =
    (typeof __AKP_PROD_BUNDLE__ !== 'undefined' && __AKP_PROD_BUNDLE__ === true) ||
    (typeof __filename !== 'undefined' && path.basename(__filename) === 'server.cjs');

  if (isProductionBundle && process.env.NODE_ENV !== 'production') {
    console.error(
      'FATAL: Production bundle (dist/server.cjs) cannot start unless NODE_ENV=production.'
    );
    process.exit(1);
  }

  const isProductionMode = process.env.NODE_ENV === 'production';

  // Fail-closed runtime configuration checks (storage driver, trust proxy, CORS allowlist)
  let trustProxySetting: ReturnType<typeof parseTrustProxyConfig>;
  let allowedCorsOrigins: Set<string>;
  let appPort = Number(process.env.PORT) || 3000;
  try {
    validateStorageDriverConfig();
    const appEnv = getAppEnv();
    appPort = appEnv.PORT;
    trustProxySetting = parseTrustProxyConfig();
    allowedCorsOrigins = getAllowedCorsOrigins();
  } catch (err) {
    logServerError('startup.config', err);
    console.error(
      `FATAL: ${err instanceof Error ? err.message : 'Invalid server configuration.'}`
    );
    process.exit(1);
  }

  try {
    await ensureEnvAdminAccountsSynced();
    getStore();
  } catch (err) {
    const safeMsg =
      err instanceof AuthStorageError || err instanceof StoreStorageError
        ? err.message
        : 'Storage initialization failed.';
    logServerError('startup.storage', err);
    console.error(`FATAL: ${safeMsg}`);
    process.exit(1);
  }

  const app = express();
  const PORT = appPort;

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxySetting);

  // Block HTTP access to sensitive files, directories, and source files before static/Vite serving
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isSensitiveStaticRequest(req, isProductionMode)) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }
    next();
  });

  app.use(securityHeadersMiddleware({ isProductionMode }));
  app.use(
    corsAndOriginMiddleware({
      allowedOrigins: allowedCorsOrigins,
      trustProxyEnabled: trustProxySetting !== false,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ==========================================
  // MINIMAL PUBLIC PROCESS HEALTH PROBE
  // ==========================================
  app.get('/healthz', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok' });
  });

  // ==========================================
  // SYSTEM HEALTH, METRICS & DOCUMENTATION
  // ==========================================

  // GET /api/system/health (Chief Admin Only)
  app.get(
    '/api/system/health',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      const store = getStore();
      const totalEntries =
        store.articles.length +
        Object.values(store.stateNews).reduce((sum, list) => sum + list.length, 0) +
        store.videos.length +
        store.editors.length +
        store.liveUpdates.length;

      const memoryUsage = process.memoryUsage();

      res.json({
        success: true,
        status: 'healthy',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        service: 'Aaj Ka Prahari (AKP News) Unified Backend',
        version: '2.4.0',
        database: {
          engine: 'Persistent JSON Store with In-Memory Caching',
          totalRecords: totalEntries,
          lastSavedAt: store.lastSavedAt,
          collections: {
            articles: store.articles.length,
            stateNews: Object.values(store.stateNews).reduce((sum, list) => sum + list.length, 0),
            videos: store.videos.length,
            editors: store.editors.length,
            liveUpdates: store.liveUpdates.length,
          },
        },
        memory: {
          rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
          heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        },
        environment: process.env.NODE_ENV || 'development',
      });
    }
  );

  // GET /api/analytics/dashboard (Chief Admin Only)
  app.get(
    '/api/analytics/dashboard',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      const store = getStore();

      const categoryBreakdown: Record<string, number> = {};

      store.articles.forEach((art) => {
        categoryBreakdown[art.category] = (categoryBreakdown[art.category] || 0) + 1;
      });

      const stateBreakdown: Record<string, number> = {};
      let totalStateNews = 0;
      Object.entries(store.stateNews).forEach(([state, items]) => {
        stateBreakdown[state] = items.length;
        totalStateNews += items.length;
      });

      const recentArticles = [...store.articles]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 5)
        .map((a) => ({ id: a.id, title: a.title, publishedAt: a.publishedAt, category: a.category }));

      const memoryUsage = process.memoryUsage();

      res.json({
        success: true,
        data: {
          totalArticles: store.articles.length,
          totalVideos: store.videos.length,
          totalStateNews,
          categoryBreakdown,
          stateBreakdown,
          recentArticles,
          systemHealth: {
            status: 'healthy',
            uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
            memoryUsageMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
            databaseEntries: store.articles.length + totalStateNews + store.videos.length,
            lastSavedAt: store.lastSavedAt,
          },
        },
      });
    }
  );

  // GET /api/system/export (Chief Admin Only)
  app.get(
    '/api/system/export',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      const store = getStore();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="akp-news-backup.json"');
      res.send(JSON.stringify(store, null, 2));
    }
  );

  // POST /api/system/reset (Chief Admin Only)
  app.post(
    '/api/system/reset',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const newStore = resetStore();
        logAudit(
          'RESET',
          '/api/system/reset',
          `Store reset to fresh seed dataset by ${req.adminUser?.username || 'chief_admin'}.`
        );
        saveStoreSync();
        res.json({
          success: true,
          message: 'Backend database has been reset to default editorial state.',
          timestamp: new Date().toISOString(),
          articlesCount: newStore.articles.length,
        });
      } catch (err) {
        logServerError('POST /api/system/reset', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }
  );

  // GET /api/system/logs (Chief Admin Only)
  app.get(
    '/api/system/logs',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      const store = getStore();
      res.json({ success: true, count: store.logs.length, data: store.logs });
    }
  );

  // GET /api/docs - API Endpoint Directory (Authenticated Admin/Editor Only)
  app.get(
    '/api/docs',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
    res.json({
      title: 'आज का प्रहरी (AKP News) RESTful API Documentation',
      version: '2.4.0',
      description: 'Read-only public news delivery and authenticated CMS publishing backend services.',
      endpoints: [
        { method: 'GET', path: '/api/articles', description: 'List articles with filters (category, search, tag, status, featured, breaking)' },
        { method: 'GET', path: '/api/articles/:id', description: 'Retrieve single article by ID or slug' },
        { method: 'POST', path: '/api/articles', description: 'Create article with slug, word count, read time calculation (CMS)' },
        { method: 'PUT', path: '/api/articles/:id', description: 'Update existing article (CMS)' },
        { method: 'DELETE', path: '/api/articles/:id', description: 'Delete article (CMS)' },
        { method: 'GET', path: '/api/state-news', description: 'Get state-wise regional news (filter by state: दिल्ली, महाराष्ट्र, उत्तर प्रदेश, बिहार, पंजाब)' },
        { method: 'POST', path: '/api/state-news', description: 'Create new state news item (CMS)' },
        { method: 'PUT', path: '/api/state-news/:id', description: 'Update state news item (CMS)' },
        { method: 'DELETE', path: '/api/state-news/:id', description: 'Delete state news item (CMS)' },
        { method: 'GET', path: '/api/videos', description: 'Get video bulletins catalog' },
        { method: 'POST', path: '/api/videos', description: 'Add new video bulletin (CMS)' },
        { method: 'PUT', path: '/api/videos/:id', description: 'Update video bulletin (CMS)' },
        { method: 'DELETE', path: '/api/videos/:id', description: 'Delete video bulletin (CMS)' },
        { method: 'GET', path: '/api/editors', description: 'Get editorial board & anchor roster' },
        { method: 'POST', path: '/api/editors', description: 'Add editor/anchor profile (Chief Admin)' },
        { method: 'PUT', path: '/api/editors/:id', description: 'Update editor/anchor profile (Chief Admin)' },
        { method: 'DELETE', path: '/api/editors/:id', description: 'Delete editor/anchor profile (Chief Admin)' },
        { method: 'GET', path: '/api/live-updates', description: 'Get real-time fast ticker dispatches' },
        { method: 'POST', path: '/api/live-updates', description: 'Publish fast live update (CMS)' },
        { method: 'DELETE', path: '/api/live-updates/:id', description: 'Delete live update (CMS)' },
        { method: 'POST', path: '/api/ai/editorial-assist', description: 'Gemini AI assistant (headlines, drafting, summary, polish) (CMS)' },
        { method: 'GET', path: '/api/analytics/dashboard', description: 'Editorial inventory and system analytics (Chief Admin)' },
        { method: 'GET', path: '/api/system/health', description: 'System status, collection counts and uptime (Chief Admin)' },
      ],
    });
    }
  );

  // ==========================================
  // ARTICLE API ENDPOINTS
  // ==========================================

  // GET all articles with filters (public: strictly published-only; authenticated CMS: all statuses)
  app.get('/api/articles', (req: Request, res: Response) => {
    try {
      const parsedQuery = articlesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          success: false,
          error: parsedQuery.error.issues[0]?.message || 'Invalid article query parameters',
        });
      }

      const store = getStore();
      const adminUser = resolveOptionalAdminAuth(req);
      const { category, search, tag, status, featured, breaking, limit, sort, order } =
        parsedQuery.data;

      res.setHeader('Vary', 'Authorization');

      // Separate public visibility path from Admin CMS path:
      // Public callers ALWAYS start from explicitly published articles BEFORE any filtering, sorting, or counting.
      let result: Article[];
      if (adminUser) {
        res.setHeader('Cache-Control', 'no-store');
        result = [...store.articles];
        if (status && status !== 'all') {
          result = result.filter((a) => a.status === status);
        }
      } else {
        result = filterPublicArticles(store.articles);
        if (status && status !== 'all') {
          result = result.filter((a) => a.status === status);
        }
      }

      // Category filter
      if (category && category !== 'All' && category !== 'ताज़ातरीन') {
        result = result.filter((a) => a.category.toLowerCase() === category.toLowerCase());
      }

      // Tag filter
      if (tag) {
        result = result.filter((a) => a.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
      }

      // Featured filter
      if (featured === 'true') {
        result = result.filter((a) => a.isFeatured);
      }

      // Breaking filter
      if (breaking === 'true') {
        result = result.filter((a) => a.isBreaking);
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.summary.toLowerCase().includes(q) ||
            a.content.toLowerCase().includes(q) ||
            a.author.name.toLowerCase().includes(q) ||
            (a.location && a.location.toLowerCase().includes(q)) ||
            a.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      // Sort strictly by allowlisted fields ('publishedAt' | 'title' | 'category')
      const dir = order === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        if (sort === 'title') {
          return a.title.localeCompare(b.title) * dir;
        }
        if (sort === 'category') {
          return a.category.localeCompare(b.category) * dir;
        }
        return (new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()) * dir;
      });

      // Limit results (already validated & capped by articlesQuerySchema)
      if (limit !== undefined) {
        result = result.slice(0, limit);
      }

      const sanitized = result.map(sanitizeArticleForOutput);
      res.json({ success: true, count: sanitized.length, data: sanitized });
    } catch (error) {
      logServerError('GET /api/articles', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // GET single article by ID or slug (public: published-only with uniform 404; authenticated CMS: all statuses)
  app.get('/api/articles/:id', (req: Request, res: Response) => {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ success: false, error: 'Invalid article identifier' });
      }

      const store = getStore();
      const id = parsedId.data;
      const adminUser = resolveOptionalAdminAuth(req);

      res.setHeader('Vary', 'Authorization');

      let article: Article | null | undefined;
      if (adminUser) {
        res.setHeader('Cache-Control', 'no-store');
        article = store.articles.find((a) => a.id === id || a.slug === id) || null;
      } else {
        article = findPublicArticleByIdOrSlug(store.articles, id);
      }

      if (!article) {
        return res.status(404).json({ success: false, error: 'Article not found' });
      }

      res.json({ success: true, data: sanitizeArticleForOutput(article) });
    } catch (error) {
      logServerError('GET /api/articles/:id', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // POST create article (CMS - Chief Admin or Senior Editor)
  app.post(
    '/api/articles',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = createArticleSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Invalid article payload',
          });
        }

        const store = getStore();
        const body = parsed.data;

        // Prevent duplicate article submissions in the same desk category
        const normalizedTitle = normalizeTitleKey(body.title);
        const normalizedCategory = body.category.trim().toLowerCase();
        const duplicateTitle = store.articles.find(
          (a) =>
            normalizeTitleKey(a.title) === normalizedTitle &&
            a.category.trim().toLowerCase() === normalizedCategory
        );
        if (duplicateTitle) {
          return res.status(409).json({
            success: false,
            error: 'इस श्रेणी में इसी शीर्षक का लेख पहले से मौजूद है।',
          });
        }

        const id = `art-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const explicitSlug = body.slug?.trim();
        if (explicitSlug) {
          const slugCollision = store.articles.find(
            (a) => a.slug.toLowerCase() === explicitSlug.toLowerCase()
          );
          if (slugCollision) {
            return res.status(409).json({
              success: false,
              error: 'यह URL स्लग (slug) किसी अन्य लेख में पहले से उपयोग में है।',
            });
          }
        }
        const resolvedSlug = explicitSlug || generateUniqueSlug(store.articles, body.title, id);

        const wordCount = body.content.split(/\s+/).length;
        const estimatedReadTime = `${Math.max(1, Math.ceil(wordCount / 180))} मिनट`;

        const newArticle: Article = {
          id,
          title: body.title,
          slug: resolvedSlug,
          summary: body.summary || body.content.substring(0, 160) + '...',
          content: body.content,
          category: body.category as Article['category'],
          subCategory: body.subCategory || 'ताज़ा समाचार',
          author: body.author || {
            name: 'आज का प्रहरी संपादकीय डेस्क',
            role: 'वरिष्ठ संवाददाता',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
          },
          publishedAt: body.publishedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          readTime: body.readTime || estimatedReadTime,
          imageUrl:
            body.imageUrl ||
            'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=1200',
          imageCaption: body.imageCaption || 'आज का प्रहरी ब्यूरो रिपोर्ट।',
          imagePhotographer: body.imagePhotographer || 'संपादकीय टीम',
          isBreaking: Boolean(body.isBreaking),
          isFeatured: Boolean(body.isFeatured),
          isEditorialPick: Boolean(body.isEditorialPick),
          tags: Array.isArray(body.tags)
            ? body.tags
            : body.tags
            ? body.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
            : ['आज का प्रहरी'],
          status: body.status || 'published',
          location: body.location || 'राष्ट्रीय डेस्क',
        };

        store.articles.unshift(newArticle);

        // If marked as breaking AND publicly visible, generate a live feed update
        if (newArticle.isBreaking && isArticlePubliclyVisible(newArticle)) {
          store.liveUpdates.unshift({
            id: `live-${Date.now()}`,
            timestamp: 'अभी-अभी',
            title: newArticle.title,
            content: newArticle.summary,
            category: newArticle.category,
            isBreaking: true,
            author: newArticle.author.name,
            verified: true,
            tag: 'बड़ी खबर',
            linkArticleId: newArticle.id,
            location: newArticle.location,
          });
        }

        logAudit(
          'POST',
          '/api/articles',
          `Created article "${newArticle.id}" (${newArticle.status}) by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.status(201).json({ success: true, data: sanitizeArticleForOutput(newArticle) });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to create article' });
      }
    }
  );

  // PUT update article (CMS - Chief Admin or Senior Editor)
  app.put(
    '/api/articles/:id',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid article identifier' });
        }

        const parsed = updateArticleSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Invalid article update payload',
          });
        }

        const store = getStore();
        const id = parsedId.data;
        const index = store.articles.findIndex((a) => a.id === id);

        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Article not found' });
        }

        const body = parsed.data;
        const current = store.articles[index];

        const nextTitle = body.title !== undefined ? body.title : current.title;
        const nextCategory = body.category !== undefined ? body.category : current.category;
        const normalizedTitle = normalizeTitleKey(nextTitle);
        const normalizedCategory = nextCategory.trim().toLowerCase();
        const duplicateTitle = store.articles.find(
          (a) =>
            a.id !== id &&
            normalizeTitleKey(a.title) === normalizedTitle &&
            a.category.trim().toLowerCase() === normalizedCategory
        );
        if (duplicateTitle) {
          return res.status(409).json({
            success: false,
            error: 'इस श्रेणी में इसी शीर्षक का एक अन्य लेख पहले से मौजूद है।',
          });
        }

        const nextSlug =
          body.slug !== undefined && body.slug.trim() !== '' ? body.slug.trim() : current.slug;
        const slugCollision = store.articles.find(
          (a) => a.id !== id && a.slug.toLowerCase() === nextSlug.toLowerCase()
        );
        if (slugCollision) {
          return res.status(409).json({
            success: false,
            error: 'यह URL स्लग (slug) किसी अन्य लेख में पहले से उपयोग में है।',
          });
        }

        const normalizedTags =
          body.tags === undefined
            ? current.tags
            : Array.isArray(body.tags)
            ? body.tags
            : body.tags.split(',').map((t) => t.trim()).filter(Boolean);

        const updatedArticle: Article = {
          ...current,
          ...(body.title !== undefined ? { title: body.title } : {}),
          slug: nextSlug,
          ...(body.summary !== undefined ? { summary: body.summary } : {}),
          ...(body.content !== undefined ? { content: body.content } : {}),
          ...(body.category !== undefined ? { category: body.category as Article['category'] } : {}),
          ...(body.subCategory !== undefined ? { subCategory: body.subCategory } : {}),
          ...(body.author !== undefined ? { author: body.author } : {}),
          ...(body.publishedAt !== undefined ? { publishedAt: body.publishedAt } : {}),
          ...(body.readTime !== undefined ? { readTime: body.readTime } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
          ...(body.imageCaption !== undefined ? { imageCaption: body.imageCaption } : {}),
          ...(body.imagePhotographer !== undefined ? { imagePhotographer: body.imagePhotographer } : {}),
          ...(body.isBreaking !== undefined ? { isBreaking: body.isBreaking } : {}),
          ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
          ...(body.isEditorialPick !== undefined ? { isEditorialPick: body.isEditorialPick } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          tags: normalizedTags,
          updatedAt: new Date().toISOString(),
          id,
        };

        store.articles[index] = updatedArticle;
        logAudit(
          'PUT',
          `/api/articles/${id}`,
          `Updated article "${id}" (${updatedArticle.status}) by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.json({ success: true, data: sanitizeArticleForOutput(updatedArticle) });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to update article' });
      }
    }
  );

  // DELETE article (CMS - Chief Admin or Senior Editor)
  app.delete(
    '/api/articles/:id',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid article identifier' });
        }

        const store = getStore();
        const id = parsedId.data;
        const index = store.articles.findIndex((a) => a.id === id);

        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Article not found' });
        }

        const removed = store.articles.splice(index, 1)[0];
        logAudit(
          'DELETE',
          `/api/articles/${id}`,
          `Deleted article "${id}" by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.json({
          success: true,
          message: 'Article deleted successfully',
          data: sanitizeArticleForOutput(removed),
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to delete article' });
      }
    }
  );

  // ==========================================
  // STATE NEWS API (राज्यवार समाचार)
  // ==========================================

  // GET /api/state-news?state=दिल्ली
  app.get('/api/state-news', (req: Request, res: Response) => {
    try {
      const parsedQuery = stateNewsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          success: false,
          error: parsedQuery.error.issues[0]?.message || 'Invalid state news query',
        });
      }

      const store = getStore();
      const { state, search } = parsedQuery.data;

      if (state) {
        const stateKey = state as MajorState;
        let list = Object.prototype.hasOwnProperty.call(store.stateNews, stateKey)
          ? store.stateNews[stateKey]
          : [];
        if (search) {
          const q = search.toLowerCase();
          list = list.filter(
            (i) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q)
          );
        }
        return res.json({ success: true, state: stateKey, count: list.length, data: list });
      }

      // Return all states
      res.json({ success: true, data: store.stateNews });
    } catch (error) {
      logServerError('GET /api/state-news', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // GET single state news item
  app.get('/api/state-news/:id', (req: Request, res: Response) => {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ success: false, error: 'Invalid state news identifier' });
      }

      const store = getStore();
      const id = parsedId.data;
      for (const [state, list] of Object.entries(store.stateNews)) {
        const found = list.find((item) => item.id === id);
        if (found) {
          return res.json({ success: true, state, data: found });
        }
      }
      res.status(404).json({ success: false, error: 'State news item not found' });
    } catch (error) {
      logServerError('GET /api/state-news/:id', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // POST /api/state-news (CMS - Chief Admin or Senior Editor)
  app.post(
    '/api/state-news',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = createStateNewsSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'State, title, and summary are required',
          });
        }

        const store = getStore();
        const { state, city, title, summary, content, imageUrl, reporter, tags, isHeadline } =
          parsed.data;

        const stateKey = state as MajorState;
        if (!store.stateNews[stateKey]) {
          store.stateNews[stateKey] = [];
        }

        const newItem: StateNewsItem = {
          id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          state: stateKey,
          city: city || stateKey,
          title,
          summary,
          content: content || summary,
          imageUrl:
            imageUrl ||
            'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&q=80&w=800',
          publishedAt: new Date().toISOString(),
          reporter: reporter || `${stateKey} संवाददाता`,
          readTime: '3 मिनट',
          tags: Array.isArray(tags) ? tags : [stateKey, city || 'राज्य'],
          isHeadline: Boolean(isHeadline),
        };

        if (newItem.isHeadline) {
          // Demote previous headlines in this state
          store.stateNews[stateKey].forEach((i) => (i.isHeadline = false));
        }

        store.stateNews[stateKey].unshift(newItem);
        logAudit(
          'POST',
          '/api/state-news',
          `Created state news "${newItem.id}" (${stateKey}) by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.status(201).json({ success: true, data: newItem });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to create state news item' });
      }
    }
  );

  // PUT /api/state-news/:id (CMS - Chief Admin or Senior Editor)
  app.put(
    '/api/state-news/:id',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid state news identifier' });
        }

        const parsed = updateStateNewsSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Invalid state news payload',
          });
        }

        const store = getStore();
        const id = parsedId.data;
        const body = parsed.data;

        for (const [currentStateKey, list] of Object.entries(store.stateNews)) {
          const index = list.findIndex((item) => item.id === id);
          if (index !== -1) {
            const current = list[index];
            const targetStateKey = (body.state || currentStateKey) as MajorState;
            const updated: StateNewsItem = {
              ...current,
              state: targetStateKey,
              ...(body.city !== undefined ? { city: body.city } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
              ...(body.summary !== undefined ? { summary: body.summary } : {}),
              ...(body.content !== undefined ? { content: body.content } : {}),
              ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
              ...(body.reporter !== undefined ? { reporter: body.reporter } : {}),
              ...(body.tags !== undefined ? { tags: body.tags } : {}),
              ...(body.isHeadline !== undefined ? { isHeadline: body.isHeadline } : {}),
              id,
            };

            if (!store.stateNews[targetStateKey]) {
              store.stateNews[targetStateKey] = [];
            }

            if (updated.isHeadline) {
              store.stateNews[targetStateKey].forEach((item) => {
                if (item.id !== id) item.isHeadline = false;
              });
            }

            if (targetStateKey !== currentStateKey) {
              list.splice(index, 1);
              store.stateNews[targetStateKey].unshift(updated);
            } else {
              list[index] = updated;
            }

            logAudit(
              'PUT',
              `/api/state-news/${id}`,
              `Updated state news "${id}" (${targetStateKey}) by ${req.adminUser?.username || 'admin'}`
            );
            saveStoreSync();
            return res.json({ success: true, data: updated });
          }
        }

        res.status(404).json({ success: false, error: 'State news item not found' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to update state news item' });
      }
    }
  );

  // DELETE /api/state-news/:id (CMS - Chief Admin or Senior Editor)
  app.delete(
    '/api/state-news/:id',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid state news identifier' });
        }

        const store = getStore();
        const id = parsedId.data;

        for (const [, list] of Object.entries(store.stateNews)) {
          const index = list.findIndex((item) => item.id === id);
          if (index !== -1) {
            const removed = list.splice(index, 1)[0];
            logAudit(
              'DELETE',
              `/api/state-news/${id}`,
              `Deleted state news "${id}" by ${req.adminUser?.username || 'admin'}`
            );
            saveStoreSync();
            return res.json({ success: true, message: 'State news deleted', data: removed });
          }
        }

        res.status(404).json({ success: false, error: 'State news item not found' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to delete state news item' });
      }
    }
  );

  // ==========================================
  // VIDEO NEWS BULLETINS API (वीडियो समाचार)
  // ==========================================

  // GET /api/videos
  app.get('/api/videos', (req: Request, res: Response) => {
    try {
      const parsedQuery = videosQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          success: false,
          error: parsedQuery.error.issues[0]?.message || 'Invalid video query parameters',
        });
      }

      const store = getStore();
      const { category, anchor, search } = parsedQuery.data;
      let result = [...store.videos];

      if (category) {
        result = result.filter((v) => v.category.toLowerCase().includes(category.toLowerCase()));
      }
      if (anchor) {
        result = result.filter((v) => v.anchor.toLowerCase().includes(anchor.toLowerCase()));
      }
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (v) => v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)
        );
      }

      const sanitized = result.map(sanitizeVideoForOutput);
      res.json({ success: true, count: sanitized.length, data: sanitized });
    } catch (error) {
      logServerError('GET /api/videos', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // GET single video
  app.get('/api/videos/:id', (req: Request, res: Response) => {
    try {
      const parsedId = idParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ success: false, error: 'Invalid video identifier' });
      }

      const store = getStore();
      const id = parsedId.data;
      const video = store.videos.find((v) => v.id === id);
      if (!video) {
        return res.status(404).json({ success: false, error: 'Video not found' });
      }
      res.json({ success: true, data: sanitizeVideoForOutput(video) });
    } catch (error) {
      logServerError('GET /api/videos/:id', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // POST /api/videos (CMS - Chief Admin or Senior Editor)
  app.post(
    '/api/videos',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = createVideoSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Title and description are required',
          });
        }

        const store = getStore();
        const { title, description, thumbnailUrl, videoUrl, duration, category, anchor, tag, isLive } =
          parsed.data;

        const newVideo: VideoNewsItem = {
          id: `vid-${Date.now()}`,
          title,
          description,
          thumbnailUrl:
            thumbnailUrl ||
            'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&q=80&w=800',
          videoUrl: videoUrl || 'https://www.w3schools.com/html/mov_bbb.mp4',
          duration: duration || '05:00',
          category: category || 'विशेष बुलेटिन',
          publishedAt: 'अभी-अभी',
          anchor: anchor || 'प्रहरी एंकर',
          tag: tag || 'वीडियो विशेष',
          isLive: Boolean(isLive),
        };

        store.videos.unshift(newVideo);
        logAudit(
          'POST',
          '/api/videos',
          `Created video "${newVideo.id}" by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.status(201).json({ success: true, data: sanitizeVideoForOutput(newVideo) });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to create video bulletin' });
      }
    }
  );

  // PUT /api/videos/:id (CMS - Chief Admin or Senior Editor)
  app.put(
    '/api/videos/:id',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid video identifier' });
        }

        const parsed = updateVideoSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Invalid video update payload',
          });
        }

        const store = getStore();
        const id = parsedId.data;
        const index = store.videos.findIndex((v) => v.id === id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Video not found' });
        }

        const body = parsed.data;
        const current = store.videos[index];
        const updatedVideo: VideoNewsItem = {
          ...current,
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.thumbnailUrl !== undefined
            ? { thumbnailUrl: body.thumbnailUrl || current.thumbnailUrl }
            : {}),
          ...(body.videoUrl !== undefined ? { videoUrl: body.videoUrl || current.videoUrl } : {}),
          ...(body.duration !== undefined ? { duration: body.duration || current.duration } : {}),
          ...(body.category !== undefined ? { category: body.category || current.category } : {}),
          ...(body.anchor !== undefined ? { anchor: body.anchor || current.anchor } : {}),
          ...(body.tag !== undefined ? { tag: body.tag } : {}),
          ...(body.isLive !== undefined ? { isLive: body.isLive } : {}),
          id,
        };

        store.videos[index] = updatedVideo;
        logAudit(
          'PUT',
          `/api/videos/${id}`,
          `Updated video "${id}" by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.json({ success: true, data: sanitizeVideoForOutput(updatedVideo) });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to update video bulletin' });
      }
    }
  );

  // DELETE /api/videos/:id (CMS - Chief Admin or Senior Editor)
  app.delete(
    '/api/videos/:id',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid video identifier' });
        }

        const store = getStore();
        const id = parsedId.data;
        const index = store.videos.findIndex((v) => v.id === id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Video not found' });
        }
        const removed = store.videos.splice(index, 1)[0];
        logAudit(
          'DELETE',
          `/api/videos/${id}`,
          `Deleted video "${id}" by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.json({ success: true, message: 'Video deleted', data: sanitizeVideoForOutput(removed) });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to delete video' });
      }
    }
  );

  // ==========================================
  // EDITORS & ANCHORS API (संपादकीय मंडल)
  // ==========================================

  // GET /api/editors
  app.get('/api/editors', (req: Request, res: Response) => {
    try {
      const store = getStore();
      res.json({ success: true, count: store.editors.length, data: store.editors });
    } catch (error) {
      logServerError('GET /api/editors', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // POST /api/editors (CMS - Chief Admin Only)
  app.post(
    '/api/editors',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = createEditorSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Name and role are required',
          });
        }

        const store = getStore();
        const { name, role, showName, imageUrl, bio, twitter, experience } = parsed.data;

        const newEditor: EditorAnchor = {
          id: `editor-${Date.now()}`,
          name,
          role,
          showName: showName || 'विशेष बुलेटिन',
          imageUrl:
            imageUrl ||
            'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
          bio: bio || 'वरिष्ठ पत्रकार एवं संपादकीय विश्लेषक।',
          twitter: twitter || '@akpnews',
          experience: experience || '10+ वर्ष अनुभव',
        };

        store.editors.push(newEditor);
        logAudit(
          'POST',
          '/api/editors',
          `Added editor "${newEditor.id}" by ${req.adminUser?.username || 'chief_admin'}`
        );
        saveStoreSync();
        res.status(201).json({ success: true, data: newEditor });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to create editor' });
      }
    }
  );

  // PUT /api/editors/:id (CMS - Chief Admin Only)
  app.put(
    '/api/editors/:id',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid editor identifier' });
        }

        const parsed = updateEditorSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Invalid editor update payload',
          });
        }

        const store = getStore();
        const id = parsedId.data;
        const index = store.editors.findIndex((e) => e.id === id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Editor not found' });
        }

        const body = parsed.data;
        const current = store.editors[index];
        const updatedEditor: EditorAnchor = {
          ...current,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.role !== undefined ? { role: body.role } : {}),
          ...(body.showName !== undefined ? { showName: body.showName } : {}),
          ...(body.imageUrl !== undefined
            ? { imageUrl: body.imageUrl || current.imageUrl }
            : {}),
          ...(body.bio !== undefined ? { bio: body.bio } : {}),
          ...(body.twitter !== undefined ? { twitter: body.twitter } : {}),
          ...(body.experience !== undefined ? { experience: body.experience } : {}),
          id,
        };

        store.editors[index] = updatedEditor;
        logAudit(
          'PUT',
          `/api/editors/${id}`,
          `Updated editor "${id}" by ${req.adminUser?.username || 'chief_admin'}`
        );
        saveStoreSync();
        res.json({ success: true, data: updatedEditor });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to update editor' });
      }
    }
  );

  // DELETE /api/editors/:id (CMS - Chief Admin Only)
  app.delete(
    '/api/editors/:id',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid editor identifier' });
        }

        const store = getStore();
        const id = parsedId.data;
        const index = store.editors.findIndex((e) => e.id === id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Editor not found' });
        }
        const removed = store.editors.splice(index, 1)[0];
        logAudit(
          'DELETE',
          `/api/editors/${id}`,
          `Deleted editor "${id}" by ${req.adminUser?.username || 'chief_admin'}`
        );
        saveStoreSync();
        res.json({ success: true, message: 'Editor removed', data: removed });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to remove editor' });
      }
    }
  );

  // ==========================================
  // LIVE FEED / BREAKING NEWS UPDATES
  // ==========================================

  app.get('/api/live-updates', (req: Request, res: Response) => {
    const store = getStore();
    const adminUser = resolveOptionalAdminAuth(req);
    res.setHeader('Vary', 'Authorization');

    if (adminUser) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, count: store.liveUpdates.length, data: store.liveUpdates });
    }

    const publicUpdates = filterPublicLiveUpdates(store.liveUpdates, store.articles);
    res.json({ success: true, count: publicUpdates.length, data: publicUpdates });
  });

  app.post(
    '/api/live-updates',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = createLiveUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Title and content are required',
          });
        }

        const store = getStore();
        const { title, content, category, isBreaking, author, tag, location } = parsed.data;

        const newUpdate: LiveUpdate = {
          id: `live-${Date.now()}`,
          timestamp: 'अभी-अभी',
          title,
          content,
          category: category || 'राष्ट्रीय',
          isBreaking: Boolean(isBreaking),
          author: author || 'आज का प्रहरी फास्ट डेस्क',
          verified: true,
          tag: tag || (isBreaking ? 'बड़ी खबर' : 'ताज़ा अपडेट'),
          location: location || 'नई दिल्ली',
        };

        store.liveUpdates.unshift(newUpdate);
        logAudit(
          'POST',
          '/api/live-updates',
          `Published live update "${newUpdate.id}" by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.status(201).json({ success: true, data: newUpdate });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to create live update' });
      }
    }
  );

  app.delete(
    '/api/live-updates/:id',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid live update identifier' });
        }

        const store = getStore();
        const id = parsedId.data;
        const index = store.liveUpdates.findIndex((l) => l.id === id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Live update not found' });
        }
        const removed = store.liveUpdates.splice(index, 1)[0];
        logAudit(
          'DELETE',
          `/api/live-updates/${id}`,
          `Deleted live update "${id}" by ${req.adminUser?.username || 'admin'}`
        );
        saveStoreSync();
        res.json({ success: true, data: removed });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to delete live update' });
      }
    }
  );

  // ==========================================
  // ADMIN AUTHENTICATION & RBAC
  // ==========================================

  // Check whether first-run Chief Admin setup is needed (no secrets returned)
  app.get('/api/admin/bootstrap-status', async (req: Request, res: Response) => {
    try {
      const setupRequired = await isBootstrapRequired();
      res.json({ success: true, setupRequired });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to check bootstrap status' });
    }
  });

  // One-time initial Chief Admin setup (only succeeds when no Chief Admin exists yet)
  app.post(
    '/api/admin/bootstrap',
    loginRateLimitMiddleware,
    async (req: Request, res: Response) => {
      try {
        const parsed = bootstrapAdminSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'अमान्य व्यवस्थापक विवरण',
          });
        }

        const alreadyConfigured = !(await isBootstrapRequired());
        if (alreadyConfigured) {
          return res.status(403).json({
            success: false,
            error: 'प्रारंभिक एडमिन सेटअप पहले ही पूर्ण हो चुका है। कृपया लॉगिन करें।',
          });
        }

        const user = await bootstrapChiefAdmin(parsed.data);
        const session = await createSessionForUser(user.id, {
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
        });

        clearFailedLoginAttempts(req, user.username);
        logAudit('AUTH_BOOTSTRAP', '/api/admin/bootstrap', `Chief Admin account initialized: ${user.username}`);

        res.status(201).json({
          success: true,
          message: 'मुख्य व्यवस्थापक खाता सफलतापूर्वक स्थापित हो गया। न्यूज़रूम CMS में स्वागत है!',
          token: session.rawToken,
          expiresAt: session.expiresAt,
          user,
        });
      } catch (error) {
        if (error instanceof BootstrapConflictError) {
          return res.status(403).json({ success: false, error: error.message });
        }
        if (error instanceof AuthConflictError) {
          return res.status(409).json({ success: false, error: error.message });
        }
        logServerError('POST /api/admin/bootstrap', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  );

  // Admin & Senior Editor Login (scrypt verification + rate limiting + CSPRNG token)
  app.post(
    '/api/admin/login',
    loginRateLimitMiddleware,
    async (req: Request, res: Response) => {
      try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: 'कृपया उपयोगकर्ता नाम (Username) और पासवर्ड (Password) दर्ज करें',
          });
        }

        const { username, password } = parsed.data;
        const user = await authenticateAdmin(username, password);

        if (!user) {
          recordFailedLoginAttempt(req, username);
          logSecurityEvent(
            'AUTH_FAIL',
            '/api/admin/login',
            `Failed login attempt for username: ${username.trim()}`
          );
          return res.status(401).json({
            success: false,
            error: 'अमान्य क्रेडेंशियल्स! सही उपयोगकर्ता नाम और पासवर्ड दर्ज करें।',
          });
        }

        clearFailedLoginAttempts(req, username);
        const session = await createSessionForUser(user.id, {
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
        });

        logAudit('AUTH_SUCCESS', '/api/admin/login', `Authenticated user: ${user.username} (${user.roleCode})`);

        res.json({
          success: true,
          message: 'प्रमाणीकरण सफल रहा। न्यूज़रूम CMS में स्वागत है!',
          token: session.rawToken,
          expiresAt: session.expiresAt,
          user,
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: 'Authentication service error' });
      }
    }
  );

  // Verify active Bearer (or fallback body) token and return sanitized user
  app.post('/api/admin/verify', (req: Request, res: Response) => {
    const token = extractBearerToken(req) || (typeof req.body?.token === 'string' ? req.body.token : null);
    if (!token) {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Unauthorized or session expired',
      });
    }

    const verified = verifySessionToken(token);
    if (!verified) {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Unauthorized or session expired',
      });
    }

    return res.json({
      success: true,
      valid: true,
      expiresAt: verified.session.expiresAt,
      user: verified.user,
    });
  });

  // Current authenticated admin profile
  app.get('/api/admin/me', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      user: req.adminUser,
    });
  });

  // Change password for the currently authenticated admin/editor (revokes all sessions on success)
  app.put(
    '/api/admin/me/password',
    requireAdminAuth,
    passwordChangeRateLimitMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'अमान्य पासवर्ड विवरण',
          });
        }

        const result = await changeAdminPassword({
          userId: req.adminUser!.id,
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
        });

        clearFailedPasswordChangeAttempts(req);
        logAudit(
          'PASSWORD_CHANGE',
          '/api/admin/me/password',
          `Password changed and ${result.revokedSessionsCount} session(s) revoked for user: ${req.adminUser!.username}`
        );

        res.json({
          success: true,
          message:
            'पासवर्ड सफलतापूर्वक बदल दिया गया है। सुरक्षा के लिए सभी सत्र समाप्त कर दिए गए हैं; कृपया नए पासवर्ड से पुनः लॉगिन करें।',
          reauthRequired: true,
          revokedSessionsCount: result.revokedSessionsCount,
        });
      } catch (error) {
        if (error instanceof InvalidCurrentPasswordError) {
          recordFailedPasswordChangeAttempt(req);
          logSecurityEvent(
            'PASSWORD_CHANGE_FAIL',
            '/api/admin/me/password',
            `Invalid current password attempt for user: ${req.adminUser?.username || 'unknown'}`
          );
          return res.status(403).json({ success: false, error: error.message });
        }
        if (error instanceof AuthDomainError) {
          return res.status(400).json({ success: false, error: error.message });
        }
        logServerError('PUT /api/admin/me/password', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }
  );

  // Logout & revoke session immediately
  app.post('/api/admin/logout', async (req: Request, res: Response) => {
    try {
      const token =
        extractBearerToken(req) || (typeof req.body?.token === 'string' ? req.body.token : null);
      if (token) {
        const revoked = await revokeSessionToken(token);
        if (revoked) {
          logAudit('AUTH_LOGOUT', '/api/admin/logout', 'Admin session revoked on logout');
        }
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      logServerError('POST /api/admin/logout', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // Admin User Management (Chief Admin Only)
  app.get(
    '/api/admin/users',
    requireAdminAuth,
    requireRole('chief_admin'),
    (req: AuthenticatedRequest, res: Response) => {
      const users = listAdminUsers();
      res.json({ success: true, count: users.length, data: users });
    }
  );

  app.post(
    '/api/admin/users',
    requireAdminAuth,
    requireRole('chief_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = createAdminUserSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Invalid user payload',
          });
        }

        const created = await createAdminUser(parsed.data);
        logAudit(
          'ADMIN_USER_CREATE',
          '/api/admin/users',
          `Created ${created.roleCode} user ${created.username} by ${req.adminUser?.username}`
        );
        res.status(201).json({ success: true, data: created });
      } catch (error) {
        if (error instanceof AuthConflictError) {
          return res.status(409).json({ success: false, error: error.message });
        }
        if (error instanceof AuthDomainError) {
          return res.status(400).json({ success: false, error: error.message });
        }
        logServerError('POST /api/admin/users', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }
  );

  app.patch(
    '/api/admin/users/:id/status',
    requireAdminAuth,
    requireRole('chief_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid admin user identifier' });
        }

        const parsedBody = updateAdminUserStatusSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json({
            success: false,
            error: parsedBody.error.issues[0]?.message || 'Invalid status payload',
          });
        }

        const updated = await setAdminUserActiveStatus(
          parsedId.data,
          parsedBody.data.isActive,
          req.adminUser!.id
        );
        if (!updated) {
          return res.status(404).json({ success: false, error: 'Admin user not found' });
        }

        logAudit(
          'ADMIN_USER_STATUS',
          `/api/admin/users/${parsedId.data}/status`,
          `Set user ${updated.username} isActive=${updated.isActive} by ${req.adminUser?.username}`
        );
        res.json({ success: true, data: updated });
      } catch (error) {
        if (error instanceof AuthDomainError) {
          return res.status(400).json({ success: false, error: error.message });
        }
        logServerError('PATCH /api/admin/users/:id/status', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }
  );

  app.delete(
    '/api/admin/users/:id',
    requireAdminAuth,
    requireRole('chief_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsedId = idParamSchema.safeParse(req.params.id);
        if (!parsedId.success) {
          return res.status(400).json({ success: false, error: 'Invalid admin user identifier' });
        }

        const removed = await deleteAdminUser(parsedId.data, req.adminUser!.id);
        if (!removed) {
          return res.status(404).json({ success: false, error: 'Admin user not found' });
        }
        logAudit(
          'ADMIN_USER_DELETE',
          '/api/admin/users',
          `Removed admin user ${parsedId.data} by ${req.adminUser?.username}`
        );
        res.json({ success: true, message: 'Admin user removed' });
      } catch (error) {
        if (error instanceof AuthDomainError) {
          return res.status(400).json({ success: false, error: error.message });
        }
        logServerError('DELETE /api/admin/users/:id', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }
  );

  // ==========================================
  // GEMINI AI EDITORIAL ASSISTANT (CMS)
  // ==========================================

  app.post(
    '/api/ai/editorial-assist',
    requireAdminAuth,
    requireRole('chief_admin', 'senior_editor'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = aiEditorialAssistSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || 'Invalid AI editorial request',
          });
        }

        const { task, topic, existingText, category, tone, length } = parsed.data;

        if (!process.env.GEMINI_API_KEY) {
          logAudit(
            'POST',
            '/api/ai/editorial-assist',
            `Editorial AI assist (${task}) by ${req.adminUser?.username || 'admin'}`
          );
          return res.json({
            success: true,
            result: getSimulatedHindiEditorialFallback(task, topic, existingText, category),
            note: 'Generated using built-in Hindi newsroom assistant template.',
          });
        }

      const ai = getGeminiClient();

      let prompt = '';
      if (task === 'generate_headlines') {
        prompt = `आप 'आज का प्रहरी (AKP News)' के मुख्य कॉपी एडिटर हैं। निष्पक्ष, उच्च मानक और प्रभावशाली हिंदी में 5 पत्रकारिता हेडलाइंस तैयार करें:
विषय: "${topic}"
श्रेणी: ${category || 'राष्ट्रीय समाचार'}
दिशानिर्देश:
- स्पष्ट, सशक्त, विश्वसनीय और प्रामाणिक हिंदी भाषा का प्रयोग करें।
- सनसनीखेज या भ्रामक शब्दों से बचें।
- 1 मुख्य हेडलाइन, 1 ब्रेकिंग वायर हेडलाइन, 1 विश्लेषणात्मक हेडलाइन, 1 ग्राउंड रिपोर्ट हेडलाइन और 1 सब-हेडिंग दें।`;
      } else if (task === 'draft_article') {
        prompt = `आप 'आज का प्रहरी (AKP News)' के वरिष्ठ विशेष संवाददाता हैं। एक विस्तृत, तथ्यपरक और उच्च गुणवत्ता वाली हिंदी समाचार रिपोर्ट लिखें:
विषय: "${topic}"
श्रेणी: ${category || 'राष्ट्रीय'}
शैली: ${tone || 'तथ्यपरक, निष्पक्ष, खोजी पत्रकारिता'}
लम्बाई: ${length || '4-5 सुव्यवस्थित परिच्छेद'}

प्रारूप (Clean Markdown):
# मुख्य शीर्षक (Compelling Headline)
*दो पंक्तियों का इटैलिक सारांश (Deck)*

### उपशीर्षक (3-4 अनुभाग)
विस्तृत तथ्यात्मक रिपोर्टिंग, संबंधित अधिकारियों/विशेषज्ञों के वक्तव्य, आर्थिक व सामाजिक प्रभाव।`;
      } else if (task === 'generate_summary') {
        prompt = `आप 'आज का प्रहरी' के वरिष्ठ संपादक हैं। नीचे दिए गए समाचार का 3-4 मुख्य बुलेट बिंदुओं में सार और 1 पंक्ति में मुख्य निष्कर्ष तैयार करें:
समाचार सामग्री:
${existingText || topic}`;
      } else if (task === 'polish_tone') {
        prompt = `आप 'आज का प्रहरी' के मुख्य भाषा संपादक हैं। नीचे दिए गए पाठ का संपादन करें ताकि भाषा शुद्ध, व्याकरण सम्मत और उत्कृष्ट पत्रकारिता शैली (${tone || 'गंभीर व प्रामाणिक'}) में हो:
मूल पाठ:
${existingText}`;
      } else if (task === 'suggest_tags') {
        prompt = `नीचे दिए गए समाचार के लिए 5 उपयोगी SEO टैग और उपयुक्त उप-श्रेणी सुझाएं:
"${topic || existingText}"
JSON प्रारूप में दें: {"tags": ["...", "..."], "subCategory": "..."}`;
      } else {
        prompt = `कृपया इस संपादकीय अनुरोध में सहायता करें: "${topic || existingText}"`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      logAudit(
        'POST',
        '/api/ai/editorial-assist',
        `Editorial AI assist (${task}) by ${req.adminUser?.username || 'admin'}`
      );
      res.json({
        success: true,
        result: response.text || 'No response generated.',
      });
    } catch (error) {
      logServerError('POST /api/ai/editorial-assist', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
  );

  // Return JSON 404 for unknown/removed API endpoints before SPA fallback
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  });

  // Vite middleware for development vs static build in production
  if (!isProductionBundle && process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        dotfiles: 'deny',
      })
    );
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Express error handler — ensures no stack traces, file paths, or raw error messages leak
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
      return;
    }

    if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON request body',
      });
      return;
    }

    if (err && (err as any).type === 'entity.too.large') {
      res.status(413).json({
        success: false,
        error: 'Request payload too large',
      });
      return;
    }

    logServerError(`${req.method} ${req.path}`, err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(` आज का प्रहरी (AKP News) Server running on http://localhost:${PORT}`);
  });

  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try {
      flushScheduledSave();
    } catch (err) {
      logServerError('shutdown.flush', err);
    }
    const forceTimer = setTimeout(() => {
      server.closeAllConnections?.();
      process.exit(0);
    }, 5000);
    forceTimer.unref();

    server.close(() => {
      clearTimeout(forceTimer);
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

function getSimulatedHindiEditorialFallback(
  task: string,
  topic?: string,
  existingText?: string,
  category?: string
): string {
  if (task === 'generate_headlines') {
    return `1. मुख्य हेडलाइन: ${topic || 'राष्ट्रीय विकास योजना'}: नीति आयोग व मंत्रालयों की संयुक्त बैठक में ऐतिहासिक सहमति
2. ब्रेकिंग फ्लैश: बड़ी खबर: ${topic || 'परियोजना'} के लिए केंद्रीय कैबिनेट ने दी ₹25,000 करोड़ के बजट को मंजूरी
3. विश्लेषणात्मक: नीतिगत सुधारों के नए युग में क्या बदलेगा आम नागरिक और औद्योगिक परिदृश्य?
4. ग्राउंड रिपोर्ट: ज़मीनी हकीकत: क्रियान्वयन की रफ्तार और क्षेत्रीय अर्थव्यवस्था पर संभावित असर
5. उपशीर्षक (Deck): अगले वित्तीय वर्ष से देश भर में चरणबद्ध तरीके से लागू होंगे नए मानक व डिजिटल निगरानी तंत्र।`;
  }
  if (task === 'generate_summary') {
    return `• नीतिगत फैसला: संबंधित मंत्रालयों ने उच्चस्तरीय समीक्षा बैठक के बाद नए दिशा-निर्देशों को अंतिम रूप दिया।
• आर्थिक व सामाजिक प्रभाव: नई व्यवस्था से पारदर्शिता में वृद्धि और परिचालन लागत में 18% तक की बचत का अनुमान।
• क्रियान्वयन समय-सीमा: आगामी माह से डिजिटल पोर्टल के माध्यम से सभी 28 राज्यों में निगरानी प्रक्रिया शुरू होगी।
• मुख्य सार (TL;DR): एक व्यापक व दूरगामी ढांचा तैयार किया गया है, जो दीर्घकालिक विकास को गति देगा।`;
  }
  return `### विशेष संपादकीय रिपोर्ट: ${topic || 'राष्ट्रीय विकास एवं समसामयिक परिदृश्य'}

*नीति-निर्माताओं और उद्योग विशेषज्ञों ने नई रूपरेखा को ऐतिहासिक कदम बताते हुए सशक्त क्रियान्वयन पर दिया बल।*

### रणनीतिक प्राथमिकताएं एवं आधारभूत संरचना
प्रस्तावित योजना के अंतर्गत प्राथमिकता के आधार पर ढांचागत सुधारों को गति देने का निर्णय लिया गया है। वरिष्ठ विश्लेषकों का मानना है कि इससे न केवल क्षेत्रीय विषमताओं में कमी आएगी, बल्कि स्थानीय रोजगार सृजन में भी उल्लेखनीय वृद्धि होगी।

### पारदर्शी तंत्र और भविष्य की दिशा
"हमारा ध्येय प्रत्येक नागरिक तक विकास की योजनाओं का सीधा लाभ पहुंचाना है," आज का प्रहरी से विशेष बातचीत में वरिष्ठ अधिकारियों ने रेखांकित किया। अगले चरण में जन-भागीदारी और नियमित ऑडिटिंग की व्यवस्था सुनिश्चित की जा रही है।`;
}

startServer();
