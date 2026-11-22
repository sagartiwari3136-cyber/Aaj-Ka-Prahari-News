import { Request, Response, NextFunction } from 'express';
import {
  AdminRoleCode,
  AdminUserPublic,
  verifySessionToken,
} from '../auth/authStore';

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminUserPublic;
  adminSessionId?: string;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Requires a valid, non-expired, non-revoked admin Bearer session token.
 * Rejects unauthenticated requests with 401.
 */
export function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Missing Bearer token.',
    });
    return;
  }

  const verified = verifySessionToken(token);
  if (!verified) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized or session expired.',
    });
    return;
  }

  req.adminUser = verified.user;
  req.adminSessionId = verified.session.id;
  next();
}

/**
 * Enforces server-side RBAC on authenticated admin requests.
 * Rejects insufficient privileges with 403.
 */
export function requireRole(...allowedRoles: AdminRoleCode[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.adminUser.roleCode)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: insufficient administrative permissions for this operation.',
      });
      return;
    }

    next();
  };
}

/**
 * Resolves an authenticated CMS admin/editor if a valid Bearer session token is present.
 * Returns null for public requests or invalid/expired/revoked tokens (fail closed).
 */
export function resolveOptionalAdminAuth(req: Request): AdminUserPublic | null {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }

  const verified = verifySessionToken(token);
  if (!verified) {
    return null;
  }

  if (
    verified.user.roleCode !== 'chief_admin' &&
    verified.user.roleCode !== 'senior_editor'
  ) {
    return null;
  }

  return verified.user;
}
