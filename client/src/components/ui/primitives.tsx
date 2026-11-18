import { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Card({ children, className = '', as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: any; [k: string]: any }) {
  return <Tag className={`glass rise p-4 sm:p-6 ${className}`} {...rest}>{children}</Tag>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SectionTitle({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight">{icon && <span className="icon-badge">{icon}</span>}{children}</h2>
      {right}
    </div>
  );
}

export function ErrorState({ message, onRetry, compact = false }: { message?: string | null; onRetry?: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div role="alert" className={`flex ${compact ? 'flex-row items-center gap-3 p-3' : 'flex-col items-center text-center gap-3 p-6'} rounded-2xl border border-red-400/30 bg-red-500/10`}>
      {offline ? <WifiOff className="text-red-400 shrink-0" size={compact ? 18 : 28} /> : <AlertTriangle className="text-red-400 shrink-0" size={compact ? 18 : 28} />}
      <div className="text-sm">
        <p className="font-semibold">{offline ? t('errors.offline') : t('errors.fetchFailed')}</p>
        {message && <p className="text-fg/60 text-xs mt-1 break-words">{message}</p>}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost ml-auto shrink-0"><RefreshCw size={14} />{t('dashboard.retry')}</button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 p-8 text-fg/60">
      {icon}<p className="font-semibold text-fg">{title}</p>{hint && <p className="text-sm">{hint}</p>}
    </div>
  );
}

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border"
      style={color ? { color, borderColor: color + '66', background: color + '1a' } : undefined}>
      {children}
    </span>
  );
}

export function Disclaimer() {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-fg/60 leading-relaxed border-t border-fg/10 pt-3 mt-4">
      ⚕️ {t('disclaimer')}
    </p>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-fg/70" role="status" aria-live="polite">
      <div className="h-8 w-8 rounded-full border-2 border-fg/20 border-t-brand animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
