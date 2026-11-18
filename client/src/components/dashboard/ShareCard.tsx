import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Share2, Download, Loader2 } from 'lucide-react';
import { AirQualityData } from '../../store/dataStore';
import { aqiColor } from '../../lib/aqi';
import { bestWindows, fmtWin } from '../../lib/windows';

function actionsFor(aqi: number, pm: number): string[] {
  // Deterministic, WHO/CPCB/EPA-aligned guidance tiers keyed to the live US AQI value
  if (aqi <= 50) return ['Air is good — enjoy outdoor play and exercise.', 'Open windows to refresh indoor air.', 'Walk or cycle for short trips.'];
  if (aqi <= 100) return ['Unusually sensitive people: shorten long outdoor exertion.', 'Ventilate during the cleanest hours below.', 'Prefer walking, metro or bus over cars.'];
  if (aqi <= 150) return ['Children, seniors & asthma: limit outdoor activity; keep inhalers handy.', 'Keep windows shut except during the cleanest window.', 'Run a purifier / wet-mop dust indoors.'];
  if (aqi <= 200) return ['Everyone: cut long outdoor exertion; schedule play for the clean window.', 'Wear a fitted N95/FFP2 if you must be outside.', 'Close windows; run a HEPA purifier in the bedroom.'];
  return [`PM2.5 is ${Math.round(pm)} µg/m³ — avoid outdoor exercise today.`, 'Wear a fitted N95/FFP2 outdoors; keep kids & seniors indoors.', 'Seal gaps, run a purifier, no open burning / idling.'];
}

export default function ShareCard({ aq, place }: { aq: AirQualityData; place: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = aq.current.time.slice(0, 10);
  const nowH = parseInt(aq.current.time.slice(11, 13), 10);
  const win = bestWindows(aq, today, 2, 1, nowH + 1)[0];
  const color = aqiColor(aq.current.usAqi);
  const acts = actionsFor(aq.current.usAqi, aq.current.pm2_5);
  const text = `${place}: US AQI ${aq.current.usAqi} (${aq.usCategory.label}), PM2.5 ${aq.current.pm2_5.toFixed(0)} µg/m³.${win ? ` Cleanest window today: ${fmtWin(win)}.` : ''} Source: AirAlly / Open-Meteo`;

  const makeBlob = async () => {
    const url = await toPng(ref.current!, { pixelRatio: 2, cacheBust: true });
    return { url, blob: await (await fetch(url)).blob() };
  };
  const run = async (mode: 'share' | 'download') => {
    setBusy(true); setErr(null);
    try {
      const { url, blob } = await makeBlob();
      const file = new File([blob], 'airally-report.png', { type: 'image/png' });
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: 'AirAlly report' });
      else if (mode === 'share' && navigator.share) await navigator.share({ text, title: 'AirAlly report', url: location.origin });
      else { const a = document.createElement('a'); a.href = url; a.download = 'airally-report.png'; a.click(); }
    } catch (e: any) { if (e?.name !== 'AbortError') setErr('Could not create the image: ' + (e?.message || 'unknown error')); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div ref={ref} className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(160deg, #0f172a 0%, #1e293b 60%, ${color}55 140%)` }}>
        <div className="flex items-center justify-between text-xs font-semibold opacity-80"><span>🌿 AirAlly · Community report</span><span>{new Date(aq.current.time).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
        <p className="text-lg font-bold mt-3">{place}</p>
        <div className="flex items-end gap-3 mt-1">
          <span className="text-6xl font-extrabold leading-none" style={{ color }}>{aq.current.usAqi}</span>
          <div className="pb-1"><p className="font-bold">{aq.usCategory.label}</p><p className="text-xs opacity-80">US AQI · PM2.5 {aq.current.pm2_5.toFixed(0)} µg/m³ ({aq.whoRatios.pm2_5}× WHO) · India NAQI {aq.naqi.value}</p></div>
        </div>
        {win && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">🕒 Cleanest window today: <strong>{fmtWin(win)}</strong> (forecast PM2.5 {win.pm2_5} µg/m³)</p>}
        <p className="text-xs font-bold uppercase tracking-wide mt-4 opacity-70">Top 3 actions</p>
        <ol className="mt-1 space-y-1 text-sm list-decimal pl-5">{acts.map((a, i) => <li key={i}>{a}</li>)}</ol>
        <p className="text-[10px] opacity-60 mt-4">Data: Open-Meteo · Guidance per WHO/CPCB/EPA · Not medical advice</p>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={() => run('share')} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}Share (WhatsApp, RWA…)</button>
        <button className="btn-ghost" onClick={() => run('download')} disabled={busy} aria-label="Download image"><Download size={16} /></button>
      </div>
      {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
    </div>
  );
}
