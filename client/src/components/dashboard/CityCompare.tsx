import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { aqiColor } from '../../lib/aqi';
import { ErrorState } from '../ui/primitives';

interface Row { name: string; country: string; lat: number; lon: number; aq?: any; error?: string }

export default function CityCompare({ homeName, homeLat, homeLon }: { homeName: string; homeLat: number; homeLon: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [homeAq, setHomeAq] = useState<any>(null);

  // home row is always first (fetched on demand, cached on the server)
  const loadHome = async () => { if (!homeAq) { try { setHomeAq(await api.airQuality(homeLat, homeLon)); } catch { /* shown via main dashboard */ } } };
  loadHome();

  const add = async () => {
    if (!q.trim() || rows.length >= 3) return;
    setBusy(true); setErr(null);
    try {
      const g = await api.geocodeSearch(q.trim());
      const hit = g.results?.[0];
      if (!hit) throw new Error(`No city found for "${q}"`);
      const aq = await api.airQuality(hit.latitude, hit.longitude);
      setRows((r) => [...r, { name: hit.name, country: hit.country || '', lat: hit.latitude, lon: hit.longitude, aq }]);
      setQ('');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const all: Row[] = [{ name: homeName, country: '', lat: homeLat, lon: homeLon, aq: homeAq }, ...rows];
  return (
    <div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input" placeholder="Add a city to compare (up to 4 total)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="City to compare" disabled={rows.length >= 3} />
        <button className="btn-primary" disabled={busy || !q.trim() || rows.length >= 3} aria-label="Add city">{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}</button>
      </form>
      {err && <div className="mt-2"><ErrorState compact message={err} /></div>}
      <ul className="grid grid-cols-2 gap-2 mt-3">
        {all.map((r, i) => (
          <li key={i} className="glass p-3 relative">
            {i > 0 && <button aria-label={`Remove ${r.name}`} className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-fg/10" onClick={() => setRows(rows.filter((_, k) => k !== i - 1))}><X size={12} /></button>}
            <p className="text-sm font-bold truncate pr-5">{r.name}</p>
            {r.aq ? (<>
              <p className="text-3xl font-extrabold tabular-nums" style={{ color: aqiColor(r.aq.current.usAqi) }}>{r.aq.current.usAqi}</p>
              <p className="text-xs font-semibold">{r.aq.usCategory.label}</p>
              <p className="text-xs text-fg/60 mt-1">PM2.5 {r.aq.current.pm2_5.toFixed(0)} µg/m³ · {r.aq.whoRatios.pm2_5}× WHO</p>
              <p className="text-xs text-fg/60">India NAQI {r.aq.naqi.value} ({r.aq.naqi.category})</p>
            </>) : <div className="skeleton h-16 mt-2" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
