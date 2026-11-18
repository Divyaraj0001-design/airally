import { AirQualityData } from '../store/dataStore';
import { formatHour } from './aqi';

export interface Win { date: string; startHour: number; endHour: number; pm2_5: number }

/** Cleanest contiguous `len`-hour windows (6 AM–8 PM) for a local date, from real forecast data. */
export function bestWindows(aq: AirQualityData, date: string, len = 2, top = 1, minHour = 0): Win[] {
  const hrs: { h: number; v: number }[] = [];
  aq.hourly.time.forEach((t, i) => {
    const v = aq.hourly.pm2_5[i];
    const h = parseInt(t.slice(11, 13), 10);
    if (t.slice(0, 10) === date && v != null && h >= Math.max(6, minHour) && h <= 20) hrs.push({ h, v });
  });
  const cands: Win[] = [];
  for (let i = 0; i + len <= hrs.length; i++) {
    const seg = hrs.slice(i, i + len);
    if (seg[len - 1].h - seg[0].h !== len - 1) continue;
    cands.push({ date, startHour: seg[0].h, endHour: seg[len - 1].h + 1, pm2_5: +(seg.reduce((s, x) => s + x.v, 0) / len).toFixed(1) });
  }
  cands.sort((a, b) => a.pm2_5 - b.pm2_5);
  const out: Win[] = [];
  for (const c of cands) { if (out.every((w) => c.startHour >= w.endHour || c.endHour <= w.startHour)) out.push(c); if (out.length >= top) break; }
  return out.sort((a, b) => a.startHour - b.startHour);
}

export const fmtWin = (w: Win) => `${formatHour(w.startHour)}–${formatHour(w.endHour)}`;

/** PM2.5 at a specific local hour today (null if unavailable). */
export function pmAt(aq: AirQualityData, date: string, hour: number): number | null {
  const i = aq.hourly.time.indexOf(`${date}T${String(hour).padStart(2, '0')}:00`);
  return i >= 0 ? aq.hourly.pm2_5[i] ?? null : null;
}
