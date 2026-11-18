import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Scale, Check, Sparkles, ChevronDown, Leaf, Trophy } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useProfileStore } from '../../store/profileStore';
import { api } from '../../lib/api';
import { bestWindows, fmtWin, pmAt } from '../../lib/windows';
import { addDaysISO } from '../../lib/dates';
import { Card, SectionTitle, Skeleton, ErrorState, Disclaimer, Spinner, EmptyState } from '../ui/primitives';
import { ChoiceChips } from '../ui/fields';
import { aiProfile } from '../../lib/profileKey';
import { MODE_LABEL } from '../../lib/modes';

type Age = 'infant' | 'toddler' | 'child' | 'teen' | 'adult' | 'senior';
const AGE_LABEL: Record<Age, string> = { infant: 'Infant', toddler: 'Toddler', child: 'Child', teen: 'Teen', adult: 'Adult', senior: 'Senior' };

function Bars({ before, after, unit = 'µg' }: { before: number; after: number; unit?: string }) {
  const max = Math.max(before, after, 0.0001);
  return (
    <div className="space-y-1.5 mt-2" aria-hidden="true">
      {[['Before', before, '#D55E00'], ['After', after, '#009E73']].map(([l, v, c]) => (
        <div key={l as string} className="flex items-center gap-2 text-xs">
          <span className="w-11 text-fg/60">{l}</span>
          <div className="flex-1 h-3.5 rounded-full bg-fg/10 overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: c as string }} initial={{ width: 0 }} animate={{ width: `${((v as number) / max) * 100}%` }} transition={{ duration: 0.7 }} /></div>
          <span className="w-16 text-right font-bold tabular-nums">{(v as number).toFixed(1)} {unit}</span>
        </div>
      ))}
    </div>
  );
}

