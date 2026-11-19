import axios from 'axios';
import { aqCache, aqCacheKey, geoCache } from './cache';
import { calcCPCBNAQI, usAqiCategory, WHO_GUIDELINES } from './aqi';

/** US-EPA PM2.5 AQI sub-index -> concentration (µg/m³), inverse of the standard breakpoint table. */
function pm25FromIndex(i: number): number {
  const bp: Array<[number, number, number, number]> = [
    [0, 50, 0, 12], [51, 100, 12.1, 35.4], [101, 150, 35.5, 55.4],
    [151, 200, 55.5, 150.4], [201, 300, 150.5, 250.4], [301, 400, 250.5, 350.4], [401, 500, 350.5, 500.4],
  ];
  const b = bp.find(([lo, hi]) => i >= lo && i <= hi) ?? bp[bp.length - 1];
  return +(b[2] + ((i - b[0]) * (b[3] - b[2])) / (b[1] - b[0])).toFixed(1);
}

function distKm(a: number, b: number, c: number, d: number): number {
  const r = Math.PI / 180, dLat = (c - a) * r, dLon = (d - b) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Nearest measured ground station (WAQI). Returns null if no token, too far, stale or unavailable. */
async function getStation(lat: number, lon: number): Promise<{ aqi: number; pm25Index: number | null; name: string; distKm: number; time?: string } | null> {
  const token = process.env.WAQI_TOKEN?.trim();
  if (!token) return null;
  try {
    const r = await axios.get(`https://api.waqi.info/feed/geo:${lat.toFixed(4)};${lon.toFixed(4)}/`, { params: { token }, timeout: 6000 });
    const d = r.data?.data;
    if (r.data?.status !== 'ok' || typeof d?.aqi !== 'number') return null;
    const [sLat, sLon] = d.city?.geo || [];
    const dist = typeof sLat === 'number' ? distKm(lat, lon, sLat, sLon) : 0;
    if (dist > 30) return null; // station too far to represent this location
    const pm = d.iaqi?.pm25?.v;
    return { aqi: d.aqi, pm25Index: typeof pm === 'number' ? pm : null, name: d.city?.name || 'Ground station', distKm: +dist.toFixed(1), time: d.time?.s };
  } catch { return null; }
}

/** Fetch live air quality from Open-Meteo (cached 10 min per lat/lon rounded to 2dp). */
export async function getAirQuality(latN: number, lonN: number): Promise<any> {
  const cacheKey = aqCacheKey(latN, lonN);
  const cached = aqCache.get(cacheKey);
  if (cached) return { ...(cached as object), cached: true };

  const response = await axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
    params: {
      latitude: latN.toFixed(4),
      longitude: lonN.toFixed(4),
      current: 'pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,us_aqi,european_aqi,dust,uv_index,aerosol_optical_depth,ammonia',
      hourly: 'pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,us_aqi,european_aqi,dust,uv_index',
      forecast_days: 5,
      past_days: 1,
      timezone: 'auto',
    },
    timeout: 10000,
  });
  const data = response.data;
  const c = data.current;
  if (c?.pm2_5 == null || c?.us_aqi == null) {
    throw new Error('Open-Meteo has no air-quality coverage for this location');
  }
  const station = await getStation(latN, lonN);
  const modelUsAqi = c.us_aqi, modelPm25 = c.pm2_5;
  const pm2_5 = station?.pm25Index != null ? pm25FromIndex(station.pm25Index) : c.pm2_5, pm10 = c.pm10 ?? 0, no2 = c.nitrogen_dioxide ?? 0,
    o3 = c.ozone ?? 0, so2 = c.sulphur_dioxide ?? 0, co = c.carbon_monoxide ?? 0, usAqi = station ? station.aqi : c.us_aqi;

  // Bias-correct the model forecast to the measured station: scale every hour by (station / model) at the current hour.
  const clamp = (r: number) => Math.min(2.5, Math.max(0.4, r));
  const aqiRatio = station && modelUsAqi > 0 ? clamp(station.aqi / modelUsAqi) : 1;
  const pmRatio = station && modelPm25 > 0 ? clamp(pm2_5 / modelPm25) : 1;
  const scale = (arr: Array<number | null> | undefined, k: number, dp: number) =>
    (arr ?? []).map((v) => (v == null ? v : k === 1 ? v : +(v * k).toFixed(dp)));

  const { naqi, category, dominantPollutant } = calcCPCBNAQI(pm2_5, pm10, no2, o3, co, so2);
  const ratio = (v: number, g: number) => (v > 0 ? +(v / g).toFixed(1) : null);

  const result = {
    current: {
      pm2_5, pm10, no2, o3, so2, co, usAqi,
      europeanAqi: c.european_aqi ?? 0, dust: c.dust ?? 0, uvIndex: c.uv_index ?? 0,
      aerosolOpticalDepth: c.aerosol_optical_depth ?? null, ammonia: c.ammonia ?? null,
      time: c.time,
    },
    source: station
      ? { type: 'ground-station', station: station.name, distanceKm: station.distKm, hourlyAdjusted: true, aqiScale: +aqiRatio.toFixed(2), time: station.time, modelUsAqi, modelPm25 }
      : { type: 'model', note: 'Open-Meteo model estimate (no nearby ground station)' },
    naqi: { value: naqi, category, dominantPollutant },
    usCategory: usAqiCategory(usAqi),
    whoRatios: {
      pm2_5: ratio(pm2_5, WHO_GUIDELINES.pm2_5.daily),
      pm10: ratio(pm10, WHO_GUIDELINES.pm10.daily),
      no2: ratio(no2, WHO_GUIDELINES.no2.daily),
      o3: ratio(o3, WHO_GUIDELINES.o3.daily),
      so2: ratio(so2, WHO_GUIDELINES.so2.daily),
      co: ratio(co / 1000, WHO_GUIDELINES.co.daily),
    },
    whoGuidelines: WHO_GUIDELINES,
    hourly: {
      time: data.hourly.time, pm2_5: scale(data.hourly.pm2_5, pmRatio, 1), pm10: data.hourly.pm10,
      no2: data.hourly.nitrogen_dioxide, o3: data.hourly.ozone, so2: data.hourly.sulphur_dioxide,
      co: data.hourly.carbon_monoxide, usAqi: scale(data.hourly.us_aqi, aqiRatio, 0), europeanAqi: data.hourly.european_aqi,
      dust: data.hourly.dust, uvIndex: data.hourly.uv_index,
    },
    meta: {
      latitude: data.latitude, longitude: data.longitude, timezone: data.timezone,
      utcOffsetSeconds: data.utc_offset_seconds, fetchedAt: new Date().toISOString(),
    },
    cached: false,
  };
  aqCache.set(cacheKey, result);
  return result;
}

export async function geocodeCity(name: string, language = 'en') {
  const key = `geo:city:${name.toLowerCase()}:${language}`;
  const cached = geoCache.get(key) as any;
  if (cached) return cached;
  const r = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name, count: 1, language, format: 'json' }, timeout: 8000,
  });
  const hit = r.data.results?.[0];
  if (!hit) return null;
  const out = { name: hit.name, country: hit.country, state: hit.admin1, lat: hit.latitude, lon: hit.longitude };
  geoCache.set(key, out);
  return out;
}
