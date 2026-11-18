import { LayoutDashboard, CalendarClock, Home, Leaf, Scale, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Page } from '../../App';

const ITEMS: { id: Page; icon: typeof Home; key: string }[] = [
  { id: 'dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { id: 'plan', icon: CalendarClock, key: 'nav.plan' },
  { id: 'indoor', icon: Home, key: 'nav.indoor' },
  { id: 'alternatives', icon: Leaf, key: 'nav.alternatives' },
  { id: 'impact', icon: Scale, key: 'nav.impact' },
  { id: 'chat', icon: MessageCircle, key: 'nav.chat' },
];

export default function BottomNav({ current, onChange }: { current: Page; onChange: (p: Page) => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-40 px-3 safe-bottom pointer-events-none">
      <ul className="pointer-events-auto mx-auto max-w-xl grid grid-cols-6 gap-0.5 p-1.5 rounded-[1.75rem] border border-fg/10 bg-canvas/70 backdrop-blur-2xl shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]">
        {ITEMS.map(({ id, icon: Icon, key }) => {
          const on = current === id;
          return (
            <li key={id} className="relative">
              <button onClick={() => onChange(id)} aria-current={on ? 'page' : undefined}
                className={`relative w-full flex flex-col items-center gap-0.5 py-2 rounded-[1.25rem] text-[10px] sm:text-xs font-semibold transition-colors ${on ? 'text-fg' : 'text-fg/55 hover:text-fg'}`}>
                {on && <motion.span layoutId="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-[1.25rem] border border-brand/30" style={{ background: 'linear-gradient(135deg, rgb(var(--brand) / 0.26), rgb(var(--accent) / 0.18))', boxShadow: '0 6px 20px -6px rgb(var(--brand) / 0.55)' }} />}
                <Icon size={19} aria-hidden="true" className={`relative ${on ? 'text-brand' : ''}`} />
                <span className="relative truncate max-w-full px-0.5">{t(key)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
