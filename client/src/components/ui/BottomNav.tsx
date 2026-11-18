import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Page } from '../../App';
import { NAV_ITEMS } from './nav';

/** Mobile / tablet navigation (hidden on lg+, where the Sidebar takes over). */
export default function BottomNav({ current, onChange }: { current: Page; onChange: (p: Page) => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 safe-bottom pointer-events-none">
      <ul className="pointer-events-auto mx-auto max-w-xl grid grid-cols-6 gap-0.5 p-1.5 rounded-[1.5rem] border border-fg/10 bg-surface/90 backdrop-blur-xl shadow-[0_18px_40px_-16px_rgba(0,0,0,0.35)]">
        {NAV_ITEMS.map(({ id, icon: Icon, key }) => {
          const on = current === id;
          return (
            <li key={id} className="relative">
              <button onClick={() => onChange(id)} aria-current={on ? 'page' : undefined}
                className={`relative w-full flex flex-col items-center gap-0.5 py-2 rounded-[1.1rem] text-[10px] sm:text-xs font-semibold transition-colors ${on ? 'text-[rgb(var(--lime-ink))]' : 'text-fg/55 hover:text-fg'}`}>
                {on && <motion.span layoutId="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-[1.1rem] bg-lime" />}
                <Icon size={19} aria-hidden="true" className="relative" />
                <span className="relative truncate max-w-full px-0.5">{t(key)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
