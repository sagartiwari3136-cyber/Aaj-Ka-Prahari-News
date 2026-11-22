import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Radio,
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Eye,
  Search,
  Flame,
  Terminal,
  MapPin,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Film,
  Users,
} from 'lucide-react';
import { Article, Category, LiveUpdate } from '../types';
import { api, AdminUserSession } from '../services/api';
import { CmsArticleEditor } from './CmsArticleEditor';
import { BrandLogo } from './BrandLogo';
import { BackendConsoleTab } from './BackendConsoleTab';
import { CmsStateNewsTab } from './CmsStateNewsTab';
import { CmsVideosTab } from './CmsVideosTab';
import { CmsEditorsTab } from './CmsEditorsTab';
import { ConfirmDialog } from './ConfirmDialog';
import { AdminAccountSecurityTab } from './AdminAccountSecurityTab';

const HINDI_PORTAL_CATEGORIES: Category[] = [
  'देश',
  'शहर',
  'क्रिकेट',
  'मनोरंजन',
  'कारोबार',
  'विदेश',
  'तकनीक',
  'लाइफस्टाइल',
  'संपादकीय',
];

const AI_CATEGORY_TO_HINDI: Record<string, Category> = {
  'World Affairs': 'विदेश',
  'Technology & AI': 'तकनीक',
  'Business & Markets': 'कारोबार',
  'Climate & Science': 'देश',
  'Culture & Arts': 'मनोरंजन',
  Sports: 'क्रिकेट',
};

function formatSafeDate(dateStr?: string, locale?: string): string {
  if (!dateStr || Number.isNaN(Date.parse(dateStr))) {
    return 'अमान्य दिनांक';
  }
  return new Date(dateStr).toLocaleDateString(locale);
}

interface CmsDashboardProps {
  onClose: () => void;
  articles: Article[];
  liveUpdates: LiveUpdate[];
  onArticlesChange: () => Promise<void> | void;
  onLiveUpdatesChange: () => Promise<void> | void;
  onSelectArticleForPreview: (article: Article) => void;
  adminUser?: AdminUserSession | null;
  onLogout?: () => void;
  onPasswordChanged?: (noticeMessage: string) => void;
}

