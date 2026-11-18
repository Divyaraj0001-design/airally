import { useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, CartesianGrid } from 'recharts';
import { useTranslation } from 'react-i18next';
import { AirQualityData } from '../../store/dataStore';
import { aqiColor, cleanestHours } from '../../lib/aqi';

export default function AirChart({ aq }: { aq: AirQualityData }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<'pm2_5' | 'usAqi'>('pm2_5');
  const [range, setRange] = useState<'48' | '120'>('48');

  const { data, nowLabel, bands, nowIdx } = useMemo(() => {
    const times = aq.hourly.time;
    const nowIdx = Math.max(times.indexOf(aq.current.time.slice(0, 13) + ':00'), 0);
    const end = range === '48' ? nowIdx + 48 : times.length;
    const start = Math.max(nowIdx - 24, 0);
    const series = aq.hourly[metric] as (number | null)[];
    const clean = cleanestHours(times, series, nowIdx);
    const data = times.slice(start, end).map((tm, k) => {
      const i = start + k;
      const v = series[i];
      return { i, label: tm, v, hist: i <= nowIdx ? v : null, fc: i >= nowIdx ? v : null, clean: clean.has(i) };
    });
    // merge contiguous clean hours into bands
    const bands: { x1: string; x2: string }[] = [];
    let cur: { x1: string; x2: string } | null = null;
    data.forEach((d, k) => {
      if (d.clean) { if (!cur) cur = { x1: d.label, x2: d.label }; else cur.x2 = d.label; }
      if ((!d.clean || k === data.length - 1) && cur) { bands.push(cur); cur = null; }
    });
    return { data, nowLabel: times[nowIdx], bands, nowIdx };
  }, [aq, metric, range]);

  const fmtTick = (s: string) => { const d = new Date(s); return range === '48' ? `${s.slice(11, 13)}h` : `${d.toLocaleString('en', { weekday: 'short' })} ${s.slice(11, 13)}h`; };
  const stroke = aqiColor(metric === 'usAqi' ? aq.current.usAqi : aq.current.usAqi);
  void nowIdx;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div role="tablist" className="flex gap-1">
          {(['pm2_5', 'usAqi'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)} className={`chip ${metric === m ? 'chip-on' : ''}`}>{m === 'pm2_5' ? 'PM2.5 µg/m³' : 'US AQI'}</button>
          ))}
        </div>
        <div role="tablist" className="flex gap-1 ml-auto">
          <button role="tab" aria-selected={range === '48'} onClick={() => setRange('48')} className={`chip ${range === '48' ? 'chip-on' : ''}`}>24h + 48h</button>
          <button role="tab" aria-selected={range === '120'} onClick={() => setRange('120')} className={`chip ${range === '120' ? 'chip-on' : ''}`}>{t('dashboard.forecast')}</button>
        </div>
      </div>
      <div className="h-56" role="img" aria-label={`Chart of ${metric === 'pm2_5' ? 'PM2.5' : 'US AQI'}: last 24 hours and forecast. Shaded bands show the cleanest hours.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
            {bands.map((b, k) => <ReferenceArea key={k} x1={b.x1} x2={b.x2} fill="#009E73" fillOpacity={0.22} stroke="#009E73" strokeOpacity={0.5} strokeDasharray="3 3" />)}
            <XAxis dataKey="label" tickFormatter={fmtTick} interval={range === '48' ? 5 : 11} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'rgb(15 23 42 / .95)', border: '1px solid rgb(255 255 255 / .15)', borderRadius: 12, fontSize: 12, color: '#f8fafc' }}
              labelFormatter={(l) => new Date(l as string).toLocaleString('en', { weekday: 'short', hour: 'numeric' })}
              formatter={(v: any, n) => [typeof v === 'number' ? v.toFixed(0) : v, n === 'hist' ? 'Past' : 'Forecast']} />
            <Area type="monotone" dataKey="hist" stroke={stroke} fill={stroke} fillOpacity={0.25} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="fc" stroke={stroke} strokeDasharray="5 3" fill={stroke} fillOpacity={0.1} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <ReferenceLine x={nowLabel} stroke="currentColor" strokeOpacity={0.6} label={{ value: 'now', fontSize: 10, fill: 'currentColor', position: 'top' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-fg/60 mt-2 flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-[#009E73]/40 border border-[#009E73]" aria-hidden="true" />{t('dashboard.goodWindow')} — cleanest quarter of daytime hours (6 AM–8 PM, local time)</p>
    </div>
  );
}
