import { useEffect, useState, useCallback } from 'react';

const SESSION_TOKEN_KEY = 'akp_admin_session_token';
const NAVIGATE_EVENT = 'akp:navigate';

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const cleaned = pathname.replace(/\/+$/, '');
  return cleaned === '' ? '/' : cleaned;
}

export function isAdminPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === '/admin' || normalized.startsWith('/admin/');
}

export function navigateTo(to: string, options?: { replace?: boolean }): void {
  const target = normalizePathname(to);
  const current = normalizePathname(window.location.pathname);

  if (current === target && !options?.replace) {
    return;
  }

  if (options?.replace) {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState(null, '', target);
  }

  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { pathname: target } }));
}

export function useAppRoute() {
  const [pathname, setPathname] = useState<string>(() =>
    normalizePathname(window.location.pathname)
  );

  useEffect(() => {
    const syncPath = () => {
      setPathname(normalizePathname(window.location.pathname));
    };

    window.addEventListener('popstate', syncPath);
    window.addEventListener(NAVIGATE_EVENT, syncPath);

    return () => {
      window.removeEventListener('popstate', syncPath);
      window.removeEventListener(NAVIGATE_EVENT, syncPath);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    navigateTo(to, options);
  }, []);

  return { pathname, navigate };
}

export function purgeLegacyLocalAdminStorage(): void {
  try {
    localStorage.removeItem('akp_admin_token');
    localStorage.removeItem('akp_admin_user');
  } catch {
    // ignore storage access issues
  }
}

export function getStoredAdminSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminSessionToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage access issues
  }
}