export function CmsDashboard({
  onClose,
  articles,
  liveUpdates,
  onArticlesChange,
  onLiveUpdatesChange,
  onSelectArticleForPreview,
  adminUser,
  onLogout,
  onPasswordChanged,
}: CmsDashboardProps) {
  const isChiefAdmin = adminUser?.roleCode === 'chief_admin';
  const [activeTab, setActiveTab] = useState<
    | 'articles'
    | 'state_news'
    | 'videos'
    | 'editors'
    | 'live'
    | 'ai_suite'
    | 'security_access'
    | 'backend_console'
  >('articles');
  const effectiveActiveTab =
    !isChiefAdmin && (activeTab === 'backend_console' || activeTab === 'editors')
      ? 'articles'
      : activeTab;

  const [editingArticle, setEditingArticle] = useState<Article | null | undefined>(undefined);
  const [articleSearch, setArticleSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [confirmTarget, setConfirmTarget] = useState<{
    type: 'article' | 'live_update';
    id: string;
    label: string;
  } | null>(null);
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);

  // Live Wire Dispatch Form State
  const [wireTitle, setWireTitle] = useState('');
  const [wireContent, setWireContent] = useState('');
  const [wireCategory, setWireCategory] = useState<string>('देश');
  const [wireIsBreaking, setWireIsBreaking] = useState(true);
  const [wireAuthor, setWireAuthor] = useState('आज का प्रहरी फास्ट डेस्क');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // AI Suite Playground State
  const [aiTask, setAiTask] = useState<'generate_headlines' | 'draft_article' | 'generate_summary' | 'polish_tone'>('draft_article');
  const [aiTopic, setAiTopic] = useState('');
  const [aiExistingText, setAiExistingText] = useState('');
  const [aiCategory, setAiCategory] = useState('World Affairs');
  const [aiTone, setAiTone] = useState('Authoritative, Objective, Investigative');
  const [aiResult, setAiResult] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Persist new or updated article
  const handleSaveArticle = async (articleData: Article) => {
    const isUpdating = Boolean(editingArticle && editingArticle.id);
    const payload: Partial<Article> = {
      title: articleData.title,
      slug: articleData.slug,
      summary: articleData.summary,
      content: articleData.content,
      category: articleData.category,
      subCategory: articleData.subCategory,
      author: articleData.author,
      publishedAt: articleData.publishedAt,
      readTime: articleData.readTime,
      imageUrl: articleData.imageUrl,
      imageCaption: articleData.imageCaption,
      imagePhotographer: articleData.imagePhotographer,
      isBreaking: articleData.isBreaking,
      isFeatured: articleData.isFeatured,
      isEditorialPick: articleData.isEditorialPick,
      tags: articleData.tags,
      status: articleData.status,
      location: articleData.location,
    };

    if (isUpdating && editingArticle) {
      await api.updateArticle(editingArticle.id, payload);
      setFeedback({
        type: 'success',
        message: `लेख "${articleData.title}" सफलतापूर्वक अपडेट किया गया (${articleData.status})।`,
      });
    } else {
      await api.createArticle(payload);
      setFeedback({
        type: 'success',
        message: `नया लेख "${articleData.title}" सफलतापूर्वक सहेजा गया (${articleData.status})।`,
      });
    }

    await Promise.resolve(onArticlesChange());
    await Promise.resolve(onLiveUpdatesChange());
    setEditingArticle(undefined);
  };

  // Request delete article confirmation
  const handleDeleteArticle = (art: Article) => {
    setConfirmTarget({ type: 'article', id: art.id, label: art.title });
  };

  // Request delete live update confirmation
  const handleDeleteLiveUpdate = (item: LiveUpdate) => {
    setConfirmTarget({ type: 'live_update', id: item.id, label: item.title });
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget || isConfirmProcessing) return;
    setIsConfirmProcessing(true);
    try {
      if (confirmTarget.type === 'article') {
        await api.deleteArticle(confirmTarget.id);
        await Promise.resolve(onArticlesChange());
        setFeedback({
          type: 'success',
          message: `लेख "${confirmTarget.label}" स्थायी रूप से हटा दिया गया।`,
        });
      } else {
        await api.deleteLiveUpdate(confirmTarget.id);
        await Promise.resolve(onLiveUpdatesChange());
        setFeedback({
          type: 'success',
          message: `लाइव अपडेट "${confirmTarget.label}" हटा दिया गया।`,
        });
      }
      setConfirmTarget(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'हटाने की प्रक्रिया विफल रही।',
      });
      setConfirmTarget(null);
    } finally {
      setIsConfirmProcessing(false);
    }
  };

  // Broadcast Live Update
  const handleBroadcastLiveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wireTitle.trim() || !wireContent.trim() || isBroadcasting) return;

    setIsBroadcasting(true);
    try {
      await api.createLiveUpdate({
        title: wireTitle.trim(),
        content: wireContent.trim(),
        category: wireCategory,
        isBreaking: wireIsBreaking,
        author: wireAuthor,
        tag: wireIsBreaking ? 'बड़ी खबर' : 'ताज़ा अपडेट',
      });
      setWireTitle('');
      setWireContent('');
      await Promise.resolve(onLiveUpdatesChange());
      setFeedback({
        type: 'success',
        message: 'लाइव वायर अपडेट सफलतापूर्वक प्रसारित किया गया।',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'लाइव अपडेट प्रसारित करने में विफल रहा।',
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Run AI Suite Assistant
  const handleRunAiSuite = async () => {
    if (!aiTopic && !aiExistingText) {
      setFeedback({
        type: 'error',
        message: 'कृपया AI सहायता के लिए समाचार विषय या प्रारंभिक पाठ दर्ज करें।',
      });
      return;
    }
    setIsAiLoading(true);
    setAiResult('');
    try {
      const res = await api.askAiAssistant({
        task: aiTask,
        topic: aiTopic,
        existingText: aiExistingText,
        category: aiCategory,
        tone: aiTone,
      });
      setAiResult(res);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'AI प्रोसेसिंग विफल रही।',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Editorial inventory metrics
  const totalPublished = articles.filter((a) => a.status === 'published').length;
  const totalDrafts = articles.filter((a) => a.status === 'draft').length;

  // Filtered articles list
  const filteredArticles = articles.filter((a) => {
    if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (articleSearch) {
      const q = articleSearch.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.author.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="bg-[#FAF9F5] min-h-screen py-6 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Newsroom Masthead & Bar */}
        <div className="bg-gradient-to-r from-[#181A1E] via-[#211214] to-[#181A1E] text-white p-6 rounded-2xl border border-red-950/80 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <BrandLogo variant="badge" />
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1 font-hindi-brand">
                <LayoutDashboard className="w-4 h-4" />
                <span>आज का प्रहरी • संपादकीय न्यूज़रूम CMS</span>
              </div>
              <h1 className="font-hindi-brand text-xl sm:text-2xl font-bold tracking-tight text-white">
                Editorial Operations & Fast Wire Publishing Suite
              </h1>
              <p className="text-xs text-zinc-400 mt-1 font-hindi-brand">
                लाइव वायर बुलेटिन, विस्तृत रिपोर्टिंग, राज्य समाचार प्रबंधन और Gemini AI ड्राफ्टिंग सूट।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {adminUser && (
              <div className="hidden sm:flex items-center gap-2 bg-zinc-900/90 border border-zinc-700/80 px-3 py-1.5 rounded-xl text-left">
                <div className="w-7 h-7 rounded-full bg-red-600/80 text-white flex items-center justify-center font-bold text-xs uppercase border border-amber-400/40">
                  {adminUser.username.substring(0, 1)}
                </div>
                <div>
                  <div className="text-xs font-bold text-white font-hindi-brand leading-none">
                    {adminUser.name || adminUser.username}
                  </div>
                  <div className="text-[10px] text-amber-300 font-hindi-brand">
                    {adminUser.role}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setEditingArticle(null)}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Story</span>
            </button>

            <button
              onClick={onClose}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Back to Reader Portal
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/80 font-semibold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="एडमिन लॉगआउट करें"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">लॉगआउट</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Status / Error Feedback */}
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
              feedback.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded hover:bg-black/5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={Boolean(confirmTarget)}
          title={
            confirmTarget?.type === 'article'
              ? 'लेख हटाने की पुष्टि करें'
              : 'लाइव अपडेट हटाने की पुष्टि करें'
          }
          message={
            confirmTarget
              ? `क्या आप सचमुच "${confirmTarget.label}" को स्थायी रूप से हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।`
              : ''
          }
          confirmLabel="स्थायी रूप से हटाएं"
          cancelLabel="रद्द करें"
          tone="danger"
          theme="light"
          isProcessing={isConfirmProcessing}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (!isConfirmProcessing) setConfirmTarget(null);
          }}
        />

        {/* Editor Modal Overlay if editing/creating */}
        {editingArticle !== undefined && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <CmsArticleEditor
              article={editingArticle}
              onSave={handleSaveArticle}
              onCancel={() => setEditingArticle(undefined)}
            />
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase">
              <span>Published Stories</span>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-950 mt-2">{totalPublished}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">{totalDrafts} drafts in queue</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase">
              <span>Live Dispatches</span>
              <Radio className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-950 mt-2">{liveUpdates.length}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Streaming wire feeds</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold uppercase">
              <span>Portal Mode</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-950 mt-2">Read-Only</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Authenticated CMS publishing only</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border border-zinc-200 rounded-xl p-1.5 flex items-center gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('articles')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              effectiveActiveTab === 'articles'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Articles Manager ({articles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('state_news')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              effectiveActiveTab === 'state_news'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span>राज्य समाचार (State News)</span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              effectiveActiveTab === 'videos'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <Film className="w-4 h-4 text-red-600" />
            <span>वीडियो बुलेटिन (Videos)</span>
          </button>

          {isChiefAdmin && (
            <button
              onClick={() => setActiveTab('editors')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                effectiveActiveTab === 'editors'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <span>संपादकीय मंडल (Editors)</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              effectiveActiveTab === 'live'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <Radio className="w-4 h-4 text-rose-500" />
            <span>Live Wire Broadcaster ({liveUpdates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_suite')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              effectiveActiveTab === 'ai_suite'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Gemini AI Newsroom Suite</span>
          </button>

          <button
            onClick={() => setActiveTab('security_access')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              effectiveActiveTab === 'security_access'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>{isChiefAdmin ? 'खाता सुरक्षा व उपयोगकर्ता' : 'खाता सुरक्षा'}</span>
          </button>

          {isChiefAdmin && (
            <button
              onClick={() => setActiveTab('backend_console')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                effectiveActiveTab === 'backend_console'
                  ? 'bg-zinc-900 text-white shadow-xs ring-1 ring-red-500'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              <Terminal className="w-4 h-4 text-red-500" />
              <span>बैकएंड कंसोल व API Explorer</span>
            </button>
          )}
        </div>

        {/* TAB 1: ARTICLES MANAGER */}
        {effectiveActiveTab === 'articles' && (
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative w-full max-w-xs">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search articles by title, author, tag..."
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 focus:outline-hidden focus:border-zinc-800"
                  />
                </div>

                <select
                  aria-label="Filter by desk category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-zinc-50 border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-800"
                >
                  <option value="All">सभी डेस्क (All Desks)</option>
                  {HINDI_PORTAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-zinc-50 border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-800"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingArticle(null)}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>New Story</span>
                </button>
              </div>
            </div>

            {/* Articles Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Story & Headline</th>
                    <th className="py-3 px-4">Desk</th>
                    <th className="py-3 px-4">Author</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Published</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredArticles.map((art) => (
                    <tr key={art.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-start gap-3">
                          <img
                            src={art.imageUrl}
                            alt={art.title}
                            className="w-12 h-12 rounded object-cover shrink-0 border border-zinc-200"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              {art.isBreaking && (
                                <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                  Breaking
                                </span>
                              )}
                              {art.isFeatured && (
                                <span className="bg-amber-500 text-zinc-950 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                  Featured Lead
                                </span>
                              )}
                            </div>
                            <h4 className="font-serif-headline font-bold text-zinc-950 text-xs sm:text-sm leading-snug line-clamp-1">
                              {art.title}
                            </h4>
                            <span className="text-[10px] text-zinc-400 font-mono-data">
                              {formatSafeDate(art.publishedAt)} • {art.readTime}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-zinc-900 whitespace-nowrap">
                        <span className="bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded text-[11px]">
                          {art.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-zinc-900">{art.author.name}</div>
                        <div className="text-[10px] text-zinc-400">{art.author.role}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            art.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800'
                              : art.status === 'draft'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-zinc-200 text-zinc-700'
                          }`}
                        >
                          {art.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-zinc-500 font-mono-data text-[11px]">
                        <div>{formatSafeDate(art.publishedAt, 'hi-IN')}</div>
                        <div className="text-zinc-400">{art.location || 'राष्ट्रीय डेस्क'}</div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectArticleForPreview(art)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded"
                            title="Preview Article"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingArticle(art)}
                            className="p-1.5 text-zinc-600 hover:text-blue-600 hover:bg-zinc-100 rounded"
                            title="Edit Article"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteArticle(art)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 rounded"
                            title="Delete Article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE WIRE BROADCASTER */}
        {effectiveActiveTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Broadcast Form */}
            <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 text-rose-700 text-xs font-bold uppercase tracking-wider mb-2">
                <Radio className="w-4 h-4" />
                <span>Instant Wire Broadcaster</span>
              </div>

              <h3 className="font-masthead text-xl font-bold text-zinc-950 mb-1">
                Publish Live Breaking Dispatch
              </h3>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                Dispatches immediately beam to the public breaking news ticker and real-time live feed stream.
              </p>

              <form onSubmit={handleBroadcastLiveUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                    Wire Headline <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Delegates approve $120B clean grid accord in Brussels"
                    value={wireTitle}
                    onChange={(e) => setWireTitle(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2.5 text-xs text-zinc-950 font-bold focus:bg-white focus:outline-hidden focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                    Dispatch Content / Minute-by-Minute Details <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Provide 1-2 factual paragraphs with key figures, quotes, or timeline details..."
                    value={wireContent}
                    onChange={(e) => setWireContent(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2.5 text-xs text-zinc-800 focus:bg-white focus:outline-hidden focus:border-zinc-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Desk</label>
                    <select
                      value={wireCategory}
                      onChange={(e) => setWireCategory(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2 text-xs font-semibold"
                    >
                      {HINDI_PORTAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Reporter</label>
                    <input
                      type="text"
                      value={wireAuthor}
                      onChange={(e) => setWireAuthor(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-red-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wireIsBreaking}
                      onChange={(e) => setWireIsBreaking(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <Flame className="w-4 h-4" />
                    <span>Broadcast with High-Priority Breaking Alert Badge</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="w-full bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>{isBroadcasting ? 'Broadcasting...' : 'Broadcast Live Dispatch'}</span>
                </button>
              </form>
            </div>

            {/* Active Live Updates List */}
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200">
                <h3 className="font-masthead text-lg font-bold text-zinc-950">
                  Active Live Dispatches ({liveUpdates.length})
                </h3>
                <span className="text-xs text-zinc-400">Chronological wire feed</span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {liveUpdates.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50/50 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {item.isBreaking ? (
                          <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                            Breaking
                          </span>
                        ) : (
                          <span className="bg-zinc-800 text-zinc-200 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                            {item.tag || item.category}
                          </span>
                        )}
                        <span className="text-[10px] font-mono-data text-zinc-400 font-bold">
                          {item.timestamp}
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="text-[11px] text-zinc-600 font-medium">By {item.author}</span>
                      </div>

                      <h4 className="font-bold text-xs text-zinc-950 leading-snug mb-1">{item.title}</h4>
                      <p className="text-zinc-600 text-xs line-clamp-2 leading-relaxed">{item.content}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteLiveUpdate(item)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-zinc-200/60 rounded"
                      title="Delete live update"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GEMINI AI NEWSROOM SUITE */}
        {effectiveActiveTab === 'ai_suite' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>AI Editorial Assistant</span>
              </div>

              <h3 className="font-masthead text-xl font-bold text-zinc-950">
                Gemini 3.7 Flash Newsroom Engine
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Generate compelling journalistic headlines, draft in-depth multi-section stories, summarize investigations, or polish reporting tone.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                  Editorial Task
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                  {[
                    { id: 'draft_article', label: 'Draft Full Article' },
                    { id: 'generate_headlines', label: '5 Headline Ideas' },
                    { id: 'generate_summary', label: 'Executive Summary' },
                    { id: 'polish_tone', label: 'Polish Tone' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAiTask(t.id as any)}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        aiTask === t.id
                          ? 'bg-zinc-900 text-white font-bold border-zinc-900 shadow-xs'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                  Story Topic or Preliminary Outline
                </label>
                <input
                  type="text"
                  placeholder="e.g. Breakthrough in next-gen solid state battery chemistry..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2.5 text-xs text-zinc-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                  Article Text (for summarizing or polishing)
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste rough text here to polish or summarize..."
                  value={aiExistingText}
                  onChange={(e) => setAiExistingText(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2.5 text-xs text-zinc-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Desk</label>
                  <select
                    value={aiCategory}
                    onChange={(e) => setAiCategory(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="World Affairs">World Affairs</option>
                    <option value="Technology & AI">Technology & AI</option>
                    <option value="Business & Markets">Business & Markets</option>
                    <option value="Climate & Science">Climate & Science</option>
                    <option value="Culture & Arts">Culture & Arts</option>
                    <option value="Sports">Sports</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Tone</label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="Authoritative, Objective, Investigative">Authoritative & Investigative</option>
                    <option value="Fast Wire & Breaking">Fast Wire & Breaking</option>
                    <option value="Financial & Macroeconomic">Financial & Markets</option>
                    <option value="In-Depth Longform Feature">In-Depth Longform</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunAiSuite}
                disabled={isAiLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAiLoading ? 'Gemini AI Generating...' : 'Generate with Gemini AI'}</span>
              </button>
            </div>

            {/* AI Output Terminal */}
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="font-masthead text-lg font-bold text-zinc-950">
                    Generated Editorial Output
                  </h3>
                </div>
                {aiResult && (
                  <button
                    onClick={() => {
                      setEditingArticle({
                        id: '',
                        title: aiTopic || 'AI द्वारा तैयार संपादकीय मसौदा',
                        slug: '',
                        summary: 'Gemini AI न्यूज़़रूम असिस्टेंट द्वारा तैयार संक्षिप्त सार',
                        content: aiResult,
                        category: AI_CATEGORY_TO_HINDI[aiCategory] || 'देश',
                        author: {
                          name: 'राजेश शर्मा',
                          role: 'प्रधान संपादक',
                          avatar:
                            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
                        },
                        publishedAt: new Date().toISOString(),
                        readTime: '5 मिनट',
                        imageUrl:
                          'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&q=80&w=1200',
                        tags: ['संपादकीय', 'विश्लेषण'],
                        status: 'draft',
                      });
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <span>Import to Story Composer →</span>
                  </button>
                )}
              </div>

              <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl p-4 overflow-y-auto max-h-[500px]">
                {isAiLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 text-zinc-400 space-y-3">
                    <Sparkles className="w-8 h-8 text-amber-500 animate-spin" />
                    <p className="text-xs font-semibold">Gemini 3.7 Flash analyzing journalistic context...</p>
                  </div>
                ) : aiResult ? (
                  <div className="prose prose-zinc max-w-none text-xs sm:text-sm font-serif-headline leading-relaxed whitespace-pre-wrap">
                    {aiResult}
                  </div>
                ) : (
                  <div className="text-center py-16 text-zinc-400 space-y-2">
                    <Sparkles className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                    <p className="text-xs font-medium">Your generated headlines or drafted articles will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: STATE NEWS MANAGER */}
        {effectiveActiveTab === 'state_news' && <CmsStateNewsTab />}

        {/* TAB: VIDEO BULLETINS MANAGER */}
        {effectiveActiveTab === 'videos' && <CmsVideosTab />}

        {/* TAB: EDITORS & ANCHORS MANAGER (Chief Admin Only) */}
        {isChiefAdmin && effectiveActiveTab === 'editors' && <CmsEditorsTab />}

        {/* TAB: ACCOUNT SECURITY & USER MANAGEMENT */}
        {effectiveActiveTab === 'security_access' && (
          <AdminAccountSecurityTab
            adminUser={adminUser}
            onPasswordChanged={onPasswordChanged}
          />
        )}

        {/* TAB: BACKEND CONSOLE & REST API EXPLORER (Chief Admin Only) */}
        {isChiefAdmin && effectiveActiveTab === 'backend_console' && (
          <BackendConsoleTab onDatabaseReset={onArticlesChange} />
        )}
      </div>
    </div>
  );
}
