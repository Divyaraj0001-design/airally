import { z } from 'zod';

// ============================================================
// CPCB NAQI Breakpoints (India National AQI)
// Source: CPCB document "National Air Quality Index 2014"
// https://cpcb.nic.in/displaypdf.php?id=bmF0aW9uYWxfYWlyX3F1YWxpdHlfaW5kZXgucGRm
// ============================================================

export interface CPCBBreakpoint {
  pollutant: string;
  unit: string;
  breakpoints: Array<{
    bpLo: number;
    bpHi: number;
    aqiLo: number;
    aqiHi: number;
    category: string;
  }>;
}

// CPCB AQI sub-index formula: I = [(IHi - ILo)/(BpHi - BpLo)] * (Cp - BpLo) + ILo
export function calcCPCBSubIndex(Cp: number, pollutant: 'pm2_5' | 'pm10' | 'no2' | 'o3' | 'co' | 'so2'): number {
  const tables: Record<string, Array<[number, number, number, number]>> = {
    pm2_5: [
      [0, 30, 0, 50],
      [30, 60, 51, 100],
      [60, 90, 101, 200],
      [90, 120, 201, 300],
      [120, 250, 301, 400],
      [250, 380, 401, 500],
    ],
    pm10: [
      [0, 50, 0, 50],
      [50, 100, 51, 100],
      [100, 250, 101, 200],
      [250, 350, 201, 300],
      [350, 430, 301, 400],
      [430, 600, 401, 500],
    ],
    no2: [
      [0, 40, 0, 50],
      [40, 80, 51, 100],
      [80, 180, 101, 200],
      [180, 280, 201, 300],
      [280, 400, 301, 400],
      [400, 800, 401, 500],
    ],
    so2: [
      [0, 40, 0, 50],
      [40, 80, 51, 100],
      [80, 380, 101, 200],
      [380, 800, 201, 300],
      [800, 1600, 301, 400],
      [1600, 2100, 401, 500],
    ],
    co: [
      [0, 1, 0, 50],
      [1, 2, 51, 100],
      [2, 10, 101, 200],
      [10, 17, 201, 300],
      [17, 34, 301, 400],
      [34, 46, 401, 500],
    ],
    o3: [
      [0, 50, 0, 50],
      [50, 100, 51, 100],
      [100, 168, 101, 200],
      [168, 208, 201, 300],
      [208, 748, 301, 400],
      [748, 1050, 401, 500],
    ],
  };

  const rows = tables[pollutant];
  if (!rows) return 0;

  for (const [bpLo, bpHi, iLo, iHi] of rows) {
    if (Cp >= bpLo && Cp <= bpHi) {
      return Math.round(((iHi - iLo) / (bpHi - bpLo)) * (Cp - bpLo) + iLo);
    }
  }
  return Cp > rows[rows.length - 1][1] ? 500 : 0;
}

export function calcCPCBNAQI(pm2_5: number, pm10: number, no2?: number, o3?: number, co?: number, so2?: number): {
  naqi: number;
  category: string;
  dominantPollutant: string;
} {
  const subIndices: Record<string, number> = {
    'PM2.5': calcCPCBSubIndex(pm2_5, 'pm2_5'),
    'PM10': calcCPCBSubIndex(pm10, 'pm10'),
  };
  // NAQI here is computed from PM2.5 and PM10 only: CPCB gas sub-indices need 8-h/24-h averages that we don't have from an instantaneous model value.
  void no2; void o3; void co; void so2;

  const dominantPollutant = Object.entries(subIndices).reduce(
    (max, [k, v]) => (v > max[1] ? [k, v] : max),
    ['PM2.5', 0]
  )[0];

  const naqi = Math.max(...Object.values(subIndices));

  const category =
    naqi <= 50 ? 'Good' :
    naqi <= 100 ? 'Satisfactory' :
    naqi <= 200 ? 'Moderate' :
    naqi <= 300 ? 'Poor' :
    naqi <= 400 ? 'Very Poor' :
    'Severe';

  return { naqi, category, dominantPollutant };
}

// ============================================================
// WHO 2021 Air Quality Guidelines (24-hour averages)
// Source: WHO Global Air Quality Guidelines 2021
// ============================================================
export const WHO_GUIDELINES = {
  pm2_5: { annual: 5, daily: 15, unit: 'μg/m³' },
  pm10: { annual: 15, daily: 45, unit: 'μg/m³' },
  no2: { annual: 10, daily: 25, unit: 'μg/m³' },
  o3: { peak_season: 60, daily: 100, unit: 'μg/m³' },
  so2: { daily: 40, unit: 'μg/m³' },
  co: { daily: 4, unit: 'mg/m³' },
};

// ============================================================
// US AQI category from raw AQI value
// ============================================================
export function usAqiCategory(aqi: number): { label: string; color: string; emoji: string } {
  if (aqi <= 50)  return { label: 'Good', color: '#00e400', emoji: '😊' };
  if (aqi <= 100) return { label: 'Moderate', color: '#ffff00', emoji: '😐' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#ff7e00', emoji: '😷' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ff0000', emoji: '🤒' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#8f3f97', emoji: '🚨' };
  return { label: 'Hazardous', color: '#7e0023', emoji: '☠️' };
}
