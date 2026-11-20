import express from 'express';
import axios from 'axios';
import { aqCache, weatherCacheKey } from '../lib/cache';

const router = express.Router();
/** Last good response per location, served if Open-Meteo is rate-limiting us. */
const staleWeather = new Map<string, object>();

router.get('/', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  const latN = parseFloat(lat as string);
  const lonN = parseFloat(lon as string);
  if (isNaN(latN) || isNaN(lonN)) return res.status(400).json({ error: 'Invalid coordinates' });

  const cacheKey = weatherCacheKey(latN, lonN);
  const cached = aqCache.get(cacheKey);
  if (cached) return res.json({ ...cached as object, cached: true });

  try {
    const url = 'https://api.open-meteo.com/v1/forecast';
    const params = {
      latitude: latN.toFixed(4),
      longitude: lonN.toFixed(4),
      current: [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
        'precipitation', 'surface_pressure', 'cloud_cover', 'visibility',
        'is_day', 'weather_code'
      ].join(','),
      hourly: [
        'temperature_2m', 'relative_humidity_2m', 'wind_speed_10m',
        'wind_direction_10m', 'precipitation_probability', 'precipitation',
        'surface_pressure', 'cloud_cover', 'visibility',
        'boundary_layer_height', 'weather_code'
      ].join(','),
      forecast_days: 5,
      past_days: 1,
      timezone: 'auto',
      wind_speed_unit: 'kmh',
    };

    let response;
    try {
      response = await axios.get(url, { params, timeout: 10000 });
    } catch (e: any) {
      if (e?.response?.status !== 429) throw e;
      // Shared hosting IPs get rate-limited by Open-Meteo: wait briefly and retry once.
      await new Promise((r) => setTimeout(r, 1500));
      response = await axios.get(url, { params, timeout: 10000 });
    }
    const data = response.data;

    const result = {
      current: {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        apparentTemperature: data.current.apparent_temperature,
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        windGusts: data.current.wind_gusts_10m,
        precipitation: data.current.precipitation,
        pressure: data.current.surface_pressure,
        cloudCover: data.current.cloud_cover,
        visibility: data.current.visibility,
        isDay: data.current.is_day,
        weatherCode: data.current.weather_code,
        time: data.current.time,
      },
      hourly: {
        time: data.hourly.time,
        temperature: data.hourly.temperature_2m,
        humidity: data.hourly.relative_humidity_2m,
        windSpeed: data.hourly.wind_speed_10m,
        windDirection: data.hourly.wind_direction_10m,
        precipProbability: data.hourly.precipitation_probability,
        precipitation: data.hourly.precipitation,
        pressure: data.hourly.surface_pressure,
        cloudCover: data.hourly.cloud_cover,
        visibility: data.hourly.visibility,
        boundaryLayerHeight: data.hourly.boundary_layer_height,
        weatherCode: data.hourly.weather_code,
      },
      units: data.current_units,
      meta: {
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        fetchedAt: new Date().toISOString(),
      },
      cached: false,
    };

    aqCache.set(cacheKey, result);
    staleWeather.set(cacheKey, result);
    return res.json(result);
  } catch (err: any) {
    console.error('[Weather Error]', err?.message);
    const stale = staleWeather.get(cacheKey);
    if (stale) return res.json({ ...(stale as object), cached: true, stale: true });
    return res.status(502).json({
      error: 'Failed to fetch weather data from Open-Meteo',
      detail: err?.message,
      retryable: true,
    });
  }
});

export { router as weatherRouter };
