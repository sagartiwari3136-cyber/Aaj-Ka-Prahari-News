import { Request, Response, NextFunction } from 'express';

interface AttemptBucket {
  failures: number;
  windowStart: number;
  lockedUntil: number | null;
}

const DEFAULT_WINDOW_MS = Number(process.env.ADMIN_LOGIN_WINDOW_MS) || 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS) || 5;
const DEFAULT_LOCKOUT_MS = Number(process.env.ADMIN_LOGIN_LOCKOUT_MS) || 15 * 60 * 1000;

const attemptBuckets = new Map<string, AttemptBucket>();

/**
 * Resolves the effective client IP from Express req.ip (which respects the
 * configured `trust proxy` setting) and normalizes IPv4-mapped IPv6 addresses.
 *
 * NOTE: Rate-limit buckets are stored in process memory and reset on process
 * restart. For multi-instance horizontal scaling behind a load balancer, enforce
 * edge/WAF rate limiting or a shared store in a future phase.
 */
export function getClientIp(req: Request): string {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

function getBucketKey(ip: string, username?: string): string {
  const normalizedUser = (username || '').trim().toLowerCase();
  return normalizedUser ? `${ip}::${normalizedUser}` : `${ip}::__ip__`;
}

function getOrResetBucket(key: string, now: number, windowMs: number): AttemptBucket {
  const existing = attemptBuckets.get(key);
  if (!existing) {
    const fresh: AttemptBucket = { failures: 0, windowStart: now, lockedUntil: null };
    attemptBuckets.set(key, fresh);
    return fresh;
  }

  // If lockout expired, reset bucket
  if (existing.lockedUntil !== null && now >= existing.lockedUntil) {
    const fresh: AttemptBucket = { failures: 0, windowStart: now, lockedUntil: null };
    attemptBuckets.set(key, fresh);
    return fresh;
  }

  // If sliding window expired and not locked, reset bucket
  if (existing.lockedUntil === null && now - existing.windowStart > windowMs) {
    const fresh: AttemptBucket = { failures: 0, windowStart: now, lockedUntil: null };
    attemptBuckets.set(key, fresh);
    return fresh;
  }

  return existing;
}

export function loginRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const ip = getClientIp(req);
  const username = typeof req.body?.username === 'string' ? req.body.username : '';

  const ipKey = getBucketKey(ip);
  const userIpKey = username ? getBucketKey(ip, username) : null;

  const ipBucket = getOrResetBucket(ipKey, now, DEFAULT_WINDOW_MS);
  const userBucket = userIpKey ? getOrResetBucket(userIpKey, now, DEFAULT_WINDOW_MS) : null;

  const activeLock =
    (ipBucket.lockedUntil && ipBucket.lockedUntil > now ? ipBucket.lockedUntil : 0) ||
    (userBucket?.lockedUntil && userBucket.lockedUntil > now ? userBucket.lockedUntil : 0);

  if (activeLock > now) {
    const retryAfterSec = Math.max(1, Math.ceil((activeLock - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      success: false,
      error: `बहुत अधिक असफल लॉगिन प्रयास। कृपया ${retryAfterSec} सेकंड बाद पुनः प्रयास करें।`,
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  next();
}

export function recordFailedLoginAttempt(req: Request, username?: string): void {
  const now = Date.now();
  const ip = getClientIp(req);
  const keys = [getBucketKey(ip)];
  if (username && username.trim()) {
    keys.push(getBucketKey(ip, username));
  }

  for (const key of keys) {
    const bucket = getOrResetBucket(key, now, DEFAULT_WINDOW_MS);
    bucket.failures += 1;
    // Per-IP bucket allows slightly more attempts (2x) if trying different usernames,
    // while per-(IP, username) locks at DEFAULT_MAX_ATTEMPTS
    const limit = key.endsWith('::__ip__') ? DEFAULT_MAX_ATTEMPTS * 2 : DEFAULT_MAX_ATTEMPTS;
    if (bucket.failures >= limit) {
      bucket.lockedUntil = now + DEFAULT_LOCKOUT_MS;
    }
    attemptBuckets.set(key, bucket);
  }
}

export function clearFailedLoginAttempts(req: Request, username?: string): void {
  const ip = getClientIp(req);
  attemptBuckets.delete(getBucketKey(ip));
  if (username && username.trim()) {
    attemptBuckets.delete(getBucketKey(ip, username));
  }
}

const passwordChangeBuckets = new Map<string, AttemptBucket>();

function getOrResetBucketFrom(
  map: Map<string, AttemptBucket>,
  key: string,
  now: number,
  windowMs: number
): AttemptBucket {
  const existing = map.get(key);
  if (!existing) {
    const fresh: AttemptBucket = { failures: 0, windowStart: now, lockedUntil: null };
    map.set(key, fresh);
    return fresh;
  }

  if (existing.lockedUntil !== null && now >= existing.lockedUntil) {
    const fresh: AttemptBucket = { failures: 0, windowStart: now, lockedUntil: null };
    map.set(key, fresh);
    return fresh;
  }

  if (existing.lockedUntil === null && now - existing.windowStart > windowMs) {
    const fresh: AttemptBucket = { failures: 0, windowStart: now, lockedUntil: null };
    map.set(key, fresh);
    return fresh;
  }

  return existing;
}

export function passwordChangeRateLimitMiddleware(
  req: Request & { adminUser?: { id?: string } },
  res: Response,
  next: NextFunction
): void {
  const now = Date.now();
  const ip = getClientIp(req);
  const userId = req.adminUser?.id || 'anonymous';
  const key = `${ip}::pw::${userId}`;
  const bucket = getOrResetBucketFrom(passwordChangeBuckets, key, now, DEFAULT_WINDOW_MS);

  if (bucket.lockedUntil && bucket.lockedUntil > now) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      success: false,
      error: `पासवर्ड बदलने के बहुत अधिक असफल प्रयास। कृपया ${retryAfterSec} सेकंड बाद पुनः प्रयास करें।`,
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  next();
}

export function recordFailedPasswordChangeAttempt(
  req: Request & { adminUser?: { id?: string } }
): void {
  const now = Date.now();
  const ip = getClientIp(req);
  const userId = req.adminUser?.id || 'anonymous';
  const key = `${ip}::pw::${userId}`;
  const bucket = getOrResetBucketFrom(passwordChangeBuckets, key, now, DEFAULT_WINDOW_MS);
  bucket.failures += 1;
  if (bucket.failures >= DEFAULT_MAX_ATTEMPTS) {
    bucket.lockedUntil = now + DEFAULT_LOCKOUT_MS;
  }
  passwordChangeBuckets.set(key, bucket);
}

export function clearFailedPasswordChangeAttempts(
  req: Request & { adminUser?: { id?: string } }
): void {
  const ip = getClientIp(req);
  const userId = req.adminUser?.id || 'anonymous';
  passwordChangeBuckets.delete(`${ip}::pw::${userId}`);
}

/**
 * Periodically prunes stale buckets to prevent unbounded memory growth.
 */
setInterval(() => {
  const now = Date.now();
  for (const map of [attemptBuckets, passwordChangeBuckets]) {
    for (const [key, bucket] of map.entries()) {
      const isLockExpired = bucket.lockedUntil !== null && now >= bucket.lockedUntil;
      const isWindowExpired =
        bucket.lockedUntil === null && now - bucket.windowStart > DEFAULT_WINDOW_MS;
      if (isLockExpired || isWindowExpired) {
        map.delete(key);
      }
    }
  }
}, 5 * 60 * 1000).unref();
