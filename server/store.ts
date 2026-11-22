import fs from 'fs';
import path from 'path';
import {
  Article,
  LiveUpdate,
  MajorState,
  StateNewsItem,
  VideoNewsItem,
  EditorAnchor,
} from '../src/types';
import { INITIAL_ARTICLES, INITIAL_LIVE_UPDATES } from '../src/data/initialData';
import { INITIAL_EDITORS_ANCHORS, INITIAL_STATE_NEWS, INITIAL_VIDEO_NEWS } from '../src/data/editorsAndMediaData';
import { atomicWriteFileSync } from './utils/atomicFile';
import { getDataDir } from './config/env';

export interface AuditLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  details: string;
}

export interface AppStoreData {
  articles: Article[];
  stateNews: Record<MajorState, StateNewsItem[]>;
  videos: VideoNewsItem[];
  editors: EditorAnchor[];
  liveUpdates: LiveUpdate[];
  logs: AuditLog[];
  lastSavedAt: string;
}

const DATA_DIR = getDataDir();
const STORE_FILE = path.join(DATA_DIR, 'store.json');

function getDefaultStoreData(): AppStoreData {
  return {
    articles: [...INITIAL_ARTICLES],
    stateNews: JSON.parse(JSON.stringify(INITIAL_STATE_NEWS)),
    videos: [...INITIAL_VIDEO_NEWS],
    editors: [...INITIAL_EDITORS_ANCHORS],
    liveUpdates: [...INITIAL_LIVE_UPDATES],
    logs: [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: 'SYSTEM',
        endpoint: '/api/init',
        details: 'Store initialized with authoritative Hindi media content & regional state feeds.',
      },
    ],
    lastSavedAt: new Date().toISOString(),
  };
}

export class StoreStorageError extends Error {
  public readonly code: 'CORRUPTED_JSON' | 'INVALID_STRUCTURE' | 'READ_ERROR';

  constructor(
    message: string,
    code: 'CORRUPTED_JSON' | 'INVALID_STRUCTURE' | 'READ_ERROR'
  ) {
    super(message);
    this.name = 'StoreStorageError';
    this.code = code;
  }
}

let store: AppStoreData | null = null;
let saveTimeout: NodeJS.Timeout | null = null;
let isWritingStore = false;
let pendingReschedule = false;
let storeLoadFailed = false;
let storeLoadFailureMessage = '';
let storeLoadFailureCode: StoreStorageError['code'] = 'CORRUPTED_JSON';

export function getStoreFilePath(): string {
  return STORE_FILE;
}

export function isStoreLoadFailed(): boolean {
  return storeLoadFailed;
}

function getSafeFsErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string') {
    return (err as any).code;
  }
  return 'UNKNOWN_FS_ERROR';
}

export function getStore(): AppStoreData {
  if (storeLoadFailed) {
    throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
  }
  if (store) return store;

  const dataDirExisted = fs.existsSync(DATA_DIR);
  if (!dataDirExisted) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.warn(
        `[STORAGE_WARNING] Data directory did not exist at "${DATA_DIR}" (cwd="${process.cwd()}"). Created directory for first-run initialization; verify persistent volume mount and working directory in production.`
      );
    } catch (err) {
      storeLoadFailed = true;
      storeLoadFailureCode = 'READ_ERROR';
      storeLoadFailureMessage = `Unable to create or access data directory (${getSafeFsErrorCode(err)}).`;
      console.error(`[STORAGE_ERROR] ${storeLoadFailureMessage}`);
      throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
    }
  }

  // Case 1: Legitimate first-install initialization when store.json does not exist
  if (!fs.existsSync(STORE_FILE)) {
    console.warn(
      `[STORAGE_INIT] store.json not found at "${STORE_FILE}" (cwd="${process.cwd()}"). Initializing fresh editorial store; if existing data was expected, check working directory and persistent volume mount.`
    );
    const freshStore = getDefaultStoreData();
    persistStoreSnapshot(freshStore, STORE_FILE);
    store = freshStore;
    return store;
  }

  // Case 2: Existing store.json -> MUST read, parse, and validate strictly (fail-closed)
  let stat: fs.Stats;
  try {
    stat = fs.statSync(STORE_FILE);
    if (!stat.isFile()) {
      storeLoadFailed = true;
      storeLoadFailureCode = 'READ_ERROR';
      storeLoadFailureMessage = 'store.json path exists but is not a regular file.';
      console.error(`[STORAGE_ERROR] ${storeLoadFailureMessage}`);
      throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
    }
    if ((stat.mode & 0o777) !== 0o600) {
      fs.chmodSync(STORE_FILE, 0o600);
    }
  } catch (err) {
    if (err instanceof StoreStorageError) throw err;
    storeLoadFailed = true;
    storeLoadFailureCode = 'READ_ERROR';
    storeLoadFailureMessage = `Unable to access store.json (${getSafeFsErrorCode(err)}). Refusing to overwrite or fall back to default data.`;
    console.error(`[STORAGE_ERROR] ${storeLoadFailureMessage}`);
    throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(STORE_FILE, 'utf-8');
  } catch (err) {
    storeLoadFailed = true;
    storeLoadFailureCode = 'READ_ERROR';
    storeLoadFailureMessage = `Failed to read store.json (${getSafeFsErrorCode(err)}). Preserving file on disk and refusing default fallback.`;
    console.error(`[STORAGE_ERROR] ${storeLoadFailureMessage}`);
    throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storeLoadFailed = true;
    storeLoadFailureCode = 'CORRUPTED_JSON';
    storeLoadFailureMessage =
      'store.json contains malformed JSON. Preserving corrupted file on disk and refusing to load default data.';
    console.error(`[STORAGE_ERROR] ${storeLoadFailureMessage}`);
    throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !Array.isArray((parsed as Partial<AppStoreData>).articles)
  ) {
    storeLoadFailed = true;
    storeLoadFailureCode = 'INVALID_STRUCTURE';
    storeLoadFailureMessage =
      'store.json has an invalid root structure (missing articles array). Preserving file on disk and refusing default fallback.';
    console.error(`[STORAGE_ERROR] ${storeLoadFailureMessage}`);
    throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
  }

  const validStore = parsed as AppStoreData;
  if (!validStore.stateNews || typeof validStore.stateNews !== 'object') {
    validStore.stateNews = JSON.parse(JSON.stringify(INITIAL_STATE_NEWS));
  }
  if (!Array.isArray(validStore.videos)) validStore.videos = [...INITIAL_VIDEO_NEWS];
  if (!Array.isArray(validStore.editors)) validStore.editors = [...INITIAL_EDITORS_ANCHORS];
  if (!Array.isArray(validStore.liveUpdates)) validStore.liveUpdates = [];
  if (!Array.isArray(validStore.logs)) validStore.logs = [];

  store = validStore;
  return store;
}

