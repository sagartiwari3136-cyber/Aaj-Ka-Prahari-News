import { lazy, Suspense, useEffect } from 'react';
import { PublicPortalPage } from './pages/PublicPortalPage';
import { isAdminPath, purgeLegacyLocalAdminStorage, useAppRoute } from './utils/router';

const AdminRoutes = lazy(() => import('./pages/AdminRoutes'));

export function App() {
  const { pathname, navigate } = useAppRoute();

  useEffect(() => {
    purgeLegacyLocalAdminStorage();
  }, []);

  if (isAdminPath(pathname)) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#111317] text-zinc-300 flex items-center justify-center p-6 font-hindi-brand">
            <p className="text-xs text-zinc-400">एडमिन मॉड्यूल लोड हो रहा है...</p>
          </div>
        }
      >
        <AdminRoutes pathname={pathname} navigate={navigate} />
      </Suspense>
    );
  }

  return <PublicPortalPage />;
}

export default App;
