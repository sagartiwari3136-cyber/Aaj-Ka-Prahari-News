import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
} from '../utils/crypto';
import { atomicWriteFileSync } from '../utils/atomicFile';
import { getDataDir } from '../config/env';

export type AdminRoleCode = 'chief_admin' | 'senior_editor';

export interface StoredAdminUser {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  roleCode: AdminRoleCode;
  displayName: string;
  avatarUrl: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserPublic {
  id: string;
  username: string;
  role: string;
  roleCode: AdminRoleCode;
  name: string;
  avatar: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface StoredAdminSession {
  id: string;
  adminUserId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuthStoreData {
  users: StoredAdminUser[];
  sessions: StoredAdminSession[];
}

export class BootstrapConflictError extends Error {
  constructor(message = 'प्रारंभिक एडमिन सेटअप पहले ही पूर्ण हो चुका है। कृपया लॉगिन करें।') {
    super(message);
    this.name = 'BootstrapConflictError';
  }
}

export class AuthConflictError extends Error {
  constructor(message = 'Username already exists.') {
    super(message);
    this.name = 'AuthConflictError';
  }
}

export class AuthDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthDomainError';
  }
}

export class AuthStorageError extends Error {
  public readonly code: 'CORRUPTED_JSON' | 'INVALID_STRUCTURE' | 'READ_ERROR';

  constructor(
    message: string,
    code: 'CORRUPTED_JSON' | 'INVALID_STRUCTURE' | 'READ_ERROR'
  ) {
    super(message);
    this.name = 'AuthStorageError';
    this.code = code;
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor(message = 'वर्तमान पासवर्ड गलत है।') {
    super(message);
    this.name = 'InvalidCurrentPasswordError';
  }
}

const DATA_DIR = getDataDir();
const AUTH_STORE_FILE = path.join(DATA_DIR, 'auth-store.json');

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200';

const ROLE_LABELS: Record<AdminRoleCode, string> = {
  chief_admin: 'मुख्य संपादक (Chief Admin)',
  senior_editor: 'वरिष्ठ संपादक (Senior Editor)',
};

let authCache: AuthStoreData | null = null;
let loadedMtimeMs = 0;
let envSyncPromise: Promise<void> | null = null;
let authWriteQueue: Promise<void> = Promise.resolve();
let authLoadFailed = false;
let authLoadFailureMessage = '';
let authLoadFailureCode: AuthStorageError['code'] = 'CORRUPTED_JSON';

/**
 * Serializes all async auth store mutations (bootstrap, user provisioning, user deletion,
 * password change, status updates) so concurrent requests cannot race across async scrypt
 * hashing and atomic file writes.
 */
function withAuthWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = authWriteQueue.then(operation, operation);
  authWriteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function toPublicUser(user: StoredAdminUser): AdminUserPublic {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    roleCode: user.roleCode,
    name: user.displayName,
    avatar: user.avatarUrl || DEFAULT_AVATAR,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}

function getSessionTtlMs(): number {
  const ttlHours = Number(process.env.ADMIN_SESSION_TTL_HOURS);
  if (!Number.isNaN(ttlHours) && ttlHours > 0) {
    return ttlHours * 60 * 60 * 1000;
  }
  return 8 * 60 * 60 * 1000; // 8 hours default
}

function getSafeAuthFsErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string') {
    return (err as any).code;
  }
  return 'UNKNOWN_FS_ERROR';
}

