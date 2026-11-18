import express from 'express';
import axios from 'axios';
import { geoCache } from '../lib/cache';

const router = express.Router();

router.get('/station', async (req, res) => {
  if (!process.env.WAQI_TOKEN) {
    return res.status(404).json({ error: 'WAQI token not configured', available: false });
  }

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  const cacheKey = `waqi:${parseFloat(lat as string).toFixed(2)},${parseFloat(lon as string).toFixed(2)}`;
  const cached = geoCache.get(cacheKey);
  if (cached) return res.json({ ...cached as object, cached: true });

  try {
    const url = `https://api.waqi.info/feed/geo:${lat};${lon}/`;
    const response = await axios.get(url, {
      params: { token: process.env.WAQI_TOKEN },
      timeout: 8000,
    });

    const d = response.data;
    if (d.status !== 'ok') {
      return res.status(502).json({ error: 'WAQI API returned error', detail: d.data, available: true });
    }

    const iaqi = d.data.iaqi || {};
    const result = {
      available: true,
      stationName: d.data.city?.name || 'Unknown Station',
      stationUrl: d.data.city?.url,
      aqi: d.data.aqi,
      dominentPol: d.data.dominentpol,
      time: d.data.time?.s,
      readings: {
        pm2_5: iaqi.pm25?.v ?? null,
        pm10: iaqi.pm10?.v ?? null,
        no2: iaqi.no2?.v ?? null,
        o3: iaqi.o3?.v ?? null,
        so2: iaqi.so2?.v ?? null,
        co: iaqi.co?.v ?? null,
        t: iaqi.t?.v ?? null,
        h: iaqi.h?.v ?? null,
        p: iaqi.p?.v ?? null,
        w: iaqi.w?.v ?? null,
      },
      attribution: d.data.attributions || [],
      cached: false,
    };

    geoCache.set(cacheKey, result, 600);
    return res.json(result);
  } catch (err: any) {
    return res.status(502).json({ error: 'WAQI API failed', detail: err?.message, available: true, retryable: true });
  }
});

export { router as waqiRouter };
