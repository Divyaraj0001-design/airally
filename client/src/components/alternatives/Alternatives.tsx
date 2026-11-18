import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Leaf, RefreshCw, Users, MapPin, Clock, Wallet, ChevronDown } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useProfileStore } from '../../store/profileStore';
import { api } from '../../lib/api';
import { useAiResource } from '../../store/aiStore';
import { aiProfile, profileKey } from '../../lib/profileKey';
import { emissionKey, MODE_LABEL } from '../../lib/modes';
import { Card, SectionTitle, Skeleton, ErrorState, Disclaimer, Spinner, EmptyState, Pill } from '../ui/primitives';

const DIFF_C: Record<string, string> = { easy: '#009E73', moderate: '#E69F00', challenging: '#D55E00' };
const CAT_ICON: Record<string, string> = { commute: '🚇', cooking: '🍳', vehicle: '🚗', waste: '♻️', community: '🤝', home: '🏠' };

function Alt({ a }: { a: any }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="glass">
      <button className="w-full p-3 text-left flex items-start gap-3" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="text-2xl" aria-hidden="true">{CAT_ICON[a.category] ?? '🌱'}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs text-fg/60">{a.current}</span>
          <span className="block font-bold">→ {a.alternative}</span>
          <span className="flex flex-wrap gap-1.5 mt-1.5"><Pill color={DIFF_C[a.difficulty]}>{a.difficulty}</Pill></span>
        </span>
        <ChevronDown size={16} className={`mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className="px-3 pb-3 space-y-1.5 text-sm">
        <p className="flex gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-brand" /><span><strong>Nearby: </strong>{a.nearbyOption}</span></p>
        <p className="flex gap-2"><Clock size={14} className="mt-0.5 shrink-0 text-brand" /><span><strong>Time: </strong>{a.timeTradeoff}</span></p>
        <p className="flex gap-2"><Wallet size={14} className="mt-0.5 shrink-0 text-brand" /><span><strong>Cost: </strong>{a.costTradeoff}</span></p>
        {open && <ol className="list-decimal pl-5 pt-1 space-y-1">{a.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>}
      </div>
    </li>
  );
}

export default function Alternatives() {
  const { t } = useTranslation();
  const { profile } = useProfileStore();
  const { nearby, isLoadingNearby, errorNearby, airQuality: aq } = useDataStore();
  const L = profile.lifestyle;
  const cur = emissionKey(L);
  const [table, setTable] = useState<any[] | null>(null);
  const [tableErr, setTableErr] = useState<string | null>(null);

  const km = L.commuteKm * 2; // round trip per day
  useEffect(() => {
    if (!cur || !(L.commuteKm > 0)) { setTable([]); return; }
    const alts = ['walk', 'bike', 'metro', 'bus', 'car_cng', 'car_ev', 'two_ev'].filter((m) => m !== cur && !(['walk', 'bike'].includes(m) && L.commuteKm > 6));
    Promise.all(alts.map((m) => api.impact.emissions({ currentMode: cur, alternativeMode: m, distanceKm: km })))
      .then((r) => { setTable(r.filter((x) => x.co2SavedPerTrip_g > 0)); setTableErr(null); })
      .catch((e: Error) => setTableErr(e.message));
  }, [cur, km, L.commuteKm]);

  const ready = !!aq && !isLoadingNearby && table !== null;
  const key = ready ? `${profile.locations[profile.activeLocationIndex].lat.toFixed(2)}|${nearby ? nearby.total : 'x'}|${profileKey(profile)}` : null;
  const { data, loading, error, regenerate } = useAiResource<any>('alt', key, () =>
    api.ai.alternatives({ profile: aiProfile(profile), nearbyPlaces: nearby, emissions: table?.slice(0, 5).map((x) => ({ from: x.currentMode.mode, to: x.alternativeMode.mode, roundTripKm: x.distanceKm, co2SavedPerDay_g: x.co2SavedPerTrip_g, pmSavedPerDay_mg: x.pmSavedPerTrip_mg })) }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold flex items-center gap-2"><Leaf size={20} className="text-brand" />{t('alternatives.title')}</h1>
        <button className="btn-ghost" onClick={() => regenerate()} disabled={loading || !ready} aria-label="Regenerate"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      {!aq && <EmptyState icon={<Leaf size={32} />} title="Waiting for live data" hint="Open the Dashboard first." />}
      {errorNearby && <ErrorState compact message={`Nearby transit data unavailable (${errorNearby}). Suggestions below won’t name specific stops.`} />}

      {table && table.length > 0 && (
        <Card>
          <SectionTitle>Your commute: {MODE_LABEL[cur!] ?? cur}, {km} km/day round trip</SectionTitle>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <caption className="sr-only">Emissions saved per day by switching mode</caption>
            <thead><tr className="text-left text-fg/60 text-xs"><th className="py-1 pr-2">Switch to</th><th className="pr-2">CO₂ saved/day</th><th className="pr-2">PM saved/day</th><th>/year*</th></tr></thead>
            <tbody>{table.map((r) => (
              <tr key={r.alternativeMode.mode} className="border-t border-fg/10"><td className="py-1.5 pr-2 font-semibold">{MODE_LABEL[r.alternativeMode.mode]}</td><td className="pr-2 tabular-nums">{(r.co2SavedPerTrip_g / 1000).toFixed(2)} kg</td><td className="pr-2 tabular-nums">{r.pmSavedPerTrip_mg} mg</td><td className="tabular-nums">{(r.co2SavedPerTrip_g * 250 / 1000).toFixed(0)} kg CO₂</td></tr>
            ))}</tbody>
          </table></div>
          <p className="text-[11px] text-fg/50 mt-2">Deterministic Impact-Engine figures (IPCC AR6 / CEA India / CPCB factors, per passenger-km). *250 working days. Negative or zero rows are hidden.</p>
        </Card>
      )}
      {tableErr && <ErrorState compact message={tableErr} />}

      {ready && loading && !data && <Card><Spinner label="Groq is finding realistic alternatives near you…" /><Skeleton className="h-20 mb-2" /><Skeleton className="h-20" /></Card>}
      {error && <ErrorState message={error} onRetry={() => regenerate()} />}
      {data && (<>
        <Card><p className="font-semibold leading-relaxed">{data.summary}</p></Card>
        <ul className="space-y-2">{data.alternatives.map((a: any, i: number) => <Alt key={i} a={a} />)}</ul>
        <Card>
          <SectionTitle icon={<Users size={16} className="text-brand" />}>{t('alternatives.community')}</SectionTitle>
          <ul className="list-disc pl-5 text-sm space-y-1.5">{data.communityActions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
        </Card>
        <Disclaimer />
      </>)}
    </div>
  );
}
