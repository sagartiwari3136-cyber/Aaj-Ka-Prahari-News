import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Article, LiveUpdate } from '../types';
import { api, AdminUserSession } from '../services/api';
import { AdminLoginModal } from '../components/AdminLoginModal';
import { CmsDashboard } from '../components/CmsDashboard';
import { ArticleReaderModal } from '../components/ArticleReaderModal';
import {
  getStoredAdminSessionToken,
  setStoredAdminSessionToken,
  purgeLegacyLocalAdminStorage,
} from '../utils/router';

interface AdminRoutesProps {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export default function AdminRoutes({ pathname, navigate }: AdminRoutesProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [adminUser, setAdminUser] = useState<AdminUserSession | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([]);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  const clearSessionState = useCallback(() => {
    api.setAuthToken(null);
    setStoredAdminSessionToken(null);
    setAdminUser(null);
    setArticles([]);
    setLiveUpdates([]);
    setPreviewArticle(null);
    setAuthStatus('unauthenticated');
  }, []);

  // Verify on mount and whenever navigating onto protected admin routes
  useEffect(() => {
    let active = true;

    api.setUnauthorizedHandler(() => {
      if (!active) return;
      clearSessionState();
      navigate('/admin/login', { replace: true });
    });

    (async () => {
      purgeLegacyLocalAdminStorage();
      const token = api.getAuthToken() || getStoredAdminSessionToken();

      if (!token) {
        if (active) clearSessionState();
        return;
      }

      if (active) setAuthStatus('checking');
      api.setAuthToken(token);
      const verified = await api.verifyAdminSession(token);
      if (!active) return;

      if (verified.valid && verified.user) {
        setAdminUser(verified.user);
        setAuthStatus('authenticated');
      } else {
        clearSessionState();
      }
    })();

    return () => {
      active = false;
      api.setUnauthorizedHandler(null);
    };
  }, [pathname, clearSessionState, navigate]);

  // Enforce route redirects based on verified authStatus
  useEffect(() => {
    if (authStatus === 'checking') return;

    if (pathname === '/admin/login') {
      if (authStatus === 'authenticated') {
        navigate('/admin/dashboard', { replace: true });
      }
      return;
    }

    if (pathname === '/admin/dashboard') {
      if (authStatus === 'unauthenticated') {
        navigate('/admin/login', { replace: true });
      }
      return;
    }

    // For /admin or any unknown /admin/* subpath
    if (authStatus === 'authenticated') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/admin/login', { replace: true });
    }
  }, [authStatus, pathname, navigate]);

  const loadCmsData = useCallback(async () => {
    try {
      const [fetchedArticles, fetchedUpdates] = await Promise.allSettled([
        api.getAdminArticles(),
        api.getAdminLiveUpdates(),
      ]);

      if (fetchedArticles.status === 'fulfilled') {
        setArticles(fetchedArticles.value);
      }
      if (fetchedUpdates.status === 'fulfilled') {
        setLiveUpdates(fetchedUpdates.value);
      }
    } catch (err) {
      console.error('Failed to load CMS data:', err);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated' && pathname === '/admin/dashboard') {
      loadCmsData();
    }
  }, [authStatus, pathname, loadCmsData]);

  const handleLoginSuccess = (data: { token: string; user: AdminUserSession }) => {
    setLoginNotice(null);
    api.setAuthToken(data.token);
    setStoredAdminSessionToken(data.token);
    setAdminUser(data.user);
    setAuthStatus('authenticated');
    navigate('/admin/dashboard', { replace: true });
  };

  const handleLogout = async () => {
    setLoginNotice(null);
    const token = api.getAuthToken() || getStoredAdminSessionToken() || undefined;
    await api.adminLogout(token);
    clearSessionState();
    navigate('/admin/login', { replace: false });
  };

  const handlePasswordChanged = (noticeMessage: string) => {
    setLoginNotice(noticeMessage);
    clearSessionState();
    navigate('/admin/login', { replace: true });
  };

  const previewRelatedArticles = useMemo(() => {
    if (!previewArticle) return [];
    return articles
      .filter((a) => a.id !== previewArticle.id && a.category === previewArticle.category)
      .slice(0, 3);
  }, [articles, previewArticle]);

  // Never render protected CMS content while verifying or redirecting
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#111317] text-zinc-200 flex flex-col items-center justify-center p-6 font-hindi-brand">
        <div className="w-11 h-11 rounded-xl bg-red-700/20 border border-red-500/40 flex items-center justify-center mb-3 animate-pulse">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
        </div>
        <p className="text-sm font-bold text-white">सत्र सत्यापित किया जा रहा है...</p>
        <p className="text-xs text-zinc-400 mt-1">Verifying administrative authorization</p>
      </div>
    );
  }

  if (pathname === '/admin/login' && authStatus === 'unauthenticated') {
    return (
      <AdminLoginModal
        isPage={true}
        isOpen={true}
        noticeMessage={loginNotice}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (pathname === '/admin/dashboard' && authStatus === 'authenticated') {
    return (
      <>
        <CmsDashboard
          onClose={() => navigate('/')}
          articles={articles}
          liveUpdates={liveUpdates}
          onArticlesChange={loadCmsData}
          onLiveUpdatesChange={loadCmsData}
          onSelectArticleForPreview={(art) => setPreviewArticle(art)}
          adminUser={adminUser}
          onLogout={handleLogout}
          onPasswordChanged={handlePasswordChanged}
        />

        <ArticleReaderModal
          article={previewArticle}
          onClose={() => setPreviewArticle(null)}
          onSelectArticle={setPreviewArticle}
          relatedArticles={previewRelatedArticles}
        />
      </>
    );
  }

  // Fallback spinner while declarative redirect settles
  return (
    <div className="min-h-screen bg-[#111317] text-zinc-300 flex items-center justify-center p-6 font-hindi-brand">
      <p className="text-xs text-zinc-400">प्रमाणीकरण पृष्ठ पर पुनर्निर्देशित किया जा रहा है...</p>
    </div>
  );
}
