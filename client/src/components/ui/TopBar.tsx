import { MapPin, RefreshCw, Sun, Moon, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../store/profileStore';
import { useDataStore } from '../../store/dataStore';

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0 drop-shadow-[0_4px_14px_rgba(56,189,248,0.45)]">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#34d399" /></linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#lg)" />
      <path d="M9 15h14a3.5 3.5 0 1 0-3.5-3.5M9 21h20a3.5 3.5 0 1 1-3.5 3.5M9 27h10" fill="none" stroke="#04101c" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

const iconBtn = 'h-9 w-9 inline-flex items-center justify-center rounded-full border border-fg/10 bg-fg/5 hover:bg-fg/10 hover:border-fg/20 transition-all active:scale-95';

export default function TopBar({ onRefresh, onAbout }: { onRefresh: () => void; onAbout: () => void }) {
  const { t } = useTranslation();
  const { profile, setActiveLocation, setLanguage, toggleTheme } = useProfileStore();
  const loading = useDataStore((s) => s.isLoadingAQ);
  return (
    <header className="sticky top-0 z-30 bg-canvas/60 backdrop-blur-2xl border-b border-fg/10">
      <div className="mx-auto max-w-3xl flex items-center gap-2 px-4 py-2.5">
        <span className="flex items-center gap-2 font-extrabold tracking-tight text-lg"><LogoMark /><span className="text-gradient">{t('app.name')}</span></span>
        <label className="ml-auto flex items-center gap-1.5 min-w-0 rounded-full border border-fg/10 bg-fg/5 pl-2.5 pr-1.5 h-9">
          <MapPin size={14} className="text-brand shrink-0" aria-hidden="true" />
          <span className="sr-only">Location</span>
          <select value={profile.activeLocationIndex} onChange={(e) => setActiveLocation(+e.target.value)}
            className="bg-transparent text-sm font-semibold max-w-[30vw] truncate focus:outline-none cursor-pointer">
            {profile.locations.map((l, i) => <option key={i} value={i} className="text-slate-900">{l.label ? `${l.label} · ` : ''}{l.name}</option>)}
          </select>
        </label>
        <button onClick={onRefresh} aria-label="Refresh data" className={iconBtn}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        <button onClick={() => setLanguage(profile.language === 'en' ? 'hi' : 'en')} aria-label="Switch language"
          className={`${iconBtn} text-xs font-bold`}>{profile.language === 'en' ? 'हिं' : 'EN'}</button>
        <button onClick={toggleTheme} aria-label="Toggle dark / light theme" className={iconBtn}>
          {profile.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button onClick={onAbout} aria-label="Data sources and methodology" className={`${iconBtn} hidden sm:inline-flex`}><Info size={15} /></button>
      </div>
    </header>
  );
}