export default function Impact() {
  const { t } = useTranslation();
  const { profile, markDone, unmarkDone } = useProfileStore();
  const { airQuality: aq, nearby } = useDataStore();
  const L = profile.lifestyle;

  const present = new Set(profile.household.members.map((m) => m.ageGroup));
  const ages = (['infant', 'toddler', 'child', 'senior', 'teen', 'adult'] as Age[]).filter((a) => present.has(a));
  const [age, setAge] = useState<Age>(ages[0] ?? 'adult');
  useEffect(() => { if (!present.has(age) && ages[0]) setAge(ages[0]); /* eslint-disable-next-line */ }, [profile.household.members]);

  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [factors, setFactors] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [explain, setExplain] = useState<{ data?: any; loading: boolean; error?: string }>({ loading: false });
  const [openMethod, setOpenMethod] = useState(false);

  const ctx = useMemo(() => {
    if (!aq) return null;
    const today = aq.current.time.slice(0, 10);
    const nowH = parseInt(aq.current.time.slice(11, 13), 10);
    const win = bestWindows(aq, today, 2, 1, nowH + 1)[0] ?? bestWindows(aq, addDaysISO(today, 1), 2, 1)[0];
    const habit = pmAt(aq, today, 8) ?? aq.current.pm2_5;
    const alt = nearby?.transit[0] ? 'metro' : nearby?.busStops[0] ? 'bus' : L.commuteKm <= 6 ? 'bike' : 'bus';
    return { today, win, habit, alt };
  }, [aq, nearby, L.commuteKm]);

  const run = () => {
    if (!aq || !ctx) return;
    setLoading(true); setErr(null);
    api.impact.choices({
      pm2_5: aq.current.pm2_5, habitPm2_5: ctx.habit, bestPm2_5: ctx.win?.pm2_5 ?? aq.current.pm2_5,
      lifestyle: L, ageGroup: age, alternativeMode: ctx.alt,
    }).then(setRes).catch((e: Error) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(run, [aq?.current.time, age, L.commute, L.commuteKm, L.commuteDuration, L.maskType, L.hasPurifier, L.windowType, L.vehicle, L.hasAC, ctx?.alt]); // eslint-disable-line
  useEffect(() => { api.impact.factors().then(setFactors).catch(() => {}); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const doneToday = new Set(profile.completed.filter((c) => c.doneAt.slice(0, 10) === today).map((c) => c.id));
  const weekAgo = Date.now() - 7 * 864e5;
  const week = profile.completed.filter((c) => new Date(c.doneAt).getTime() >= weekAgo);
  const weekDose = week.reduce((s, c) => s + c.doseAvoided_ug, 0);
  const weekCo2 = week.reduce((s, c) => s + c.co2Avoided_g, 0);
  const totalCo2 = profile.completed.reduce((s, c) => s + c.co2Avoided_g, 0);

  const title = (c: any): { h: string; sub: string } => {
    const i = c.inputs;
    switch (c.id) {
      case 'shift_outdoor': return { h: `Move your outdoor walk/play from your usual time to the clean window${ctx?.win ? ' ' + fmtWin(ctx.win) : ''}`, sub: `PM2.5 ${i.habitPm2_5} → ${i.bestPm2_5} µg/m³ (1 h of moderate activity)` };
      case 'wear_n95': return { h: 'Wear a fitted N95 / FFP2 on your commute', sub: `${MODE_LABEL[i.commuteMode] ?? i.commuteMode}, ${i.hours} h/day round trip, from ${i.maskNow === 'none' ? 'no mask' : i.maskNow + ' mask'}` };
      case 'purifier_closed': return { h: 'Keep windows closed and run a HEPA purifier at home', sub: `8 h indoors at outdoor PM2.5 ${i.pm2_5.toFixed(0)} µg/m³` };
      case 'switch_commute': return { h: `Switch your commute to ${MODE_LABEL[c.alternativeMode] ?? c.alternativeMode}${c.alternativeMode === 'metro' && nearby?.transit[0] ? ` (nearest: ${nearby.transit[0].name}, ${nearby.transit[0].dist} km)` : c.alternativeMode === 'bus' && nearby?.busStops[0] ? ` (nearest stop: ${nearby.busStops[0].name}, ${nearby.busStops[0].dist} km)` : ''}`, sub: `${i.km_roundTrip} km round trip per day` };
      case 'wfh_day': return { h: 'Work from home for a day', sub: `Skips a ${i.km_roundTrip} km round-trip commute` };
      default: return { h: c.id, sub: '' };
    }
  };

  const explainNow = () => {
    if (!res) return;
    setExplain({ loading: true });
    api.ai.explainImpact({
      profile: aiProfile(profile),
      impactData: {
        ambientPm2_5: aq?.current.pm2_5, memberAgeGroup: age, inhalationRate_m3h: res.inhalation_m3h,
        choices: res.choices.map((c: any) => ({ id: c.id, doseBefore_ug: c.before_ug, doseAfter_ug: c.after_ug, doseAvoided_ug: c.doseAvoided_ug, reductionPercent: c.percent, co2Avoided_g: c.co2Avoided_g, inputs: c.inputs })),
        weekly: { exposureSaved_ug: +weekDose.toFixed(1), co2Avoided_g: Math.round(weekCo2), actionsMarkedDone: week.length },
        assumptions: res.note,
      },
    }).then((data) => setExplain({ loading: false, data })).catch((e: Error) => setExplain({ loading: false, error: e.message }));
  };

  if (!aq) return <EmptyState icon={<Scale size={32} />} title="Waiting for live air data" hint="Open the Dashboard first." />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 space-y-4">
      <h1 className="text-xl font-extrabold flex items-center gap-2"><Scale size={20} className="text-brand" />{t('impact.title')}</h1>
      <p className="text-sm text-fg/70">See how each choice changes the amount of PM2.5 you actually breathe in. Numbers come from a documented formula applied to live data — <strong>not</strong> from the AI.</p>

      {/* SCORE */}
      <Card>
        <SectionTitle icon={<Trophy size={16} className="text-brand" />}>This week</SectionTitle>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="glass p-3"><p className="label">{t('impact.saved')}</p><p className="text-2xl font-extrabold tabular-nums text-[#009E73]">{weekDose.toFixed(0)}<span className="text-xs ml-0.5">µg</span></p><p className="text-[11px] text-fg/60">PM2.5 not inhaled</p></div>
          <div className="glass p-3"><p className="label">CO₂ (7 d)</p><p className="text-2xl font-extrabold tabular-nums">{(weekCo2 / 1000).toFixed(2)}<span className="text-xs ml-0.5">kg</span></p><p className="text-[11px] text-fg/60">avoided</p></div>
          <div className="glass p-3"><p className="label">CO₂ total</p><p className="text-2xl font-extrabold tabular-nums">{(totalCo2 / 1000).toFixed(2)}<span className="text-xs ml-0.5">kg</span></p><p className="text-[11px] text-fg/60">{profile.completed.length} actions done</p></div>
        </div>
        <p className="text-xs text-fg/50 mt-2">Counts only the choices you mark as done below (once per day each), using the numbers on the day you marked them. Stored on this device.</p>
      </Card>

      {ages.length > 1 && (
        <div><p className="label mb-1.5">Calculate for</p>
          <ChoiceChips label="Household member" value={age} onChange={setAge} options={ages.map((a) => ({ v: a, l: AGE_LABEL[a] }))} /></div>
      )}

      {loading && !res && <Card><Spinner label="Calculating with live data…" /></Card>}
      {err && <ErrorState message={err} onRetry={run} />}
      {res && (
        <ul className="space-y-3">
          {res.choices.map((c: any) => {
            const { h, sub } = title(c);
            const done = doneToday.has(c.id);
            return (
              <li key={c.id}>
                <Card>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold leading-snug">{h}</p>
                      <p className="text-xs text-fg/60 mt-0.5">{sub}</p>
                      <Bars before={c.before_ug} after={c.after_ug} />
                      <p className="text-sm mt-2"><strong className="text-[#009E73]">−{c.percent}% PM2.5 dose</strong> ({c.doseAvoided_ug} µg less inhaled){c.co2Avoided_g > 0 && <> · <Leaf size={12} className="inline text-[#009E73]" /> <strong>{(c.co2Avoided_g / 1000).toFixed(2)} kg CO₂</strong>{c.pmEmissionAvoided_mg > 0 && ` · ${c.pmEmissionAvoided_mg} mg PM not emitted`}</>} per day</p>
                    </div>
                    <button aria-pressed={done} onClick={() => done ? unmarkDone(c.id) : markDone({ id: c.id, doneAt: new Date().toISOString(), doseAvoided_ug: c.doseAvoided_ug, co2Avoided_g: c.co2Avoided_g })}
                      className={`shrink-0 chip !px-3 !py-2 ${done ? 'chip-on' : ''}`}>{done ? <><Check size={14} />Done</> : 'Mark done'}</button>
                  </div>
                  <p className="text-[11px] text-fg/45 mt-2 font-mono break-words">{c.formula}</p>
                </Card>
              </li>
            );
          })}
          {res.choices.length === 0 && <EmptyState icon={<Check size={28} />} title="You’re already using the lowest-exposure options" />}
        </ul>
      )}

      {/* GEMINI */}
      {res && (
        <Card>
          <SectionTitle icon={<Sparkles size={16} className="text-brand" />} right={<button className="btn-primary !py-1.5" onClick={explainNow} disabled={explain.loading}>Explain in plain language</button>}>AI explanation</SectionTitle>
          {explain.loading && <Spinner label="Groq is explaining the numbers…" />}
          {explain.error && <ErrorState message={explain.error} onRetry={explainNow} compact />}
          {explain.data && (
            <div className="space-y-3 text-sm">
              <p className="font-bold text-base">{explain.data.headline}</p>
              <ul className="list-disc pl-5 space-y-1">{explain.data.explanation.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
              <p className="rounded-xl bg-fg/5 border border-fg/10 p-3">🧒👵 {explain.data.forKidsAndElders}</p>
              <p><strong>Next step: </strong>{explain.data.nextStep}</p>
              <p className="text-fg/60 text-xs">⚠ {explain.data.uncertainty}</p>
            </div>
          )}
          {!explain.data && !explain.loading && !explain.error && <p className="text-sm text-fg/60">Groq will restate the engine’s numbers in friendly words for kids and elders — it can’t change them.</p>}
        </Card>
      )}

      {/* METHODOLOGY */}
      <Card>
        <button className="w-full flex items-center justify-between font-bold" onClick={() => setOpenMethod(!openMethod)} aria-expanded={openMethod}>
          <span>📐 {t('impact.methodology')}</span><ChevronDown size={16} className={`transition-transform ${openMethod ? 'rotate-180' : ''}`} />
        </button>
        {openMethod && <Methodology res={res} factors={factors} />}
      </Card>
      <p className="text-xs text-fg/50">Always uncertain: concentrations are model estimates at a grid cell; real exposure depends on your exact route, building, fit of mask and behaviour. Use for comparing choices, not as a medical measurement.</p>
      <Disclaimer />
    </div>
  );
}

function Methodology({ res, factors }: { res: any; factors: any }) {
  return (
    <div className="mt-3 space-y-4 text-sm">
      <p><strong>Dose</strong> (µg) = concentration (µg/m³) × inhalation rate (m³/h) × hours. Concentration is adjusted for where you are (indoor/outdoor ratio), how you travel (mode factor) and any mask (1 − filtration efficiency). CO₂ = (EF<sub>current</sub> − EF<sub>alternative</sub>) g/km × distance.</p>
      {factors ? (<>
        <Table title="Inhalation rate (m³/h)" rows={Object.entries(factors.inhalationRates).map(([k, v]: any) => [k, v])} src={res?.methodology?.inhalationSource} />
        <Table title="Indoor / outdoor PM2.5 ratio" rows={Object.entries(factors.infiltrationFactors).map(([k, v]: any) => [k.replace(/_/g, ' '), v])} src={res?.methodology?.infiltrationSource} />
        <Table title="Commute exposure factor (× ambient)" rows={Object.entries(factors.commuteModes).map(([k, v]: any) => [k.replace(/_/g, ' '), `${v.factor} — ${v.description}`])} src={res?.methodology?.commuteSource} />
        <Table title="Mask filtration" rows={Object.entries(factors.maskFiltration).map(([k, v]: any) => [k, `${Math.round(v.efficiency * 100)}% — ${v.description}`])} src={res?.methodology?.maskSource} />
        <Table title="Emission factors (per passenger-km)" rows={Object.entries(factors.emissionFactors).map(([k, v]: any) => [MODE_LABEL[k] ?? k, `${v.co2_g_per_km} g CO₂ · ${v.pm_mg_per_km} mg PM — ${v.source}`])} src={res?.methodology?.emissionSource} />
      </>) : <Skeleton className="h-24" />}
      <ul className="list-disc pl-5 text-fg/70 space-y-1">
        <li>Moderate exercise is modelled as 2× resting ventilation (US EPA Exposure Factors Handbook).</li>
        <li>N95 efficiency is the nominal NIOSH value (95%); real-world fit leakage lowers it.</li>
        <li>In-vehicle and metro factors are averages from published studies and vary by city, route and ventilation setting.</li>
        <li>Emission factors are for average Indian conditions; occupancy for public transport is assumed average.</li>
      </ul>
    </div>
  );
}
function Table({ title, rows, src }: { title: string; rows: [string, any][]; src?: string }) {
  return (
    <div>
      <p className="label mb-1">{title}</p>
      <dl className="divide-y divide-fg/10 rounded-xl border border-fg/10 overflow-hidden">
        {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr] gap-2 px-3 py-1.5 text-xs"><dt className="font-semibold capitalize">{k}</dt><dd className="text-fg/75 break-words">{String(v)}</dd></div>)}
      </dl>
      {src && <p className="text-[11px] text-fg/50 mt-1">Source: {src}</p>}
    </div>
  );
}
