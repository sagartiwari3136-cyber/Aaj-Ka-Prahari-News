import {
  Article,
  LiveUpdate,
  MajorState,
  StateNewsItem,
  VideoNewsItem,
  EditorAnchor,
  AnalyticsDashboard,
} from '../types';

export interface AdminUserSession {
  id?: string;
  username: string;
  role: string;
  roleCode?: 'chief_admin' | 'senior_editor';
  name: string;
  avatar: string;
}

export interface AdminManagedUser {
  id: string;
  username: string;
  role: string;
  roleCode: 'chief_admin' | 'senior_editor';
  name: string;
  avatar: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

let inMemoryAuthToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

function notifyIfUnauthorized(res: Response): void {
  if (res.status === 401 && inMemoryAuthToken && unauthorizedHandler) {
    unauthorizedHandler();
  }
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  notifyIfUnauthorized(res);
  try {
    const json = await res.json();
    if (json?.error && typeof json.error === 'string') {
      return json.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return fallback;
}

export const api = {
  setAuthToken(token: string | null): void {
    inMemoryAuthToken = token;
  },

  getAuthToken(): string | null {
    return inMemoryAuthToken;
  },

  setUnauthorizedHandler(handler: (() => void) | null): void {
    unauthorizedHandler = handler;
  },

  getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...(extraHeaders || {}) };
    if (inMemoryAuthToken) {
      headers.Authorization = `Bearer ${inMemoryAuthToken}`;
    }
    return headers;
  },

  // Articles (Public Reads)
  async getArticles(params?: {
    category?: string;
    search?: string;
    tag?: string;
    status?: string;
    featured?: boolean;
    breaking?: boolean;
    limit?: number;
  }): Promise<Article[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.status) query.set('status', params.status);
    if (params?.featured) query.set('featured', 'true');
    if (params?.breaking) query.set('breaking', 'true');
    if (params?.limit) query.set('limit', params.limit.toString());

    const res = await fetch(`/api/articles?${query.toString()}`);
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch articles'));
    const json = await res.json();
    return json.data;
  },

