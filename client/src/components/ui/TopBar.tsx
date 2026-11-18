import { MapPin, RefreshCw, Sun, Moon, Info, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../store/profileStore';
import { useDataStore } from '../../store/dataStore';
import type { Page } from '../../App';
import { NAV_ITEMS } from './nav';

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <rect width="40" height="40" rx="12" fill="#111315" />
      <path d="M9 15h14a3.5 3.5 0 1 0-3.5-3.5M9 21h20a3.5 3.5 0 1 1-3.5 3.5M9 27h10" fill="none" stroke="#a8d654" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

const iconBtn = 'h-10 w-10 inline-flex items-center justify-center rounded-xl border border-fg/10 bg-surface hover:border-fg/30 transition-all active:scale-95 shadow-[var(--shadow)]';

export default function TopBar({ page, onRefresh, onAbout }: { page: Page; onRefresh: () => void; onAbout: () => void }) {
  const { t } = useTranslation();
  const { profile, setActiveLocation, setLanguage, toggleTheme } = useProfileStore();
  const loading = useDataStore((s) => s.isLoadingAQ);
  const navItem = NAV_ITEMS.find((n) => n.id === page);
  const title = navItem ? t(navItem.key) : 'Data & methods';
  const initial = (profile.locations[profile.activeLocationIndex]?.name || 'A').trim().charAt(0).toUpperCase();
  return (
    <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1320px] flex items-center gap-2.5 px-4 lg:px-6 py-3">
        <span className="lg:hidden flex items-center gap-2 font-extrabold tracking-tight text-lg"><LogoMark size={30} />AirAlly</span>
        <h1 className="hidden lg:block text-xl font-extrabold tracking-tight mr-2">{title}</h1>

        <label className="ml-auto lg:ml-0 lg:flex-1 lg:max-w-md flex items-center gap-2 min-w-0 rounded-xl border border-fg/10 bg-surface pl-3 pr-2 h-10 shadow-[var(--shadow)] focus-within:border-fg/40">
          <MapPin size={15} className="text-brand shrink-0" aria-hidden="true" />
          <span className="sr-only">Location</span>
          <select value={profile.activeLocationIndex} onChange={(e) => setActiveLocation(+e.target.value)}
            className="appearance-none bg-transparent flex-1 min-w-0 text-sm font-semibold truncate focus:outline-none cursor-pointer max-w-[34vw] lg:max-w-none">
            {profile.locations.map((l, i) => <option key={i} value={i} className="text-slate-900">{l.label ? `${l.label} · ` : ''}{l.name}</option>)}
          </select>
          <ChevronDown size={14} className="text-fg/50 shrink-0" aria-hidden="true" />
        </label>

        <div className="flex items-center gap-2 lg:ml-auto">
          <button onClick={onRefresh} aria-label="Refresh data" className={iconBtn}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={() => setLanguage(profile.language === 'en' ? 'hi' : 'en')} aria-label="Switch language" className={`${iconBtn} text-xs font-bold`}>{profile.language === 'en' ? 'हिं' : 'EN'}</button>
          <button onClick={toggleTheme} aria-label="Toggle dark / light theme" className={iconBtn}>{profile.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={onAbout} aria-label="Data sources and methodology" className={`${iconBtn} hidden sm:inline-flex`}><Info size={16} /></button>
          <span aria-hidden="true" className="hidden md:inline-flex h-10 w-10 items-center justify-center rounded-full bg-lime text-[rgb(var(--lime-ink))] font-extrabold">{initial}</span>
        </div>
      </div>
    </header>
  );
}
