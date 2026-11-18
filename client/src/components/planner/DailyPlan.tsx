import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, ShieldAlert, Clock, Wind, Users } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useProfileStore } from '../../store/profileStore';
import { api } from '../../lib/api';
import { useAiResource } from '../../store/aiStore';
import { aiProfile, profileKey } from '../../lib/profileKey';
import { formatHour, aqiColor } from '../../lib/aqi';
import { Card, SectionTitle, Skeleton, ErrorState, Disclaimer, Spinner, EmptyState } from '../ui/primitives';

const RISK: Record<string, { c: string; l: string }> = {
  low: { c: '#009E73', l: 'Low risk' }, moderate: { c: '#F0E442', l: 'Moderate risk' }, high: { c: '#E69F00', l: 'High risk' },
  very_high: { c: '#D55E00', l: 'Very high risk' }, severe: { c: '#CC79A7', l: 'Severe risk' },
};
const PRI: Record<string, string> = { normal: '#009E73', caution: '#E69F00', high: '#D55E00' };

function pmColor(pm: number) { return pm < 55 ? '#009E73' : pm <= 100 ? '#E69F00' : '#D55E00'; }

export default function DailyPlan() {
  const { t } = useTranslation();
  const { profile } = useProfileStore();
  const { airQuality: aq, weather, nearby } = useDataStore();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const loc = profile.locations[profile.activeLocationIndex];

  const key = aq ? `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}|${aq.current.time.slice(0, 13)}|${profileKey(profile)}` : null;
  const { data: plan, loading, error, regenerate } = useAiResource<any>('plan', key, () =>
    api.gemini.dailyPlan({ airQuality: aq, weather, nearbyPlaces: nearby, profile: aiProfile(profile) }));

  if (!aq) return <EmptyState icon={<Clock size={32} />} title="Waiting for live air data" hint="Open the Dashboard to load your location first." />;

  const rows = plan?.[day] ?? [];
  const dayLabel = (d: 'today' | 'tomorrow') => d === 'today' ? t('plan.today') : t('plan.tomorrow');

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold flex items-center gap-2"><Sparkles size={20} className="text-brand" />{t('plan.title')}</h1>
        <button className="btn-ghost" onClick={() => regenerate()} disabled={loading} aria-label="Regenerate plan"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {loading && !plan && <Card><Spinner label={t('plan.generating')} /><div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div></Card>}
      {error && <ErrorState message={error} onRetry={() => regenerate()} />}

      {plan && (<>
        <Card>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border" style={{ color: RISK[plan.overallRisk]?.c, borderColor: RISK[plan.overallRisk]?.c + '88', background: RISK[plan.overallRisk]?.c + '22' }}>
              <ShieldAlert size={13} />{RISK[plan.overallRisk]?.l}
            </span>
            <span className="text-xs text-fg/50">{plan.cached ? 'cached · ' : ''}generated {new Date(plan.generatedAt).toLocaleTimeString('en', { timeStyle: 'short' })}</span>
          </div>
          <p className="font-semibold leading-relaxed">{plan.summary}</p>
          <p className="text-sm text-fg/70 mt-2"><strong>Why: </strong>{plan.whyBadToday}</p>
        </Card>

        <div className="grid sm:grid-cols-2 gap-3">
          <Card>
            <SectionTitle icon={<Clock size={16} className="text-[#009E73]" />}>{t('plan.bestWindows')}</SectionTitle>
            <ul className="space-y-2">
              {plan.bestOutdoorWindows.map((w: any, i: number) => (
                <li key={i} className="rounded-xl border p-3" style={{ borderColor: '#009E7388', background: '#009E7314' }}>
                  <p className="font-bold">{dayLabel(w.day)} · {formatHour(w.startHour)}–{formatHour(w.endHour)} <span className="text-xs font-semibold text-fg/60">forecast PM2.5 {w.pm2_5} µg/m³</span></p>
                  {w.reason && <p className="text-sm text-fg/80 mt-1">{w.reason}</p>}
                </li>
              ))}
              {!plan.bestOutdoorWindows.length && <li className="text-sm text-fg/60">No outdoor window with forecast data remains today.</li>}
            </ul>
          </Card>
          <Card>
            <SectionTitle icon={<Wind size={16} className="text-brand" />}>{t('plan.ventilation')}</SectionTitle>
            <ul className="space-y-2">
              {plan.ventilationWindows.map((w: any, i: number) => (
                <li key={i} className="rounded-xl border border-fg/10 bg-fg/5 p-3">
                  <p className="font-bold">{dayLabel(w.day)} · {formatHour(w.startHour)}–{formatHour(w.endHour)} <span className="text-xs font-semibold text-fg/60">forecast PM2.5 {w.pm2_5} µg/m³</span></p>
                  {w.tip && <p className="text-sm text-fg/80 mt-1">{w.tip}</p>}
                </li>
              ))}
              {!plan.ventilationWindows.length && <li className="text-sm text-fg/60">No ventilation window found.</li>}
            </ul>
          </Card>
        </div>

        <Card>
          <div className="flex gap-2 mb-3" role="tablist">
            {(['today', 'tomorrow'] as const).map((d) => (
              <button key={d} role="tab" aria-selected={day === d} className={`chip ${day === d ? 'chip-on' : ''}`} onClick={() => setDay(d)}>{dayLabel(d)}</button>
            ))}
          </div>
          {rows.length === 0 && <p className="text-sm text-fg/60">No hours left to plan for this day.</p>}
          <ol className="relative border-l border-fg/15 ml-2 space-y-3">
            {rows.map((h: any, i: number) => (
              <motion.li key={h.hour} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="pl-4 relative">
                <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-canvas" style={{ background: pmColor(h.pm2_5_ref) }} aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-bold tabular-nums w-14">{formatHour(h.hour)}</span>
                  <span className="text-lg" aria-hidden="true">{h.icon}</span>
                  <span className="font-semibold">{h.activity}</span>
                  <span className="ml-auto text-xs font-bold rounded-full px-2 py-0.5" style={{ color: pmColor(h.pm2_5_ref), background: pmColor(h.pm2_5_ref) + '22' }}>PM2.5 {Math.round(h.pm2_5_ref)}</span>
                  {h.maskNeeded && <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-fg/10">😷 {h.maskType || t('plan.maskRequired')}</span>}
                </div>
                <p className="text-sm text-fg/75 mt-0.5">{h.advice}</p>
              </motion.li>
            ))}
          </ol>
        </Card>

        <Card>
          <SectionTitle icon={<Users size={16} className="text-brand" />}>{t('plan.memberAdvice')}</SectionTitle>
          <ul className="space-y-2">
            {plan.memberAdvice.map((m: any, i: number) => (
              <li key={i} className="rounded-xl border p-3" style={{ borderColor: PRI[m.priority] + '77', background: PRI[m.priority] + '12' }}>
                <p className="font-bold text-sm">{m.member}{m.priority !== 'normal' && <span className="ml-2 text-xs uppercase" style={{ color: PRI[m.priority] }}>{m.priority}</span>}</p>
                <p className="text-sm text-fg/80 mt-0.5">{m.advice}</p>
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-xs text-fg/50">Numbers shown (PM2.5 per hour and windows) come straight from the live Open-Meteo forecast; Gemini writes the advice around them. Forecasts can change — the plan refreshes hourly. Current PM2.5 <strong style={{ color: aqiColor(aq.current.usAqi) }}>{aq.current.pm2_5.toFixed(0)}</strong> µg/m³.</p>
        <Disclaimer />
      </>)}
    </div>
  );
}