export function persistStoreSnapshot(targetStore: AppStoreData, filePath = STORE_FILE): void {
  if (storeLoadFailed && path.resolve(filePath) === path.resolve(STORE_FILE)) {
    throw new StoreStorageError(
      'Refusing to overwrite store.json while storage is in a corrupted/failed state.',
      storeLoadFailureCode
    );
  }

  const prevSavedAt = targetStore.lastSavedAt;
  const nextSavedAt = new Date().toISOString();
  targetStore.lastSavedAt = nextSavedAt;

  try {
    const serialized = JSON.stringify(targetStore, null, 2);
    atomicWriteFileSync(filePath, serialized, 0o600);
  } catch (err) {
    targetStore.lastSavedAt = prevSavedAt;
    throw err;
  }
}

export function saveStoreSync(): void {
  if (storeLoadFailed || !store) return;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (isWritingStore) {
    pendingReschedule = true;
    return;
  }

  isWritingStore = true;
  try {
    persistStoreSnapshot(store, STORE_FILE);
  } finally {
    isWritingStore = false;
    if (pendingReschedule) {
      pendingReschedule = false;
      scheduleSaveStore();
    }
  }
}

export function scheduleSaveStore(): void {
  if (storeLoadFailed || !store) return;
  if (isWritingStore) {
    pendingReschedule = true;
    return;
  }
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    if (storeLoadFailed || !store) return;
    try {
      saveStoreSync();
    } catch (err) {
      console.error('Scheduled store persistence failed:', err);
    }
  }, 300);
}

export function flushScheduledSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!storeLoadFailed && store) {
    saveStoreSync();
  }
}

const MAX_MEMORY_SECURITY_EVENTS = 50;
const securityEvents: AuditLog[] = [];

/**
 * Records a bounded in-memory authentication security event (e.g. failed login)
 * without mutating store.logs or triggering disk writes to data/store.json.
 */
export function logSecurityEvent(method: string, endpoint: string, details: string): void {
  const event: AuditLog = {
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    method,
    endpoint,
    details,
  };
  securityEvents.unshift(event);
  if (securityEvents.length > MAX_MEMORY_SECURITY_EVENTS) {
    securityEvents.pop();
  }
  console.warn(`[SECURITY] ${event.timestamp} ${method} ${endpoint}: ${details}`);
}

export function getSecurityEvents(): AuditLog[] {
  return [...securityEvents];
}

export function logAudit(method: string, endpoint: string, details: string): void {
  const currentStore = getStore();
  const logItem: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    method,
    endpoint,
    details,
  };
  currentStore.logs.unshift(logItem);
  if (currentStore.logs.length > 100) {
    currentStore.logs.pop();
  }
  scheduleSaveStore();
}

export function resetStore(): AppStoreData {
  if (storeLoadFailed) {
    throw new StoreStorageError(storeLoadFailureMessage, storeLoadFailureCode);
  }
  const freshStore = getDefaultStoreData();
  persistStoreSnapshot(freshStore, STORE_FILE);
  store = freshStore;
  return store;
}
