import express from 'express';
import axios from 'axios';
import { geoCache } from '../lib/cache';

const router = express.Router();
const NOMINATIM_UA = 'AirAlly/1.0 (contact@airally.app)';

// Search cities via Open-Meteo Geocoding
router.get('/search', async (req, res) => {
  const { q, count = '8', language = 'en' } = req.query;
  if (!q || (q as string).trim().length < 2) return res.status(400).json({ error: 'Query too short' });

  const cacheKey = `geo:search:${(q as string).toLowerCase()}:${language}`;
  const cached = geoCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: q, count, language, format: 'json' },
      timeout: 8000,
    });
    const result = { results: response.data.results || [] };
    geoCache.set(cacheKey, result);
    return res.json(result);
  } catch (err: any) {
    return res.status(502).json({ error: 'Geocoding failed', detail: err?.message });
  }
});

// Reverse geocode via Nominatim
router.get('/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  const cacheKey = `geo:rev:${parseFloat(lat as string).toFixed(2)},${parseFloat(lon as string).toFixed(2)}`;
  const cached = geoCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon, format: 'json', zoom: 10, addressdetails: 1 },
      headers: { 'User-Agent': NOMINATIM_UA },
      timeout: 8000,
    });
    const d = response.data;
    const result = {
      displayName: d.display_name,
      city: d.address?.city || d.address?.town || d.address?.village || d.address?.county,
      state: d.address?.state,
      country: d.address?.country,
      countryCode: d.address?.country_code?.toUpperCase(),
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
    };
    geoCache.set(cacheKey, result);
    return res.json(result);
  } catch (err: any) {
    return res.status(502).json({ error: 'Reverse geocoding failed', detail: err?.message });
  }
});

export { router as geocodeRouter };
