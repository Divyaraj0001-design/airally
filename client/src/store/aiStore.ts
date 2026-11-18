import { create } from 'zustand';
import { useEffect } from 'react';

interface Entry { data?: any; loading: boolean; error?: string; key?: string }
interface AiStore {
  entries: Record<string, Entry>;
  run: (name: string, key: string, fn: () => Promise<any>, force?: boolean) => Promise<void>;
}

export const useAiStore = create<AiStore>((set, get) => ({
  entries: {},
  run: async (name, key, fn, force = false) => {
    const cur = get().entries[name];
    if (!force && cur && cur.key === key && (cur.loading || cur.data)) return;
    set((s) => ({ entries: { ...s.entries, [name]: { loading: true, key, data: cur?.key === key ? cur?.data : undefined } } }));
    try {
      const data = await fn();
      set((s) => (s.entries[name]?.key === key ? { entries: { ...s.entries, [name]: { loading: false, key, data } } } : s));
    } catch (e: any) {
      set((s) => (s.entries[name]?.key === key ? { entries: { ...s.entries, [name]: { loading: false, key, error: e?.message || 'Request failed' } } } : s));
    }
  },
}));

/** Run an AI request once per `key`; results are kept while the app is open. */
export function useAiResource<T = any>(name: string, key: string | null, fn: () => Promise<T>) {
  const entry = useAiStore((s) => s.entries[name]);
  const run = useAiStore((s) => s.run);
  useEffect(() => { if (key) run(name, key, fn); /* eslint-disable-next-line */ }, [name, key]);
  const current = entry && entry.key === key ? entry : undefined;
  return {
    data: current?.data as T | undefined,
    loading: !!key && (!current || current.loading),
    error: current?.error,
    regenerate: () => key && run(name, key, fn, true),
  };
}
