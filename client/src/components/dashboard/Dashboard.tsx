import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Wind, Droplets, Thermometer, Gauge, Layers, Eye, Sparkles, Radio, Map as MapIcon, Bell, Share2, GitCompare, ChevronRight } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useProfileStore } from '../../store/profileStore';
import { useAirData } from '../../hooks/useAirData';
import { aqiColor, aqiGradient, naqiCategoryColor, windDirection, weatherIcon } from '../../lib/aqi';
import { Card, SectionTitle, Skeleton, ErrorState, Pill } from '../ui/primitives';
import AqiGauge from './AqiGauge';
import AirChart from './AirChart';
import CityCompare from './CityCompare';
import AlertSettings from './AlertSettings';
import type { Page } from '../../App';

const MapView = lazy(() => import('./MapView'));
const ShareCard = lazy(() => import('./ShareCard'));

const POLLUTANTS = [
  { k: 'pm2_5', label: 'PM2.5', who: 15, unit: 'µg/m³', div: 1 },
  { k: 'pm10', label: 'PM10', who: 45, unit: 'µg/m³', div: 1 },
  { k: 'no2', label: 'NO₂', who: 25, unit: 'µg/m³', div: 1 },
  { k: 'o3', label: 'O₃', who: 100, unit: 'µg/m³', div: 1 },
  { k: 'so2', label: 'SO₂', who: 40, unit: 'µg/m³', div: 1 },
  { k: 'co', label: 'CO', who: 4, unit: 'mg/m³', div: 1000 },
] as const;