function readAuthStoreFromDisk(): AuthStoreData {
  if (authLoadFailed) {
    throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
  }

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.warn(
        `[AUTH_STORAGE_WARNING] Data directory did not exist at "${DATA_DIR}" (cwd="${process.cwd()}"). Created directory for first-run auth initialization.`
      );
    } catch (err) {
      authLoadFailed = true;
      authLoadFailureCode = 'READ_ERROR';
      authLoadFailureMessage = `Unable to create or access auth data directory (${getSafeAuthFsErrorCode(err)}).`;
      console.error(`[AUTH_STORAGE_ERROR] ${authLoadFailureMessage}`);
      throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
    }
  }

  // Case 1: Legitimate first-install initialization when auth-store.json does not exist
  if (!fs.existsSync(AUTH_STORE_FILE)) {
    console.warn(
      `[AUTH_STORAGE_INIT] auth-store.json not found at "${AUTH_STORE_FILE}" (cwd="${process.cwd()}"). Initializing fresh auth store.`
    );
    const empty: AuthStoreData = { users: [], sessions: [] };
    atomicWriteFileSync(AUTH_STORE_FILE, JSON.stringify(empty, null, 2), 0o600);
    loadedMtimeMs = fs.statSync(AUTH_STORE_FILE).mtimeMs;
    authCache = empty;
    return authCache;
  }

  // Case 2: Existing auth-store.json -> fail closed on stat/read/parse/structure error
  let stat: fs.Stats;
  try {
    stat = fs.statSync(AUTH_STORE_FILE);
    if (!stat.isFile()) {
      authLoadFailed = true;
      authLoadFailureCode = 'READ_ERROR';
      authLoadFailureMessage = 'auth-store.json path exists but is not a regular file.';
      console.error(`[AUTH_STORAGE_ERROR] ${authLoadFailureMessage}`);
      throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
    }
    if ((stat.mode & 0o777) !== 0o600) {
      fs.chmodSync(AUTH_STORE_FILE, 0o600);
      stat = fs.statSync(AUTH_STORE_FILE);
    }
  } catch (err) {
    if (err instanceof AuthStorageError) throw err;
    authLoadFailed = true;
    authLoadFailureCode = 'READ_ERROR';
    authLoadFailureMessage = `Unable to access auth-store.json (${getSafeAuthFsErrorCode(err)}). Refusing to overwrite or enable bootstrap.`;
    console.error(`[AUTH_STORAGE_ERROR] ${authLoadFailureMessage}`);
    throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
  }

  if (authCache && stat.mtimeMs === loadedMtimeMs) {
    return authCache;
  }

  let raw: string;
  try {
    raw = fs.readFileSync(AUTH_STORE_FILE, 'utf-8');
  } catch (err) {
    authLoadFailed = true;
    authLoadFailureCode = 'READ_ERROR';
    authLoadFailureMessage = `Failed to read auth-store.json (${getSafeAuthFsErrorCode(err)}). Preserving file on disk and refusing empty fallback.`;
    console.error(`[AUTH_STORAGE_ERROR] ${authLoadFailureMessage}`);
    throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    authLoadFailed = true;
    authLoadFailureCode = 'CORRUPTED_JSON';
    authLoadFailureMessage =
      'auth-store.json contains malformed JSON. Preserving corrupted file on disk and refusing empty fallback or admin bootstrap.';
    console.error(`[AUTH_STORAGE_ERROR] ${authLoadFailureMessage}`);
    throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !Array.isArray((parsed as Partial<AuthStoreData>).users) ||
    !Array.isArray((parsed as Partial<AuthStoreData>).sessions)
  ) {
    authLoadFailed = true;
    authLoadFailureCode = 'INVALID_STRUCTURE';
    authLoadFailureMessage =
      'auth-store.json has an invalid structure (users/sessions arrays required). Preserving file on disk and refusing admin bootstrap.';
    console.error(`[AUTH_STORAGE_ERROR] ${authLoadFailureMessage}`);
    throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
  }

  const valid = parsed as AuthStoreData;
  authCache = {
    users: valid.users,
    sessions: valid.sessions,
  };
  loadedMtimeMs = stat.mtimeMs;
  return authCache;
}

