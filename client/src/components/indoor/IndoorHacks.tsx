import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, RefreshCw, Ruler, Ban, Hammer, Leaf, ChefHat, Filter, ChevronDown } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useProfileStore } from '../../store/profileStore';
import { api } from '../../lib/api';
import { useAiResource } from '../../store/aiStore';
import { aiProfile, profileKey } from '../../lib/profileKey';
import { Card, SectionTitle, Skeleton, ErrorState, Disclaimer, Spinner, EmptyState, Pill } from '../ui/primitives';
import { NumberInput, Field } from '../ui/fields';

const IMPACT_C: Record<string, string> = { high: '#009E73', medium: '#E69F00', low: '#56B4E9' };

function RoomCalculator() {
  const { profile, setProfile } = useProfileStore();
  const [h, setH] = useState(2.7);
  const [ach, setAch] = useState(5);
  const [owned, setOwned] = useState(0);
  const area = profile.lifestyle.roomArea;
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      api.impact.room(area, h, ach, owned || undefined).then((r) => { setRes(r); setErr(null); }).catch((e: Error) => setErr(e.message));
    }, 300);
    return () => clearTimeout(id);
  }, [area, h, ach, owned]);

  return (
    <Card>
      <SectionTitle icon={<Ruler size={16} className="text-brand" />}>Room-size calculator</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Room area"><NumberInput label="Room area m2" value={area} min={4} max={200} unit="m²" onChange={(n) => setProfile({ lifestyle: { ...profile.lifestyle, roomArea: n } })} /></Field>
        <Field label="Ceiling"><NumberInput label="Ceiling height" value={h} min={2} max={5} step={0.1} unit="m" onChange={setH} /></Field>
        <Field label="Target ACH"><NumberInput label="Air changes per hour" value={ach} min={1} max={12} unit="/h" onChange={setAch} /></Field>
        <Field label="Your purifier CADR"><NumberInput label="Owned CADR" value={owned} min={0} max={2000} unit="m³/h" onChange={setOwned} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorState compact message={err} /></div>}
      {res && (
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="glass p-3"><p className="label">Volume</p><p className="text-xl font-extrabold">{res.volumeM3} m³</p></div>
          <div className="glass p-3"><p className="label">Needed CADR</p><p className="text-xl font-extrabold text-brand">{res.requiredCadr_m3h} m³/h</p><p className="text-[11px] text-fg/60">≈ {Math.round(res.requiredCadr_m3h / 1.699)} CFM</p></div>
          <div className="glass p-3"><p className="label">Your ACH</p><p className="text-xl font-extrabold">{res.achWithOwned ?? '—'}</p><p className="text-[11px] text-fg/60">{owned ? (res.achWithOwned >= ach ? '✓ enough' : 'below target') : 'enter your CADR'}</p></div>
        </div>
      )}
      <p className="text-xs text-fg/50 mt-3">{res?.formula ?? 'CADR (m³/h) = ACH × room volume (m³)'}. Deterministic calculation — not AI generated.</p>
    </Card>
  );
}

function HepaTracker() {
  const { profile, setProfile } = useProfileStore();
  const hp = profile.hepa;
  const used = hp.installedAt ? Math.max((Date.now() - new Date(hp.installedAt).getTime()) / 864e5, 0) * hp.hoursPerDay : 0;
  const pct = Math.min(used / hp.lifeHours, 1);
  const left = Math.max(hp.lifeHours - used, 0);
  const daysLeft = hp.hoursPerDay > 0 ? Math.round(left / hp.hoursPerDay) : 0;
  const set = (p: Partial<typeof hp>) => setProfile({ hepa: { ...hp, ...p } });
  return (
    <Card>
      <SectionTitle icon={<Filter size={16} className="text-brand" />}>HEPA filter life tracker</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Installed on"><input type="date" className="input" aria-label="Filter install date" max={new Date().toISOString().slice(0, 10)} value={hp.installedAt?.slice(0, 10) ?? ''} onChange={(e) => set({ installedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
        <Field label="Run hours/day"><NumberInput label="Hours per day" value={hp.hoursPerDay} min={1} max={24} unit="h" onChange={(n) => set({ hoursPerDay: n })} /></Field>
        <Field label="Rated life"><NumberInput label="Rated filter life hours" value={hp.lifeHours} min={500} max={20000} step={100} unit="h" onChange={(n) => set({ lifeHours: n })} /></Field>
      </div>
      {hp.installedAt ? (
        <div className="mt-4">
          <div className="h-3 rounded-full bg-fg/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Filter life used">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: pct < 0.7 ? '#009E73' : pct < 0.9 ? '#E69F00' : '#D55E00' }} />
          </div>
          <p className="text-sm mt-2"><strong>{Math.round(pct * 100)}%</strong> used · ≈ {Math.round(left)} h (~{daysLeft} days) left{pct >= 0.9 ? ' — replace soon (heavy smog loads filters faster).' : '.'}</p>
        </div>
      ) : <p className="text-sm text-fg/60 mt-3">Enter the date you installed your current filter to track remaining life. Stored on this device only.</p>}
    </Card>
  );
}

