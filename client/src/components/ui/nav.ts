import { LayoutDashboard, CalendarClock, Home, Leaf, Scale, MessageCircle } from 'lucide-react';
import type { Page } from '../../App';

export const NAV_ITEMS: { id: Page; icon: typeof Home; key: string }[] = [
  { id: 'dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { id: 'plan', icon: CalendarClock, key: 'nav.plan' },
  { id: 'indoor', icon: Home, key: 'nav.indoor' },
  { id: 'alternatives', icon: Leaf, key: 'nav.alternatives' },
  { id: 'impact', icon: Scale, key: 'nav.impact' },
  { id: 'chat', icon: MessageCircle, key: 'nav.chat' },
];
