import { useEffect, useState } from 'react';
import { Crosshair, Search, Trash2, Loader2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { detectLocation } from '../../hooks/useAirData';
import { useProfileStore, SavedLocation } from '../../store/profileStore';

const LABELS = ['Home', 'Office', 'School', 'Other'];

export default function LocationPicker() {
  const { t } = useTranslation();
  const { profile, addLocation, removeLocation, replaceLocation } = useProfileStore();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = profile.locations.length >= 5;

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const id = setTimeout(() => {
      api.geocodeSearch(q.trim(), profile.language)
        .then((r) => { setResults(r.results || []); setError(null); })
        .catch((e: Error) => setError(e.message))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(id);
  }, [q, profile.language]);

  const nextLabel = LABELS.find((l) => !profile.locations.some((x) => x.label === l)) || 'Other';
  const add = (loc: Omit<SavedLocation, 'label'>) => {
    addLocation({ ...loc, label: nextLabel });
    setQ(''); setResults([]); setError(null);
  };

  return (
    <div className="space-y-4">
      <button className="btn-primary w-full" disabled={detecting || full}
        onClick={async () => {
          setDetecting(true); setError(null);
          try { add(await detectLocation()); } catch (e: any) { setError(e.message); }
          finally { setDetecting(false); }
        }}>
        {detecting ? <Loader2 className="animate-spin" size={16} /> : <Crosshair size={16} />}{t('onboarding.detect')}
      </button>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/50" aria-hidden="true" />
        <input className="input !pl-10" placeholder={t('onboarding.search')} value={q} onChange={(e) => setQ(e.target.value)}
          aria-label={t('onboarding.search')} disabled={full} />
        {searching && <Loader2 size={16} className="absolute right-3 top-3 animate-spin text-fg/50" />}
      </div>
      {results.length > 0 && (
        <ul className="glass divide-y divide-fg/10 overflow-hidden" role="listbox">
          {results.map((r) => (
            <li key={r.id}>
              <button className="w-full text-left px-3 py-2.5 hover:bg-fg/10 text-sm"
                onClick={() => add({ name: r.name, lat: r.latitude, lon: r.longitude, country: r.country || '', state: r.admin1 })}>
                <span className="font-semibold">{r.name}</span>
                <span className="text-fg/60">{[r.admin1, r.country].filter(Boolean).length ? ' — ' + [r.admin1, r.country].filter(Boolean).join(', ') : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !searching && results.length === 0 && !error && <p className="text-sm text-fg/60">No matching places found.</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {full && <p className="text-xs text-fg/60">Maximum of 5 saved locations reached.</p>}

      <ul className="space-y-2">
        {profile.locations.map((l, i) => (
          <li key={`${l.lat}-${l.lon}`} className="glass flex items-center gap-2 p-2.5">
            <MapPin size={16} className="text-brand shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{l.name}</p>
              <p className="text-xs text-fg/60 truncate">{[l.state, l.country].filter(Boolean).join(', ')}</p>
            </div>
            <select aria-label="Location label" value={l.label} onChange={(e) => replaceLocation(i, { ...l, label: e.target.value })}
              className="input !w-auto !py-1.5 text-xs">
              {LABELS.map((x) => <option key={x} className="text-slate-900">{x}</option>)}
            </select>
            <button aria-label={`Remove ${l.name}`} onClick={() => removeLocation(i)} className="p-2 rounded-lg hover:bg-red-500/20 text-red-400"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
