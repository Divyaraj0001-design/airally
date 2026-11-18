// Deterministic "best window" finder over REAL hourly forecast data (no LLM involved).
export interface Win { date: string; startHour: number; endHour: number; pm2_5: number }

function hourIndex(times: string[]) {
  return times.map((t) => ({ date: t.slice(0, 10), hour: parseInt(t.slice(11, 13), 10) }));
}

export function bestWindows(
  times: string[], pm: (number | null)[], date: string,
  opts: { fromHour: number; toHour: number; len: number; top: number; minHour?: number }
): Win[] {
  const idx = hourIndex(times);
  const hours: { hour: number; v: number }[] = [];
  idx.forEach((x, i) => {
    const v = pm[i];
    if (x.date === date && v != null && x.hour >= Math.max(opts.fromHour, opts.minHour ?? 0) && x.hour <= opts.toHour) hours.push({ hour: x.hour, v });
  });
  const cands: Win[] = [];
  for (let i = 0; i + opts.len <= hours.length; i++) {
    const seg = hours.slice(i, i + opts.len);
    if (seg[seg.length - 1].hour - seg[0].hour !== opts.len - 1) continue; // must be contiguous
    const mean = seg.reduce((s, h) => s + h.v, 0) / seg.length;
    cands.push({ date, startHour: seg[0].hour, endHour: seg[seg.length - 1].hour + 1, pm2_5: +mean.toFixed(1) });
  }
  cands.sort((a, b) => a.pm2_5 - b.pm2_5);
  const chosen: Win[] = [];
  for (const c of cands) {
    if (chosen.every((w) => c.startHour >= w.endHour || c.endHour <= w.startHour)) chosen.push(c);
    if (chosen.length >= opts.top) break;
  }
  return chosen.sort((a, b) => a.startHour - b.startHour);
}

export function hourlyFor(times: string[], pm: (number | null)[], date: string) {
  const out: Record<number, number> = {};
  hourIndex(times).forEach((x, i) => { if (x.date === date && pm[i] != null) out[x.hour] = pm[i] as number; });
  return out;
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
