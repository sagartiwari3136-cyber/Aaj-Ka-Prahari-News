import { Request, Response, NextFunction } from 'express';

const SENSITIVE_NO_STORE_PREFIXES = [
  '/api/admin',
  '/api/system',
  '/api/analytics',
  '/api/ai',
  '/api/docs',
  '/admin',
];

function isSensitiveNoStorePath(reqPath: string): boolean {
  const lower = reqPath.toLowerCase();
  return SENSITIVE_NO_STORE_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(`${prefix}/`)
  );
}

export function buildContentSecurityPolicy(isProductionMode: boolean): string {
  const scriptSrc = isProductionMode
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const connectSrc = isProductionMode
    ? "connect-src 'self'"
    : "connect-src 'self' ws: wss:";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https: http: data: blob:",
    "media-src 'self' https: http: blob:",
    connectSrc,
  ].join('; ');
}

export function securityHeadersMiddleware(options: { isProductionMode: boolean }) {
  const cspHeader = buildContentSecurityPolicy(options.isProductionMode);

  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', cspHeader);

    if (options.isProductionMode && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (isSensitiveNoStorePath(req.path)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
}

function isSameOriginBrowserRequest(req: Request, parsedOrigin: URL, trustProxyEnabled: boolean): boolean {
  const requestHost = req.get('host');
  if (!requestHost) return false;

  if (parsedOrigin.host.toLowerCase() !== requestHost.toLowerCase()) {
    return false;
  }

  if (trustProxyEnabled) {
    return parsedOrigin.protocol === `${req.protocol}:`;
  }

  return parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:';
}

/**
 * Strict same-origin / explicit-allowlist CORS policy.
 * - Direct requests without an Origin header pass cleanly without wildcard ACAO headers.
 * - Same-origin requests pass cleanly without emitting permissive cross-origin headers.
 * - Explicitly allowlisted origins in CORS_ALLOWED_ORIGINS receive exact reflected ACAO + Vary: Origin.
 * - Unexpected or malformed cross-origin requests on /api/* or OPTIONS preflight are rejected with 403.
 */
export function corsAndOriginMiddleware(options: {
  allowedOrigins: Set<string>;
  trustProxyEnabled: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.append('Vary', 'Origin');

    const rawOrigin = req.headers.origin;
    if (!rawOrigin || typeof rawOrigin !== 'string') {
      if (req.method === 'OPTIONS' && req.path.startsWith('/api/')) {
        res.status(204).end();
        return;
      }
      next();
      return;
    }

    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(rawOrigin);
    } catch {
      res.status(403).json({
        success: false,
        error: 'Origin not allowed',
      });
      return;
    }

    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
      res.status(403).json({
        success: false,
        error: 'Origin not allowed',
      });
      return;
    }

    const normalizedOrigin = parsedOrigin.origin;
    const isSameOrigin = isSameOriginBrowserRequest(req, parsedOrigin, options.trustProxyEnabled);
    const isExplicitlyAllowed = options.allowedOrigins.has(normalizedOrigin);

    if (!isSameOrigin && !isExplicitlyAllowed) {
      if (req.method === 'OPTIONS' || req.path.startsWith('/api')) {
        res.status(403).json({
          success: false,
          error: 'Origin not allowed by CORS policy',
        });
        return;
      }
      next();
      return;
    }

    if (isExplicitlyAllowed) {
      res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
