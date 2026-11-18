// Colour-blind-safe palette (Okabe–Ito based). Every colour is always paired with a text label + icon.
export function aqiColor(aqi: number): string {
  if (aqi <= 50)  return '#009E73';
  if (aqi <= 100) return '#F0E442';
  if (aqi <= 150) return '#E69F00';
  if (aqi <= 200) return '#D55E00';
  if (aqi <= 300) return '#CC79A7';
  return '#9B1D5A';
}

/** Page background gradient that follows the air quality. */
export function aqiGradient(aqi: number): string {
  const c = aqiColor(aqi);
  return `radial-gradient(120% 60% at 50% -10%, ${c}40 0%, transparent 70%)`;
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function aqiEmoji(aqi: number): string {
  if (aqi <= 50)  return '😊';
  if (aqi <= 100) return '😐';
  if (aqi <= 150) return '😷';
  if (aqi <= 200) return '🤒';
  if (aqi <= 300) return '🚨';
  return '☠️';
}

export function naqiCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    'Good': '#009E73',
    'Satisfactory': '#56B4E9',
    'Moderate': '#F0E442',
    'Poor': '#E69F00',
    'Very Poor': '#D55E00',
    'Severe': '#9B1D5A',
  };
  return map[cat] || '#6b7280';
}

export function windDirection(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code <= 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

export function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function fmtHour12(h: number): string { return formatHour(h % 24); }

/** Contiguous cleanest-hours helper for chart shading: hours (06–20 local) in the lowest quartile of the supplied series. */
export function cleanestHours(times: string[], vals: (number | null)[], fromIdx: number): Set<number> {
  const idxs: number[] = [];
  for (let i = fromIdx; i < times.length; i++) {
    const h = parseInt(times[i].slice(11, 13), 10);
    if (vals[i] != null && h >= 6 && h <= 20) idxs.push(i);
  }
  if (!idxs.length) return new Set();
  const sorted = idxs.map((i) => vals[i] as number).sort((a, b) => a - b);
  const q = sorted[Math.floor(sorted.length * 0.25)];
  return new Set(idxs.filter((i) => (vals[i] as number) <= q));
}

export function localHour(iso: string): number { return parseInt(iso.slice(11, 13), 10); }
