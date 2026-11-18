import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useProfileStore } from './store/profileStore';
import { useAirData } from './hooks/useAirData';
import i18n from './i18n/index';
const Onboarding = lazy(() => import('./components/onboarding/Onboarding'));
import Dashboard from './components/dashboard/Dashboard';
const DailyPlan = lazy(() => import('./components/planner/DailyPlan'));
const IndoorHacks = lazy(() => import('./components/indoor/IndoorHacks'));
const Alternatives = lazy(() => import('./components/alternatives/Alternatives'));
const Impact = lazy(() => import('./components/impact/Impact'));
const Chat = lazy(() => import('./components/chat/Chat'));
const About = lazy(() => import('./components/about/About'));
import BottomNav from './components/ui/BottomNav';
import AlertBanner from './components/ui/AlertBanner';
import TopBar from './components/ui/TopBar';
import Footer from './components/ui/Footer';

export type Page = 'dashboard' | 'plan' | 'indoor' | 'alternatives' | 'impact' | 'chat' | 'about';

export default function App() {
  const profile = useProfileStore((s) => s.profile);
  const { fetchAll } = useAirData();
  const [page, setPage] = useState<Page>('dashboard');
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => { i18n.changeLanguage(profile.language); document.documentElement.lang = profile.language; }, [profile.language]);
  useEffect(() => { document.documentElement.dataset.theme = profile.theme; }, [profile.theme]);
  useEffect(() => {
    const on = () => { setOnline(true); fetchAll(); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [fetchAll]);

  const loc = profile.locations[profile.activeLocationIndex];
  useEffect(() => {
    if (!profile.onboardingComplete || !loc) return;
    useDataStoreReset();
    fetchAll();
    const id = setInterval(fetchAll, 10 * 60 * 1000); // live refresh every 10 min while open
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.onboardingComplete, loc?.lat, loc?.lon, profile.language]);

  if (!profile.onboardingComplete || !loc) return <Suspense fallback={<div className="p-10 text-center text-sm" role="status">Loading…</div>}><Onboarding /></Suspense>;

  const view: Record<Page, JSX.Element> = {
    dashboard: <Dashboard onNavigate={setPage} />, plan: <DailyPlan />, indoor: <IndoorHacks />,
    alternatives: <Alternatives />, impact: <Impact />, chat: <Chat />, about: <About onBack={() => setPage('dashboard')} />,
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 btn-primary">Skip to content</a>
      <TopBar onRefresh={fetchAll} onAbout={() => setPage('about')} />
      {!online && <div role="status" className="bg-red-500/20 border-b border-red-400/40 text-sm px-4 py-2 flex items-center gap-2 justify-center"><WifiOff size={14} />You are offline — live data can’t refresh. Showing what was last loaded.</div>}
      <AlertBanner />
      <main id="main" className="flex-1 pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <Suspense fallback={<div className="mx-auto max-w-3xl p-6" role="status" aria-label="Loading"><div className="skeleton h-64" /></div>}>{view[page]}</Suspense>
            {page !== 'chat' && <Footer onAbout={() => setPage('about')} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav current={page === 'about' ? 'dashboard' : page} onChange={setPage} />
    </div>
  );
}

import { useDataStore } from './store/dataStore';
function useDataStoreReset() {
  // switching location clears stale numbers so the previous city's data is never shown under the new name
  const s = useDataStore.getState();
  const loc = useProfileStore.getState().profile.locations[useProfileStore.getState().profile.activeLocationIndex];
  if (s.airQuality && loc && (Math.abs(s.airQuality.meta.latitude - loc.lat) > 0.2 || Math.abs(s.airQuality.meta.longitude - loc.lon) > 0.2)) s.clearForLocation();
}