  async getArticleById(id: string): Promise<Article> {
    const res = await fetch(`/api/articles/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Article not found'));
    const json = await res.json();
    return json.data;
  },

  // Articles (Authenticated Admin CMS Reads — includes drafts & archived)
  async getAdminArticles(params?: {
    category?: string;
    search?: string;
    tag?: string;
    status?: string;
    featured?: boolean;
    breaking?: boolean;
    limit?: number;
  }): Promise<Article[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.status) query.set('status', params.status);
    if (params?.featured) query.set('featured', 'true');
    if (params?.breaking) query.set('breaking', 'true');
    if (params?.limit) query.set('limit', params.limit.toString());

    const res = await fetch(`/api/articles?${query.toString()}`, {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch admin articles'));
    const json = await res.json();
    return json.data;
  },

  async getAdminArticleById(id: string): Promise<Article> {
    const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Article not found'));
    const json = await res.json();
    return json.data;
  },

  // Articles (Protected CMS Writes)
  async createArticle(data: Partial<Article>): Promise<Article> {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to create article'));
    const json = await res.json();
    return json.data;
  },

  async updateArticle(id: string, data: Partial<Article>): Promise<Article> {
    const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to update article'));
    const json = await res.json();
    return json.data;
  },

  async deleteArticle(id: string): Promise<void> {
    const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to delete article'));
  },

  // State News (राज्यवार समाचार)
  async getStateNews(state?: MajorState, search?: string): Promise<StateNewsItem[] | Record<MajorState, StateNewsItem[]>> {
    const query = new URLSearchParams();
    if (state) query.set('state', state);
    if (search) query.set('search', search);

    const res = await fetch(`/api/state-news?${query.toString()}`);
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch state news'));
    const json = await res.json();
    return json.data;
  },

  async createStateNews(data: Partial<StateNewsItem>): Promise<StateNewsItem> {
    const res = await fetch('/api/state-news', {
      method: 'POST',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to create state news item'));
    const json = await res.json();
    return json.data;
  },

  async updateStateNews(id: string, data: Partial<StateNewsItem>): Promise<StateNewsItem> {
    const res = await fetch(`/api/state-news/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to update state news item'));
    const json = await res.json();
    return json.data;
  },

  async deleteStateNews(id: string): Promise<void> {
    const res = await fetch(`/api/state-news/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to delete state news item'));
  },

  // Video Bulletins
  async getVideos(params?: { category?: string; anchor?: string; search?: string }): Promise<VideoNewsItem[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.anchor) query.set('anchor', params.anchor);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`/api/videos?${query.toString()}`);
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch videos'));
    const json = await res.json();
    return json.data;
  },

  async createVideo(data: Partial<VideoNewsItem>): Promise<VideoNewsItem> {
    const res = await fetch('/api/videos', {
      method: 'POST',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to create video bulletin'));
    const json = await res.json();
    return json.data;
  },

  async updateVideo(id: string, data: Partial<VideoNewsItem>): Promise<VideoNewsItem> {
    const res = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to update video bulletin'));
    const json = await res.json();
    return json.data;
  },

  async deleteVideo(id: string): Promise<void> {
    const res = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to delete video'));
  },

  // Editors & Anchors
  async getEditors(): Promise<EditorAnchor[]> {
    const res = await fetch('/api/editors');
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch editors'));
    const json = await res.json();
    return json.data;
  },

  async createEditor(data: Partial<EditorAnchor>): Promise<EditorAnchor> {
    const res = await fetch('/api/editors', {
      method: 'POST',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to add editor'));
    const json = await res.json();
    return json.data;
  },

  async updateEditor(id: string, data: Partial<EditorAnchor>): Promise<EditorAnchor> {
    const res = await fetch(`/api/editors/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to update editor'));
    const json = await res.json();
    return json.data;
  },

  async deleteEditor(id: string): Promise<void> {
    const res = await fetch(`/api/editors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to delete editor'));
  },

  // Live Updates
  async getLiveUpdates(): Promise<LiveUpdate[]> {
    const res = await fetch('/api/live-updates');
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch live updates'));
    const json = await res.json();
    return json.data;
  },

  async getAdminLiveUpdates(): Promise<LiveUpdate[]> {
    const res = await fetch('/api/live-updates', {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch admin live updates'));
    const json = await res.json();
    return json.data;
  },

  async createLiveUpdate(data: Partial<LiveUpdate>): Promise<LiveUpdate> {
    const res = await fetch('/api/live-updates', {
      method: 'POST',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to create live update'));
    const json = await res.json();
    return json.data;
  },

  async deleteLiveUpdate(id: string): Promise<void> {
    const res = await fetch(`/api/live-updates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to delete live update'));
  },

  // AI Editorial Assistant (Protected CMS)
  async askAiAssistant(params: {
    task: 'generate_headlines' | 'draft_article' | 'generate_summary' | 'polish_tone' | 'suggest_tags';
    topic?: string;
    existingText?: string;
    category?: string;
    tone?: string;
    length?: string;
  }): Promise<string> {
    const res = await fetch('/api/ai/editorial-assist', {
      method: 'POST',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
    });
    notifyIfUnauthorized(res);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'AI generation failed');
    return json.result;
  },

  // Analytics, Health, Logs, Export & Reset (Chief Admin Only)
  async getAnalyticsDashboard(): Promise<AnalyticsDashboard> {
    const res = await fetch('/api/analytics/dashboard', {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch analytics'));
    const json = await res.json();
    return json.data;
  },

  async getSystemHealth(): Promise<any> {
    const res = await fetch('/api/system/health', {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch system health'));
    return await res.json();
  },

  async getSystemLogs(): Promise<any[]> {
    const res = await fetch('/api/system/logs', {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to fetch system logs'));
    const json = await res.json();
    return json.data;
  },

  async exportBackup(): Promise<Blob> {
    const res = await fetch('/api/system/export', {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to export database backup'));
    return await res.blob();
  },

  async resetData(): Promise<void> {
    const res = await fetch('/api/system/reset', {
      method: 'POST',
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to reset data'));
  },

  // Admin Authentication
  async getBootstrapStatus(): Promise<{ setupRequired: boolean }> {
    const res = await fetch('/api/admin/bootstrap-status');
    if (!res.ok) throw new Error('Failed to check admin setup status');
    const json = await res.json();
    return { setupRequired: Boolean(json.setupRequired) };
  },

  async bootstrapAdmin(payload: {
    username: string;
    password: string;
    name?: string;
  }): Promise<{
    token: string;
    expiresAt?: string;
    user: AdminUserSession;
  }> {
    const res = await fetch('/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'प्रारंभिक सेटअप विफल रहा');
    if (json.token) {
      inMemoryAuthToken = json.token;
    }
    return json;
  },

  async adminLogin(credentials: { username: string; password: string }): Promise<{
    token: string;
    expiresAt?: string;
    user: AdminUserSession;
  }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'लॉगिन विफल रहा');
    if (json.token) {
      inMemoryAuthToken = json.token;
    }
    return json;
  },

  async verifyAdminSession(token?: string): Promise<{
    valid: boolean;
    user: AdminUserSession | null;
  }> {
    const activeToken = token ?? inMemoryAuthToken;
    if (!activeToken) return { valid: false, user: null };
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return { valid: false, user: null };
      const json = await res.json();
      return {
        valid: Boolean(json?.valid),
        user: json?.user || null,
      };
    } catch {
      return { valid: false, user: null };
    }
  },

  async verifyAdmin(token?: string): Promise<boolean> {
    const res = await api.verifyAdminSession(token);
    return res.valid;
  },

  async adminLogout(token?: string): Promise<void> {
    const activeToken = token ?? inMemoryAuthToken;
    inMemoryAuthToken = null;
    if (!activeToken) return;
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({}),
      });
    } catch {
      // ignore network error on logout cleanup
    }
  },

  async changeMyPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string; reauthRequired: boolean; revokedSessionsCount: number }> {
    const res = await fetch('/api/admin/me/password', {
      method: 'PUT',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'पासवर्ड बदलने में विफल रहा'));
    }
    const json = await res.json();
    return {
      message: json.message,
      reauthRequired: Boolean(json.reauthRequired),
      revokedSessionsCount: Number(json.revokedSessionsCount || 0),
    };
  },

  // Admin User Management (Chief Admin Only)
  async getAdminUsers(): Promise<AdminManagedUser[]> {
    const res = await fetch('/api/admin/users', {
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'उपयोगकर्ता सूची लोड करने में विफल रहा'));
    }
    const json = await res.json();
    return json.data || [];
  },

  async createAdminUser(payload: {
    username: string;
    password: string;
    roleCode: 'chief_admin' | 'senior_editor';
    name?: string;
  }): Promise<AdminManagedUser> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'नया उपयोगकर्ता बनाने में विफल रहा'));
    }
    const json = await res.json();
    return json.data;
  },

  async updateAdminUserStatus(id: string, isActive: boolean): Promise<AdminManagedUser> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'उपयोगकर्ता स्थिति अपडेट विफल रहा'));
    }
    const json = await res.json();
    return json.data;
  },

  async deleteAdminUser(id: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'उपयोगकर्ता हटाने में विफल रहा'));
    }
  },
};
