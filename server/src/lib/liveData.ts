import axios from 'axios';
import { aqCache, aqCacheKey, geoCache } from './cache';
import { calcCPCBNAQI, usAqiCategory, WHO_GUIDELINES } from './aqi';

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
  const pm2_5 = c.pm2_5, pm10 = c.pm10 ?? 0, no2 = c.nitrogen_dioxide ?? 0,
    o3 = c.ozone ?? 0, so2 = c.sulphur_dioxide ?? 0, co = c.carbon_monoxide ?? 0, usAqi = c.us_aqi;

  const { naqi, category, dominantPollutant } = calcCPCBNAQI(pm2_5, pm10, no2, o3, co, so2);
  const ratio = (v: number, g: number) => (v > 0 ? +(v / g).toFixed(1) : null);

  const result = {
    current: {
      pm2_5, pm10, no2, o3, so2, co, usAqi,
      europeanAqi: c.european_aqi ?? 0, dust: c.dust ?? 0, uvIndex: c.uv_index ?? 0,
      aerosolOpticalDepth: c.aerosol_optical_depth ?? null, ammonia: c.ammonia ?? null,
      time: c.time,
    },
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
      time: data.hourly.time, pm2_5: data.hourly.pm2_5, pm10: data.hourly.pm10,
      no2: data.hourly.nitrogen_dioxide, o3: data.hourly.ozone, so2: data.hourly.sulphur_dioxide,
      co: data.hourly.carbon_monoxide, usAqi: data.hourly.us_aqi, europeanAqi: data.hourly.european_aqi,
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