function saveAuthStoreToDisk(data: AuthStoreData): void {
  if (authLoadFailed) {
    throw new AuthStorageError(authLoadFailureMessage, authLoadFailureCode);
  }
  const serialized = JSON.stringify(data, null, 2);
  atomicWriteFileSync(AUTH_STORE_FILE, serialized, 0o600);
  loadedMtimeMs = fs.statSync(AUTH_STORE_FILE).mtimeMs;
  authCache = data;
}

async function syncSingleEnvAccount(
  store: AuthStoreData,
  options: {
    username?: string;
    password?: string;
    passwordHash?: string;
    roleCode: AdminRoleCode;
    defaultDisplayName: string;
  }
): Promise<boolean> {
  const username = options.username?.trim();
  const rawPassword = options.password;
  const preHashed = options.passwordHash?.trim();

  if (!username || (!rawPassword && !preHashed)) {
    return false;
  }

  let resolvedHash = preHashed || '';
  if (!resolvedHash && rawPassword) {
    resolvedHash = await hashPassword(rawPassword);
  }
  if (!resolvedHash.startsWith('scrypt$')) {
    return false;
  }

  const now = new Date().toISOString();
  const existing = store.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (existing) {
    let needsUpdate = false;
    if (rawPassword) {
      const matches = await verifyPassword(rawPassword, existing.passwordHash);
      if (!matches) {
        existing.passwordHash = resolvedHash;
        needsUpdate = true;
      }
    } else if (preHashed && existing.passwordHash !== preHashed) {
      existing.passwordHash = preHashed;
      needsUpdate = true;
    }

    if (existing.roleCode !== options.roleCode || !existing.isActive) {
      existing.roleCode = options.roleCode;
      existing.role = ROLE_LABELS[options.roleCode];
      existing.isActive = true;
      needsUpdate = true;
    }

    if (needsUpdate) {
      existing.updatedAt = now;
    }
    return needsUpdate;
  }

  store.users.push({
    id: `adm-${crypto.randomUUID()}`,
    username,
    passwordHash: resolvedHash,
    role: ROLE_LABELS[options.roleCode],
    roleCode: options.roleCode,
    displayName: options.defaultDisplayName,
    avatarUrl: DEFAULT_AVATAR,
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

/**
 * Optionally provisions admin/editor accounts strictly from environment variables.
 * No default fallback passwords exist anywhere in code.
 */
async function syncEnvAccountsInternal(): Promise<void> {
  const initial = readAuthStoreFromDisk();
  const stagedUsers = initial.users.map((u) => ({ ...u }));
  const stagedStore: AuthStoreData = {
    users: stagedUsers,
    sessions: [],
  };
  let changed = false;

  const chiefChanged = await syncSingleEnvAccount(stagedStore, {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    roleCode: 'chief_admin',
    defaultDisplayName: process.env.ADMIN_DISPLAY_NAME || 'राजेश शर्मा',
  });
  if (chiefChanged) changed = true;

  const editorChanged = await syncSingleEnvAccount(stagedStore, {
    username: process.env.EDITOR_USERNAME,
    password: process.env.EDITOR_PASSWORD,
    passwordHash: process.env.EDITOR_PASSWORD_HASH,
    roleCode: 'senior_editor',
    defaultDisplayName: process.env.EDITOR_DISPLAY_NAME || 'संपादकीय डेस्क',
  });
  if (editorChanged) changed = true;

  if (changed) {
    // Re-read fresh store state after async scrypt work so concurrent session/user updates are never overwritten
    const latest = readAuthStoreFromDisk();
    const mergedUsers = latest.users.map((u) => ({ ...u }));
    for (const staged of stagedStore.users) {
      const idx = mergedUsers.findIndex(
        (u) => u.username.toLowerCase() === staged.username.toLowerCase()
      );
      if (idx === -1) {
        mergedUsers.push(staged);
      } else {
        mergedUsers[idx] = {
          ...mergedUsers[idx],
          passwordHash: staged.passwordHash,
          role: staged.role,
          roleCode: staged.roleCode,
          isActive: staged.isActive,
          updatedAt: staged.updatedAt,
        };
      }
    }
    saveAuthStoreToDisk({
      users: mergedUsers,
      sessions: [...latest.sessions],
    });
  }
}

export async function ensureEnvAdminAccountsSynced(): Promise<void> {
  if (envSyncPromise) {
    return envSyncPromise;
  }

  envSyncPromise = withAuthWriteLock(syncEnvAccountsInternal).finally(() => {
    envSyncPromise = null;
  });

  return envSyncPromise;
}

export async function isBootstrapRequired(): Promise<boolean> {
  await ensureEnvAdminAccountsSynced();
  const store = readAuthStoreFromDisk();
  return !store.users.some((u) => u.isActive && u.roleCode === 'chief_admin');
}

export async function bootstrapChiefAdmin(input: {
  username: string;
  password: string;
  name?: string;
}): Promise<AdminUserPublic> {
  return withAuthWriteLock(async () => {
    await syncEnvAccountsInternal();
    const current = readAuthStoreFromDisk();

    if (current.users.some((u) => u.isActive && u.roleCode === 'chief_admin')) {
      throw new BootstrapConflictError();
    }

    const normalizedUsername = input.username.trim();
    const conflict = current.users.find(
      (u) => u.username.toLowerCase() === normalizedUsername.toLowerCase()
    );
    if (conflict) {
      throw new AuthConflictError('Username already exists.');
    }

    const passwordHash = await hashPassword(input.password);

    // Re-read fresh store under lock right before atomic commit
    const latest = readAuthStoreFromDisk();
    if (latest.users.some((u) => u.isActive && u.roleCode === 'chief_admin')) {
      throw new BootstrapConflictError();
    }

    const now = new Date().toISOString();
    const newUser: StoredAdminUser = {
      id: `adm-${crypto.randomUUID()}`,
      username: normalizedUsername,
      passwordHash,
      role: ROLE_LABELS.chief_admin,
      roleCode: 'chief_admin',
      displayName: input.name?.trim() || 'मुख्य संपादक',
      avatarUrl: DEFAULT_AVATAR,
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const nextStore: AuthStoreData = {
      users: [...latest.users, newUser],
      sessions: [...latest.sessions],
    };

    saveAuthStoreToDisk(nextStore);
    return toPublicUser(newUser);
  });
}

export async function authenticateAdmin(
  username: string,
  password: string
): Promise<AdminUserPublic | null> {
  await ensureEnvAdminAccountsSynced();
  const store = readAuthStoreFromDisk();
  const normalized = username.trim().toLowerCase();

  const user = store.users.find(
    (u) => u.isActive && u.username.toLowerCase() === normalized
  );
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return withAuthWriteLock(async () => {
    const fresh = readAuthStoreFromDisk();
    const targetIndex = fresh.users.findIndex((u) => u.id === user.id && u.isActive);
    if (targetIndex === -1) {
      return null;
    }
    const nowIso = new Date().toISOString();
    const updatedUser: StoredAdminUser = {
      ...fresh.users[targetIndex],
      lastLoginAt: nowIso,
      updatedAt: nowIso,
    };
    const nextUsers = fresh.users.map((u, idx) => (idx === targetIndex ? updatedUser : u));
    saveAuthStoreToDisk({ users: nextUsers, sessions: [...fresh.sessions] });
    return toPublicUser(updatedUser);
  });
}

export async function createSessionForUser(
  adminUserId: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ rawToken: string; expiresAt: string; sessionId: string }> {
  return withAuthWriteLock(async () => {
    const store = readAuthStoreFromDisk();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + getSessionTtlMs()).toISOString();

    const activeSessions = store.sessions.filter((s) => {
      const expMs = Date.parse(s.expiresAt);
      return !s.revokedAt && !Number.isNaN(expMs) && expMs > nowMs;
    });

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const sessionId = `sess-${crypto.randomUUID()}`;

    const nextStore: AuthStoreData = {
      users: [...store.users],
      sessions: [
        ...activeSessions,
        {
          id: sessionId,
          adminUserId,
          tokenHash,
          expiresAt,
          revokedAt: null,
          createdAt: nowIso,
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent ? meta.userAgent.slice(0, 250) : null,
        },
      ],
    };

    saveAuthStoreToDisk(nextStore);
    return { rawToken, expiresAt, sessionId };
  });
}

export function verifySessionToken(
  rawToken: string
): { user: AdminUserPublic; session: StoredAdminSession } | null {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
    return null;
  }

  const store = readAuthStoreFromDisk();
  const tokenHash = hashSessionToken(rawToken);
  const nowMs = Date.now();

  const session = store.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session) {
    return null;
  }

  if (session.revokedAt !== null) {
    return null;
  }

  const expMs = Date.parse(session.expiresAt);
  if (Number.isNaN(expMs) || expMs <= nowMs) {
    return null;
  }

  const user = store.users.find((u) => u.id === session.adminUserId && u.isActive);
  if (!user) {
    return null;
  }

  return {
    user: toPublicUser(user),
    session,
  };
}

export async function revokeSessionToken(rawToken: string): Promise<boolean> {
  if (!rawToken || typeof rawToken !== 'string') return false;
  return withAuthWriteLock(async () => {
    const store = readAuthStoreFromDisk();
    const tokenHash = hashSessionToken(rawToken);
    const sessionIndex = store.sessions.findIndex(
      (s) => s.tokenHash === tokenHash && s.revokedAt === null
    );
    if (sessionIndex === -1) return false;

    const nextSessions = store.sessions.map((s, idx) =>
      idx === sessionIndex ? { ...s, revokedAt: new Date().toISOString() } : s
    );
    saveAuthStoreToDisk({ users: [...store.users], sessions: nextSessions });
    return true;
  });
}

export function listAdminUsers(): AdminUserPublic[] {
  const store = readAuthStoreFromDisk();
  return store.users.map(toPublicUser);
}

export async function createAdminUser(input: {
  username: string;
  password: string;
  roleCode: AdminRoleCode;
  name?: string;
  avatar?: string;
}): Promise<AdminUserPublic> {
  return withAuthWriteLock(async () => {
    await syncEnvAccountsInternal();
    const store = readAuthStoreFromDisk();
    const normalizedUsername = input.username.trim();

    const exists = store.users.some(
      (u) => u.username.toLowerCase() === normalizedUsername.toLowerCase()
    );
    if (exists) {
      throw new AuthConflictError('Username already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const latest = readAuthStoreFromDisk();
    if (
      latest.users.some((u) => u.username.toLowerCase() === normalizedUsername.toLowerCase())
    ) {
      throw new AuthConflictError('Username already exists.');
    }

    const now = new Date().toISOString();
    const newUser: StoredAdminUser = {
      id: `adm-${crypto.randomUUID()}`,
      username: normalizedUsername,
      passwordHash,
      role: ROLE_LABELS[input.roleCode],
      roleCode: input.roleCode,
      displayName:
        input.name?.trim() ||
        (input.roleCode === 'chief_admin' ? 'मुख्य संपादक' : 'वरिष्ठ संपादक'),
      avatarUrl: input.avatar?.trim() || DEFAULT_AVATAR,
      isActive: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const nextStore: AuthStoreData = {
      users: [...latest.users, newUser],
      sessions: [...latest.sessions],
    };
    saveAuthStoreToDisk(nextStore);
    return toPublicUser(newUser);
  });
}

export async function changeAdminPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ revokedSessionsCount: number }> {
  return withAuthWriteLock(async () => {
    const store = readAuthStoreFromDisk();
    const targetIndex = store.users.findIndex((u) => u.id === input.userId && u.isActive);
    if (targetIndex === -1) {
      throw new AuthDomainError('Admin account not found or inactive.');
    }

    const target = store.users[targetIndex];
    const currentValid = await verifyPassword(input.currentPassword, target.passwordHash);
    if (!currentValid) {
      throw new InvalidCurrentPasswordError();
    }

    const newHash = await hashPassword(input.newPassword);

    // Re-read fresh store under lock right before atomic commit
    const latest = readAuthStoreFromDisk();
    const latestIndex = latest.users.findIndex((u) => u.id === input.userId && u.isActive);
    if (latestIndex === -1) {
      throw new AuthDomainError('Admin account not found or inactive.');
    }

    const nowIso = new Date().toISOString();
    const updatedUser: StoredAdminUser = {
      ...latest.users[latestIndex],
      passwordHash: newHash,
      updatedAt: nowIso,
    };
    const nextUsers = latest.users.map((u, idx) => (idx === latestIndex ? updatedUser : u));

    let revokedSessionsCount = 0;
    const nextSessions = latest.sessions.map((s) => {
      if (s.adminUserId === input.userId && s.revokedAt === null) {
        revokedSessionsCount += 1;
        return { ...s, revokedAt: nowIso };
      }
      return s;
    });

    saveAuthStoreToDisk({ users: nextUsers, sessions: nextSessions });
    return { revokedSessionsCount };
  });
}

export async function setAdminUserActiveStatus(
  userId: string,
  isActive: boolean,
  actingUserId: string
): Promise<AdminUserPublic | null> {
  if (userId === actingUserId && !isActive) {
    throw new AuthDomainError('Cannot deactivate the currently logged-in admin account.');
  }

  return withAuthWriteLock(async () => {
    const store = readAuthStoreFromDisk();
    const targetIndex = store.users.findIndex((u) => u.id === userId);
    if (targetIndex === -1) return null;

    const target = store.users[targetIndex];
    if (!isActive && target.roleCode === 'chief_admin' && target.isActive) {
      const activeChiefCount = store.users.filter(
        (u) => u.isActive && u.roleCode === 'chief_admin'
      ).length;
      if (activeChiefCount <= 1) {
        throw new AuthDomainError('Cannot deactivate the last active Chief Admin account.');
      }
    }

    const nowIso = new Date().toISOString();
    const updatedUser: StoredAdminUser = {
      ...target,
      isActive,
      updatedAt: nowIso,
    };
    const nextUsers = store.users.map((u, idx) => (idx === targetIndex ? updatedUser : u));

    const nextSessions = !isActive
      ? store.sessions.map((s) =>
          s.adminUserId === userId && s.revokedAt === null ? { ...s, revokedAt: nowIso } : s
        )
      : [...store.sessions];

    saveAuthStoreToDisk({ users: nextUsers, sessions: nextSessions });
    return toPublicUser(updatedUser);
  });
}

export async function deleteAdminUser(userId: string, actingUserId: string): Promise<boolean> {
  if (userId === actingUserId) {
    throw new AuthDomainError('Cannot delete the currently logged-in admin account.');
  }
  return withAuthWriteLock(async () => {
    const store = readAuthStoreFromDisk();
    const targetIndex = store.users.findIndex((u) => u.id === userId);
    if (targetIndex === -1) return false;

    const target = store.users[targetIndex];
    if (target.roleCode === 'chief_admin') {
      const activeChiefCount = store.users.filter(
        (u) => u.isActive && u.roleCode === 'chief_admin'
      ).length;
      if (activeChiefCount <= 1) {
        throw new AuthDomainError('Cannot remove the last active Chief Admin account.');
      }
    }

    const nextUsers = store.users.filter((_, idx) => idx !== targetIndex);
    const nowIso = new Date().toISOString();
    const nextSessions = store.sessions.map((s) =>
      s.adminUserId === userId && !s.revokedAt ? { ...s, revokedAt: nowIso } : s
    );

    saveAuthStoreToDisk({ users: nextUsers, sessions: nextSessions });
    return true;
  });
}
