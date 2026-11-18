import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Wind, Droplets, Thermometer, Gauge, Layers, Eye, Sparkles, Radio, Map as MapIcon, Bell, Share2, GitCompare, ChevronRight, CalendarClock, Home, Scale, MessageCircle, Leaf, Clock } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useProfileStore } from '../../store/profileStore';
import { useAirData } from '../../hooks/useAirData';
import { bestWindows, fmtWin } from '../../lib/windows';
import { addDaysISO } from '../../lib/dates';
import { aqiColor, formatHour, naqiCategoryColor, windDirection, weatherIcon } from '../../lib/aqi';
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
  const { profile, setActiveLocation } = useProfileStore();
  const { airQuality: aq, weather: wx, nearby, waqi, smogExplanation, isLoadingAQ, errorAQ, errorWeather, errorNearby, errorSmog } = useDataStore();
  const { fetchAll, activeLocation: loc } = useAirData();
  const [showShare, setShowShare] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => { document.title = aq ? `AQI ${aq.current.usAqi} · ${loc?.name} — AirAlly` : 'AirAlly — Urban Air Quality Assistant'; }, [aq, loc?.name]);

  if (!loc) return null;
  const retry = () => fetchAll();

  if (!aq && isLoadingAQ) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 lg:px-6 grid lg:grid-cols-12 gap-4" aria-busy="true">
        <p className="sr-only" role="status">{t('dashboard.loading')}</p>
        <Skeleton className="h-96 lg:col-span-8 !rounded-[1.25rem]" /><Skeleton className="h-96 lg:col-span-4 !rounded-[1.25rem]" />
        <Skeleton className="h-64 lg:col-span-8 !rounded-[1.25rem]" /><Skeleton className="h-64 lg:col-span-4 !rounded-[1.25rem]" />
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
  const pm25Ratio = c.pm2_5 / 15;
  const today = c.time.slice(0, 10);
  const nowH = parseInt(c.time.slice(11, 13), 10);
  const bestWin = bestWindows(aq, today, 2, 1, nowH + 1)[0] ?? bestWindows(aq, addDaysISO(today, 1), 2, 1)[0] ?? null;
  const hi = aq.hourly.time.indexOf(c.time.slice(0, 13) + ':00');
  const trend = (hi >= 0 ? aq.hourly.time.slice(hi, hi + 12).map((tm, k) => ({ h: parseInt(tm.slice(11, 13), 10), v: aq.hourly.pm2_5[hi + k] as number })) : []).filter((x) => x.v != null);
  const trendMax = Math.max(...trend.map((x) => x.v), 1), trendMin = Math.min(...trend.map((x) => x.v));

  return (
    <div className="mx-auto max-w-[1320px] px-4 lg:px-6 pt-1 pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* HERO — live AQI */}
        <Card className="lg:col-span-8 relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label">{t('dashboard.liveAqi')}</p>
              <h2 className="text-2xl font-extrabold tracking-tight">{loc.name}<span className="text-fg/50 font-semibold text-sm">{loc.state ? `, ${loc.state}` : ''}</span></h2>
            </div>
            <Pill color={color}>{c.usAqi > 150 ? '⚠ ' : ''}{aq.usCategory.label}</Pill>
          </div>
          <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-center mt-1">
            <AqiGauge value={c.usAqi} label={aq.usCategory.label} emoji={aq.usCategory.emoji} />
            <div className="grid grid-cols-3 sm:grid-cols-1 gap-3">
              <div className="sm:border-b border-fg/10 sm:pb-3">
                <p className="label">{t('dashboard.naqi')}</p>
                <p className="text-3xl font-extrabold tabular-nums tracking-tight">{aq.naqi.value}</p>
                <p className="text-xs font-bold" style={{ color: naqiCategoryColor(aq.naqi.category) }}>{aq.naqi.category}</p>
              </div>
              <div className="sm:border-b border-fg/10 sm:pb-3">
                <p className="label">{t('dashboard.dominant')}</p>
                <p className="text-3xl font-extrabold tracking-tight">{aq.naqi.dominantPollutant}</p>
                <p className="text-xs text-fg/55">by CPCB sub-index</p>
              </div>
              <div>
                <p className="label">PM2.5</p>
                <p className="text-3xl font-extrabold tabular-nums tracking-tight">{c.pm2_5.toFixed(0)}<span className="text-xs font-semibold text-fg/50 ml-1">µg/m³</span></p>
                <p className="text-xs font-bold" style={{ color: pm25Ratio <= 1 ? '#009E73' : '#D55E00' }}>{pm25Ratio.toFixed(1)}× WHO limit</p>
              </div>
            </div>
          </div>

          <div className="tile p-3.5 mt-3">
            <p className="flex items-center gap-2 text-sm font-bold mb-1"><span className="icon-badge"><Sparkles size={14} /></span>{t('dashboard.smogReason')}</p>
            {smogExplanation ? <p className="text-sm leading-relaxed text-fg/85">{smogExplanation}</p>
              : errorSmog ? <ErrorState compact message={errorSmog} onRetry={retry} />
              : <div className="space-y-2 mt-2" aria-busy="true"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
            <p className="text-[11px] text-fg/45 mt-2">AI explanation generated by Groq from the live wind, boundary-layer and humidity values.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3" aria-label="Right-now guidance">
            {([
              ['🏃', 'Outdoor activity', c.pm2_5 < 55 ? 'Fine for most people' : c.pm2_5 <= 100 ? 'Take it easy, shorten outings' : 'Avoid strenuous activity', c.pm2_5 < 55 ? '#009E73' : c.pm2_5 <= 100 ? '#E69F00' : '#D55E00'],
              ['😷', 'Mask outdoors', c.pm2_5 > 100 || c.usAqi > 150 ? 'Wear a fitted N95 / FFP2' : c.pm2_5 >= 55 ? 'Optional; helpful for sensitive people' : 'Not needed', c.pm2_5 > 100 || c.usAqi > 150 ? '#D55E00' : c.pm2_5 >= 55 ? '#E69F00' : '#009E73'],
              ['🪟', 'Windows', c.pm2_5 < 55 ? 'Safe to ventilate' : 'Keep closed; ventilate in the cleanest window', c.pm2_5 < 55 ? '#009E73' : '#E69F00'],
            ] as const).map(([ic, title, text, col]) => (
              <div key={title} className="tile p-3 flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5" aria-hidden="true">{ic}</span>
                <div className="min-w-0"><p className="label">{title}</p><p className="text-sm font-bold leading-snug" style={{ color: col }}>{text}</p></div>
              </div>
            ))}
          </div>
          <p className="text-xs text-fg/55 mt-3">{t('dashboard.lastUpdated')}: {new Date(c.time).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })} (local) · Open-Meteo CAMS model{aq.cached ? ' · cached ≤10 min' : ''}</p>
          {(c.usAqi >= 200) && <p role="alert" className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm font-semibold">🚨 Air is {aq.usCategory.label.toLowerCase()}. Avoid outdoor exertion, keep children and seniors indoors, and wear a fitted N95 if you must go out.</p>}
        </Card>

        {/* RIGHT — status card, quick actions, saved locations */}
        <Card className="lg:col-span-4 flex flex-col">
          <div className="flex items-baseline justify-between">
            <h2 className="font-extrabold text-lg tracking-tight">My air</h2>
            <span className="label">Quick actions</span>
          </div>
          <div className="lime-card mt-3 p-4 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/20" aria-hidden="true" />
            <div className="flex items-start justify-between relative">
              <span className="text-xs font-semibold opacity-80">Live status</span>
              <span className="text-sm font-extrabold tracking-tight">AirAlly</span>
            </div>
            <p className="text-5xl font-extrabold tabular-nums tracking-tighter mt-4 relative">{c.usAqi}<span className="text-sm font-bold ml-1.5 opacity-70">US AQI</span></p>
            <div className="flex items-end justify-between mt-3 relative text-xs font-semibold">
              <span className="truncate pr-2">{loc.name}</span>
              <span className="shrink-0">{aq.usCategory.label}</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-4">
            {([['plan', CalendarClock, t('nav.plan')], ['indoor', Home, t('nav.indoor')], ['alternatives', Leaf, t('nav.alternatives')], ['impact', Scale, t('nav.impact')], ['chat', MessageCircle, t('nav.chat')]] as const).map(([pg, Icon, label]) => (
              <button key={pg} onClick={() => onNavigate(pg)} title={label} className="group flex flex-col items-center gap-1.5 text-[10px] leading-tight font-semibold text-fg/70 hover:text-fg text-center">
                <span className="h-11 w-11 rounded-xl border border-fg/10 inline-flex items-center justify-center group-hover:bg-lime group-hover:border-lime group-hover:text-[rgb(var(--lime-ink))] transition-colors"><Icon size={17} aria-hidden="true" /></span>
                <span className="break-words w-full">{label}</span>
              </button>
            ))}
          </div>

          {bestWin && (
            <div className="tile p-3 mt-4 flex items-center gap-3">
              <span className="h-9 w-9 rounded-lg bg-lime/40 inline-flex items-center justify-center text-[rgb(var(--brand))] shrink-0"><Clock size={16} /></span>
              <div className="min-w-0">
                <p className="label">Cleanest time outdoors</p>
                <p className="text-sm font-extrabold truncate">{bestWin.date === today ? 'Today' : 'Tomorrow'} · {fmtWin(bestWin)}</p>
                <p className="text-[11px] text-fg/55">forecast PM2.5 {bestWin.pm2_5} µg/m³</p>
              </div>
            </div>
          )}

          {trend.length > 3 && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between"><p className="text-sm font-bold">Next 12 hours</p><span className="text-[11px] text-fg/50">PM2.5 µg/m³</span></div>
              <div className="flex items-end gap-1 h-16 mt-2" role="img" aria-label={`PM2.5 forecast for the next ${trend.length} hours, from ${Math.min(...trend.map((x) => x.v)).toFixed(0)} to ${Math.max(...trend.map((x) => x.v)).toFixed(0)} micrograms per cubic metre`}>
                {trend.map((x) => (
                  <div key={x.h} className="flex-1 rounded-t-[4px] min-h-[3px]" title={`${formatHour(x.h)}: ${x.v.toFixed(0)} µg/m³`} style={{ height: `${Math.max(x.v / trendMax, 0.05) * 100}%`, background: x.v === trendMin ? 'rgb(var(--lime))' : 'rgb(var(--fg) / 0.14)' }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-fg/45 mt-1"><span>{formatHour(trend[0].h)}</span><span>{formatHour(trend[trend.length - 1].h)}</span></div>
            </div>
          )}
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-bold">Saved places</p><span className="text-[11px] text-fg/50">{profile.locations.length}/5</span></div>
            <div className="flex flex-wrap gap-3">
              {profile.locations.map((l, i) => (
                <button key={i} onClick={() => setActiveLocation(i)} aria-label={`Switch to ${l.name}`} aria-pressed={i === profile.activeLocationIndex} className="flex flex-col items-center gap-1 w-14">
                  <span className={`h-11 w-11 rounded-full inline-flex items-center justify-center font-extrabold text-sm transition-all ${i === profile.activeLocationIndex ? 'bg-fg text-canvas ring-2 ring-lime ring-offset-2 ring-offset-surface' : 'bg-fg/[0.07] hover:bg-lime hover:text-[rgb(var(--lime-ink))]'}`}>{(l.name || '?').trim().charAt(0).toUpperCase()}</span>
                  <span className="text-[11px] text-fg/65 truncate max-w-full">{l.label || l.name.split(',')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* CHART */}
        <Card className="lg:col-span-8"><SectionTitle>{t('dashboard.history')} · {t('dashboard.forecast')}</SectionTitle><AirChart aq={aq} /></Card>

        {/* WEATHER */}
        <Card className="lg:col-span-4">
          <SectionTitle icon={<Wind size={15} />}>{t('dashboard.weatherContext')}</SectionTitle>
          {wx ? (
            <ul className="divide-y divide-fg/10 text-sm">
              <StatRow icon={<Thermometer size={14} />} label="Temperature" value={`${wx.current.temperature.toFixed(0)}°C`} sub={`${weatherIcon(wx.current.weatherCode)} feels ${wx.current.apparentTemperature.toFixed(0)}°`} />
              <StatRow icon={<Droplets size={14} />} label="Humidity" value={`${wx.current.humidity}%`} />
              <StatRow icon={<Wind size={14} />} label="Wind" value={`${wx.current.windSpeed.toFixed(0)} km/h`} sub={`from ${windDirection(wx.current.windDirection)}${wx.current.windSpeed < 8 ? ' · stagnant' : ''}`} />
              <StatRow icon={<Layers size={14} />} label="Boundary layer" value={blh != null ? `${Math.round(blh)} m` : '—'} sub={blh != null ? (blh < 500 ? 'shallow — traps pollution' : blh < 1000 ? 'moderate mixing' : 'deep — disperses') : undefined} />
              <StatRow icon={<Gauge size={14} />} label="Pressure" value={`${wx.current.pressure.toFixed(0)} hPa`} />
              <StatRow icon={<Eye size={14} />} label="Visibility" value={`${(wx.current.visibility / 1000).toFixed(1)} km`} />
            </ul>
          ) : <ErrorState compact message={errorWeather} onRetry={retry} />}
        </Card>

        {/* POLLUTANTS */}
        <Card className="lg:col-span-7" aria-label="Pollutants">
          <SectionTitle icon={<Layers size={15} />}>Pollutants vs WHO guideline</SectionTitle>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
            {POLLUTANTS.map((p, i) => {
              const v = ((c as any)[p.k] as number) / p.div;
              const ratio = v / p.who;
              const col = ratio <= 1 ? '#009E73' : ratio <= 2 ? '#E69F00' : ratio <= 5 ? '#D55E00' : '#CC79A7';
              return (
                <motion.li key={p.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-bold"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: col }} aria-hidden="true" />{p.label}</p>
                    <p className="text-sm font-extrabold tabular-nums">{v < 10 ? v.toFixed(1) : v.toFixed(0)}<span className="text-[11px] font-semibold text-fg/50 ml-1">{p.unit}</span></p>
                  </div>
                  <div className="h-2 rounded-full bg-fg/[0.07] mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(ratio / 8, 1) * 100}%`, background: col }} /></div>
                  <p className="text-[11px] mt-1 text-fg/60"><strong style={{ color: col }}>{ratio.toFixed(1)}×</strong> WHO 24h guideline of {p.who} {p.unit}</p>
                </motion.li>
              );
            })}
          </ul>
          <p className="text-[11px] text-fg/50 mt-4">WHO Global Air Quality Guidelines 2021 (24-hour). India NAQI uses CPCB breakpoints on current PM2.5 / PM10 — official NAQI uses 24-h averages, so treat as indicative.</p>
        </Card>

        {/* LIMIT + TIPS */}
        <div className="lg:col-span-5 grid gap-4 content-start">
          <Card>
            <SectionTitle>Today vs WHO limit</SectionTitle>
            {([['PM2.5', c.pm2_5, 15], ['PM10', c.pm10, 45]] as const).map(([label, v, who]) => {
              const pct = Math.min(v / (who * 4), 1) * 100;
              return (
                <div key={label} className="mb-4 last:mb-0">
                  <div className="flex items-baseline justify-between text-sm"><span className="font-bold">{label}</span><span className="tabular-nums"><strong>{v.toFixed(0)}</strong> <span className="text-fg/50 text-xs">/ WHO {who} µg/m³</span></span></div>
                  <div className="relative h-3 rounded-full bg-fg/[0.07] mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-lime hatch transition-all duration-700" style={{ width: `${pct}%`, background: v <= who ? undefined : '#E69F00' }} />
                    <span className="absolute top-0 bottom-0 w-0.5 bg-fg/70" style={{ left: '25%' }} aria-hidden="true" />
                  </div>
                  <p className="text-[11px] text-fg/55 mt-1">{v <= who ? 'Within the WHO 24-hour guideline' : `${(v / who).toFixed(1)}× the guideline (marker = WHO limit)`}</p>
                </div>
              );
            })}
          </Card>
          <Card className="relative overflow-hidden">
            <p className="font-extrabold tracking-tight pr-20">Cut your indoor exposure with a personalised plan</p>
            <p className="text-xs text-fg/60 mt-1.5 pr-20">Ranked actions for your home, purifier sizing and myths to skip.</p>
            <button onClick={() => onNavigate('indoor')} className="mt-3 inline-flex items-center gap-1 text-xs font-bold hover:underline">Read more <ChevronRight size={13} /></button>
            <div className="absolute right-3 bottom-3 grid grid-cols-4 gap-1 opacity-90" aria-hidden="true">
              {[0.2, 0.5, 0.9, 0.35, 0.6, 0.25, 0.8, 0.45, 0.3, 0.7, 0.4, 1].map((o, i) => <i key={i} className="h-4 w-4 rounded-[4px] bg-lime" style={{ opacity: o }} />)}
            </div>
          </Card>
        </div>

        {/* MAP */}
        <Card className="lg:col-span-7">
          <SectionTitle icon={<MapIcon size={15} />} right={nearby && <span className="text-xs text-fg/60">{nearby.total} places · {nearby.queryRadius / 1000} km</span>}>{t('dashboard.nearbyPlaces')}</SectionTitle>
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

        <div className="lg:col-span-5 grid gap-4 content-start">
          {/* GROUND STATION */}
          {waqi && (
            <Card>
              <SectionTitle icon={<Radio size={15} />}>{t('dashboard.groundStation')} vs {t('dashboard.modelData')}</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div className="tile p-3.5"><p className="label">Ground station</p><p className="text-3xl font-extrabold tabular-nums" style={{ color: aqiColor(waqi.aqi) }}>{waqi.aqi}</p><p className="text-xs text-fg/60 truncate">{waqi.stationName}</p><p className="text-xs text-fg/60">PM2.5 {waqi.readings.pm2_5 ?? '—'} · {waqi.time}</p></div>
                <div className="tile p-3.5"><p className="label">Model (Open-Meteo)</p><p className="text-3xl font-extrabold tabular-nums" style={{ color }}>{c.usAqi}</p><p className="text-xs text-fg/60">satellite + chemistry model</p><p className="text-xs text-fg/60">PM2.5 {c.pm2_5.toFixed(0)}</p></div>
              </div>
              <p className="text-[11px] text-fg/50 mt-2">Station values are measured at one site (WAQI, US-EPA scale); the model is a grid-cell estimate, so they can differ.</p>
            </Card>
          )}
          <Card>
            <SectionTitle icon={<Share2 size={15} />} right={<button className="chip" onClick={() => setShowShare(!showShare)} aria-expanded={showShare}>{showShare ? 'Hide' : 'Create report card'}</button>}>Community report</SectionTitle>
            {showShare ? <Suspense fallback={<Skeleton className="h-72" />}><ShareCard aq={aq} place={loc.name} /></Suspense> : <p className="text-sm text-fg/60">Make a shareable image of today’s AQI, cleanest window and top 3 actions for WhatsApp groups, schools and RWAs.</p>}
          </Card>
          <Card>
            <SectionTitle icon={<GitCompare size={15} />} right={<button className="chip" onClick={() => setShowCompare(!showCompare)} aria-expanded={showCompare}>{showCompare ? 'Hide' : 'Compare cities'}</button>}>City comparison</SectionTitle>
            {showCompare ? <CityCompare homeName={loc.name} homeLat={loc.lat} homeLon={loc.lon} /> : <p className="text-sm text-fg/60">Compare live AQI of up to 4 cities side by side.</p>}
          </Card>
          <Card><SectionTitle icon={<Bell size={15} />}>Alerts</SectionTitle><AlertSettings /></Card>
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex items-center gap-2.5 text-fg/70"><span className="h-8 w-8 rounded-lg bg-fg/[0.05] inline-flex items-center justify-center">{icon}</span>{label}</span>
      <span className="text-right"><span className="block font-extrabold">{value}</span>{sub && <span className="block text-[11px] text-fg/55">{sub}</span>}</span>
    </li>
  );
}