export default function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { t } = useTranslation();
  const { profile } = useProfileStore();
  const { airQuality: aq, weather: wx, nearby, waqi, smogExplanation, isLoadingAQ, errorAQ, errorWeather, errorNearby, errorSmog } = useDataStore();
  const { fetchAll, activeLocation: loc } = useAirData();
  const [showShare, setShowShare] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => { document.title = aq ? `AQI ${aq.current.usAqi} · ${loc?.name} — AirAlly` : 'AirAlly — Urban Air Quality Assistant'; }, [aq, loc?.name]);

  if (!loc) return null;
  const retry = () => fetchAll();

  if (!aq && isLoadingAQ) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4" aria-busy="true">
        <p className="sr-only" role="status">{t('dashboard.loading')}</p>
        <Skeleton className="h-72" /><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-60" />
      </div>
    );
  }
  if (!aq) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState message={errorAQ || undefined} onRetry={retry} /></div>;
  }

  const c = aq.current;
  const color = aqiColor(c.usAqi);
  const nowIdx = wx ? wx.hourly.time.indexOf(c.time.slice(0, 13) + ':00') : -1;
  const blh = nowIdx >= 0 ? wx!.hourly.boundaryLayerHeight[nowIdx] : null;

  return (
    <div style={{ background: aqiGradient(c.usAqi) }}>
      <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
        {/* HERO */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} aria-hidden="true" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label">{t('dashboard.liveAqi')}</p>
              <h1 className="text-2xl font-extrabold tracking-tight">{loc.name}<span className="text-fg/60 font-semibold text-sm">{loc.state ? `, ${loc.state}` : ''}</span></h1>
            </div>
            <Pill color={color}>{c.usAqi > 150 ? '⚠ ' : ''}{aq.usCategory.label}</Pill>
          </div>
          <AqiGauge value={c.usAqi} label={aq.usCategory.label} emoji={aq.usCategory.emoji} />
          <div className="grid grid-cols-3 gap-2 text-center mt-2">
            <div className="tile p-3"><p className="label">{t('dashboard.naqi')}</p><p className="text-2xl font-extrabold tabular-nums tracking-tight">{aq.naqi.value}</p><p className="text-xs font-bold" style={{ color: naqiCategoryColor(aq.naqi.category) }}>{aq.naqi.category}</p></div>
            <div className="tile p-3"><p className="label">{t('dashboard.dominant')}</p><p className="text-2xl font-extrabold">{aq.naqi.dominantPollutant}</p><p className="text-xs text-fg/60">by CPCB sub-index</p></div>
            <div className="tile p-3"><p className="label">PM2.5</p><p className="text-2xl font-extrabold tabular-nums">{c.pm2_5.toFixed(0)}</p><p className="text-xs text-fg/60">µg/m³</p></div>
          </div>
          <p className="text-xs text-fg/60 mt-3">{t('dashboard.lastUpdated')}: {new Date(c.time).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })} (local) · Open-Meteo CAMS model{aq.cached ? ' · cached ≤10 min' : ''}</p>
          {(c.usAqi >= 200) && <p role="alert" className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm font-semibold">🚨 Air is {aq.usCategory.label.toLowerCase()}. Avoid outdoor exertion, keep children and seniors indoors, and wear a fitted N95 if you must go out.</p>}
        </Card>

        {/* WHY */}
        <Card>
          <SectionTitle icon={<Sparkles size={16} className="text-brand" />}>{t('dashboard.smogReason')}</SectionTitle>
          {smogExplanation ? <p className="text-sm leading-relaxed">{smogExplanation}</p>
            : errorSmog ? <ErrorState compact message={errorSmog} onRetry={retry} />
            : <div className="space-y-2" aria-busy="true"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
          <p className="text-[11px] text-fg/50 mt-2">AI explanation generated by Gemini from the live wind, boundary-layer and humidity values below.</p>
        </Card>

        {/* POLLUTANTS */}
        <section aria-label="Pollutants">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {POLLUTANTS.map((p, i) => {
              const v = ((c as any)[p.k] as number) / p.div;
              const ratio = v / p.who;
              const col = ratio <= 1 ? '#009E73' : ratio <= 2 ? '#E69F00' : ratio <= 5 ? '#D55E00' : '#CC79A7';
              return (
                <motion.div key={p.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass p-3">
                  <div className="flex justify-between items-center"><p className="text-sm font-bold">{p.label}</p><span className="h-2.5 w-2.5 rounded-full" style={{ background: col }} aria-hidden="true" /></div>
                  <p className="text-2xl font-extrabold tabular-nums mt-1">{v < 10 ? v.toFixed(1) : v.toFixed(0)}<span className="text-xs font-semibold text-fg/50 ml-1">{p.unit}</span></p>
                  <div className="h-1.5 rounded-full bg-fg/10 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(ratio / 8, 1) * 100}%`, background: col }} /></div>
                  <p className="text-xs mt-1.5 text-fg/70"><strong style={{ color: col }}>{ratio.toFixed(1)}×</strong> WHO 24h guideline of {p.who} {p.unit}</p>
                </motion.div>
              );
            })}
          </div>
          <p className="text-[11px] text-fg/50 mt-2">WHO Global Air Quality Guidelines 2021 (24-hour). India NAQI uses CPCB breakpoints on current PM2.5 / PM10 — official NAQI uses 24-h averages, so treat as indicative.</p>
        </section>

        {/* GROUND STATION */}
        {waqi && (
          <Card>
            <SectionTitle icon={<Radio size={16} className="text-brand" />}>{t('dashboard.groundStation')} vs {t('dashboard.modelData')}</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="tile p-3.5"><p className="label">Ground station</p><p className="text-3xl font-extrabold tabular-nums" style={{ color: aqiColor(waqi.aqi) }}>{waqi.aqi}</p><p className="text-xs text-fg/60 truncate">{waqi.stationName}</p><p className="text-xs text-fg/60">PM2.5 {waqi.readings.pm2_5 ?? '—'} · {waqi.time}</p></div>
              <div className="tile p-3.5"><p className="label">Model (Open-Meteo)</p><p className="text-3xl font-extrabold tabular-nums" style={{ color }}>{c.usAqi}</p><p className="text-xs text-fg/60">satellite + chemistry model</p><p className="text-xs text-fg/60">PM2.5 {c.pm2_5.toFixed(0)}</p></div>
            </div>
            <p className="text-[11px] text-fg/50 mt-2">Station values are measured at one site (WAQI, US-EPA scale); the model is a grid-cell estimate, so they can differ.</p>
          </Card>
        )}

        {/* CHART */}
        <Card><SectionTitle>{t('dashboard.history')} · {t('dashboard.forecast')}</SectionTitle><AirChart aq={aq} /></Card>

        {/* WEATHER */}
        <Card>
          <SectionTitle icon={<Wind size={16} className="text-brand" />}>{t('dashboard.weatherContext')}</SectionTitle>
          {wx ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Stat icon={<Thermometer size={14} />} label="Temperature" value={`${wx.current.temperature.toFixed(0)}°C`} sub={`${weatherIcon(wx.current.weatherCode)} feels ${wx.current.apparentTemperature.toFixed(0)}°`} />
              <Stat icon={<Droplets size={14} />} label="Humidity" value={`${wx.current.humidity}%`} />
              <Stat icon={<Wind size={14} />} label="Wind" value={`${wx.current.windSpeed.toFixed(0)} km/h`} sub={`from ${windDirection(wx.current.windDirection)}${wx.current.windSpeed < 8 ? ' · stagnant air' : ''}`} />
              <Stat icon={<Layers size={14} />} label="Boundary layer" value={blh != null ? `${Math.round(blh)} m` : '—'} sub={blh != null ? (blh < 500 ? 'shallow — traps pollution' : blh < 1000 ? 'moderate mixing' : 'deep — disperses') : undefined} />
              <Stat icon={<Gauge size={14} />} label="Pressure" value={`${wx.current.pressure.toFixed(0)} hPa`} />
              <Stat icon={<Eye size={14} />} label="Visibility" value={`${(wx.current.visibility / 1000).toFixed(1)} km`} />
            </div>
          ) : <ErrorState compact message={errorWeather} onRetry={retry} />}
        </Card>

        {/* MAP */}
        <Card>
          <SectionTitle icon={<MapIcon size={16} className="text-brand" />} right={nearby && <span className="text-xs text-fg/60">{nearby.total} places · {nearby.queryRadius / 1000} km</span>}>{t('dashboard.nearbyPlaces')}</SectionTitle>
          <Suspense fallback={<Skeleton className="h-72" />}><MapView lat={loc.lat} lon={loc.lon} nearby={nearby} radius={nearby?.queryRadius} /></Suspense>
          {errorNearby && <div className="mt-3"><ErrorState compact message={`Nearby places (OpenStreetMap Overpass) unavailable: ${errorNearby}`} onRetry={retry} /></div>}
          {nearby && (
            <ul className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              {([['🚇', 'Nearest metro / rail', nearby.transit[0]], ['🚌', 'Nearest bus stop', nearby.busStops[0]], ['🌳', 'Nearest park', nearby.parks[0]], ['🚲', 'Cycle rental', nearby.bikeRentals[0]], ['🏥', 'Nearest clinic / hospital', nearby.clinics[0]]] as const).map(([ic, label, p]) => (
                <li key={label} className="tile px-3.5 py-2.5 flex justify-between gap-2"><span className="text-fg/70">{ic} {label}</span><span className="font-semibold text-right truncate">{p ? `${p.name} · ${p.dist} km` : 'none within radius'}</span></li>
              ))}
            </ul>
          )}
        </Card>

        {/* QUICK LINKS */}
        <div className="grid grid-cols-2 gap-3">
          {([['plan', '📅', t('nav.plan'), 'Hour-by-hour plan', 'from-sky-400/25 to-emerald-400/15'], ['chat', '💬', t('nav.chat'), 'Ask anything', 'from-violet-400/25 to-sky-400/15']] as const).map(([pg, ic, title, sub, grad]) => (
            <button key={pg} onClick={() => onNavigate(pg)} className={`glass-hover group relative overflow-hidden p-4 text-left bg-gradient-to-br ${grad}`}>
              <span className="text-2xl block mb-2 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{ic}</span>
              <p className="font-bold">{title}</p>
              <p className="text-xs text-fg/60 mt-1 flex items-center">{sub} <ChevronRight size={12} className="transition-transform group-hover:translate-x-1" /></p>
            </button>
          ))}
        </div>

        {/* COMMUNITY */}
        <Card>
          <SectionTitle icon={<Share2 size={16} className="text-brand" />} right={<button className="chip" onClick={() => setShowShare(!showShare)} aria-expanded={showShare}>{showShare ? 'Hide' : 'Create report card'}</button>}>Community report</SectionTitle>
          {showShare ? <Suspense fallback={<Skeleton className="h-72" />}><ShareCard aq={aq} place={loc.name} /></Suspense> : <p className="text-sm text-fg/60">Make a shareable image of today’s AQI, cleanest window and top 3 actions for WhatsApp groups, schools and RWAs.</p>}
        </Card>
        <Card>
          <SectionTitle icon={<GitCompare size={16} className="text-brand" />} right={<button className="chip" onClick={() => setShowCompare(!showCompare)} aria-expanded={showCompare}>{showCompare ? 'Hide' : 'Compare cities'}</button>}>City comparison</SectionTitle>
          {showCompare ? <CityCompare homeName={loc.name} homeLat={loc.lat} homeLon={loc.lon} /> : <p className="text-sm text-fg/60">Compare live AQI of up to 4 cities side by side.</p>}
        </Card>
        <Card><SectionTitle icon={<Bell size={16} className="text-brand" />}>Alerts</SectionTitle><AlertSettings /></Card>
        <LocationsNote count={profile.locations.length} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (<div className="tile p-3.5"><p className="label flex items-center gap-1">{icon}{label}</p><p className="text-lg font-extrabold mt-0.5">{value}</p>{sub && <p className="text-xs text-fg/60">{sub}</p>}</div>);
}
function LocationsNote({ count }: { count: number }) {
  return <p className="text-xs text-fg/50 text-center">{count}/5 saved locations · switch from the top bar</p>;
}