function Action({ a }: { a: any }) {
  const [open, setOpen] = useState(a.rank <= 2);
  return (
    <li className="glass">
      <button className="w-full flex items-start gap-3 p-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="h-7 w-7 shrink-0 rounded-full bg-brand/20 text-brand font-extrabold text-sm flex items-center justify-center">{a.rank}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold">{a.action}</span>
          <span className="flex flex-wrap gap-1.5 mt-1.5">
            <Pill color={IMPACT_C[a.impact] || '#999'}>{a.impact} impact</Pill><Pill>{a.effort}</Pill><Pill>{a.cost === 'free' ? 'free' : `cost: ${a.cost}`}</Pill>
          </span>
        </span>
        <ChevronDown size={16} className={`mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 -mt-1">
          {a.why && <p className="text-sm text-fg/70 mb-2"><em>Why for you: </em>{a.why}</p>}
          <ol className="list-decimal pl-5 space-y-1 text-sm">{a.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}
    </li>
  );
}

export default function IndoorHacks() {
  const { t } = useTranslation();
  const { profile } = useProfileStore();
  const aq = useDataStore((s) => s.airQuality);
  const loc = profile.locations[profile.activeLocationIndex];
  const key = aq ? `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}|${aq.current.time.slice(0, 10)}|${profileKey(profile)}` : null;
  const { data, loading, error, regenerate } = useAiResource<any>('indoor', key, () =>
    api.ai.indoorHacks({ airQuality: aq, profile: aiProfile(profile), roomArea: profile.lifestyle.roomArea }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold flex items-center gap-2"><Home size={20} className="text-brand" />{t('indoor.title')}</h1>
        <button className="btn-ghost" onClick={() => regenerate()} disabled={loading || !aq} aria-label="Regenerate indoor tips"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      {!aq && <EmptyState icon={<Home size={32} />} title="Waiting for live air data" hint="Open the Dashboard to load your location first." />}
      {aq && <p className="text-sm text-fg/70">Outdoor PM2.5 right now is <strong>{aq.current.pm2_5.toFixed(0)} µg/m³</strong>. Your plan below is tuned to your cooking fuel, windows, purifier, pets and budget ({profile.lifestyle.budget}).</p>}

      <RoomCalculator />

      {loading && !data && <Card><Spinner label="Groq is building your personalised indoor plan…" /><Skeleton className="h-16 mb-2" /><Skeleton className="h-16" /></Card>}
      {error && <ErrorState message={error} onRetry={() => regenerate()} />}

      {data && (<>
        <Card><p className="font-semibold leading-relaxed">{data.summary}</p></Card>
        <section aria-label="Ranked actions"><SectionTitle icon={<Hammer size={16} className="text-brand" />}>Ranked actions</SectionTitle>
          <ul className="space-y-2">{[...data.rankedActions].sort((a: any, b: any) => a.rank - b.rank).map((a: any) => <Action key={a.rank + a.action} a={a} />)}</ul>
        </section>
        <Card>
          <SectionTitle icon={<Ban size={16} className="text-red-400" />}>Skip these — they don’t help</SectionTitle>
          <ul className="space-y-2 text-sm">{data.skipList.map((s: any, i: number) => <li key={i}><strong>✗ {s.item}:</strong> <span className="text-fg/75">{s.reason}</span></li>)}</ul>
        </Card>
        <Card>
          <SectionTitle icon={<Filter size={16} className="text-brand" />}>{t('indoor.purifier')}</SectionTitle>
          <p className="text-sm mb-2"><strong>Needed CADR for {data.roomArea} m²:</strong> {data.calculatedCadr} m³/h ({data.targetACH} ACH)</p>
          <p className="text-sm text-fg/80">{data.purifier.advice}</p>
          {data.purifier.budgetOptions?.length > 0 && <ul className="list-disc pl-5 mt-2 text-sm space-y-1">{data.purifier.budgetOptions.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>}
          {data.purifier.filterCareTips?.length > 0 && <><p className="label mt-3">Filter care</p><ul className="list-disc pl-5 text-sm space-y-1 mt-1">{data.purifier.filterCareTips.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul></>}
        </Card>
        <Card>
          <SectionTitle icon={<Hammer size={16} className="text-brand" />}>{t('indoor.diy')} (Corsi–Rosenthal cube)</SectionTitle>
          <ol className="list-decimal pl-5 text-sm space-y-1.5">{data.diyCorsiRosenthal.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
        </Card>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card><SectionTitle icon={<ChefHat size={16} className="text-brand" />}>{t('indoor.cooking')}</SectionTitle><ul className="list-disc pl-5 text-sm space-y-1.5">{data.cookingTips.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></Card>
          <Card><SectionTitle icon={<Leaf size={16} className="text-brand" />}>{t('indoor.plants')}</SectionTitle><ul className="list-disc pl-5 text-sm space-y-1.5">{data.plantFacts.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></Card>
        </div>
      </>)}

      <HepaTracker />
      <Disclaimer />
    </div>
  );
}
