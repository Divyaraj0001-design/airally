import { useState } from 'react';
import { BookOpen, ChevronsLeft, ChevronsRight, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Page } from '../../App';
import { NAV_ITEMS } from './nav';
import { LogoMark } from './TopBar';

const KEY = 'airally-sidebar-collapsed';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const write = (v: boolean) => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage unavailable */ } };

/** Desktop sidebar (lg+). On smaller screens the BottomNav is used instead. */
export default function Sidebar({ current, onChange }: { current: Page; onChange: (p: Page) => void }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(read);
  const [promo, setPromo] = useState(true);
  const toggle = () => setCollapsed((c) => { write(!c); return !c; });

  const row = (on: boolean) =>
    `relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${on ? 'bg-fg/[0.06] font-bold text-fg' : 'font-medium text-fg/65 hover:bg-fg/[0.04] hover:text-fg'}`;

  return (
    <aside aria-label="Sidebar" className={`hidden lg:flex shrink-0 sticky top-0 h-dvh p-3 transition-[width] duration-300 ${collapsed ? 'w-[92px]' : 'w-[272px]'}`}>
      <div className="glass flex flex-col w-full h-full p-3 overflow-hidden">
        <div className={`flex items-center gap-2.5 px-2 pt-2 pb-5 ${collapsed ? 'justify-center' : ''}`}>
          <LogoMark size={30} />
          {!collapsed && <span className="text-lg font-extrabold tracking-tight">AirAlly</span>}
        </div>

        <nav aria-label="Main" className="space-y-1">
          {NAV_ITEMS.map(({ id, icon: Icon, key }) => {
            const on = current === id;
            return (
              <button key={id} onClick={() => onChange(id)} aria-current={on ? 'page' : undefined} title={collapsed ? t(key) : undefined} className={row(on)}>
                {on && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-fg" aria-hidden="true" />}
                <Icon size={18} aria-hidden="true" />
                {!collapsed && <span className="truncate">{t(key)}</span>}
                {collapsed && <span className="sr-only">{t(key)}</span>}
              </button>
            );
          })}
        </nav>

        <div className="my-3 border-t border-fg/10" />
        <button onClick={() => onChange('about')} aria-current={current === 'about' ? 'page' : undefined} title={collapsed ? 'Data sources & methods' : undefined} className={row(current === 'about')}>
          <BookOpen size={18} aria-hidden="true" />
          {!collapsed && <span className="truncate">Data &amp; methods</span>}
          {collapsed && <span className="sr-only">Data sources and methods</span>}
        </button>

        <div className="mt-auto space-y-2 pt-3">
          {promo && !collapsed && (
            <div className="relative rounded-2xl border border-fg/10 p-3.5">
              <button onClick={() => setPromo(false)} aria-label="Dismiss" className="absolute right-2 top-2 h-6 w-6 inline-flex items-center justify-center rounded-md border border-fg/10 text-fg/60 hover:text-fg"><X size={12} /></button>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-fg text-canvas"><Sparkles size={16} /></span>
              <p className="mt-2.5 font-extrabold">Ask AirAlly</p>
              <p className="text-xs text-fg/60 mt-1 leading-relaxed">Get answers for your family from live air data — masks, windows, school runs.</p>
              <button onClick={() => onChange('chat')} className="btn-primary w-full mt-3 !py-2">Open chat</button>
            </div>
          )}
          <button onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={row(false)}>
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
