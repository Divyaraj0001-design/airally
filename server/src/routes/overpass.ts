import express from 'express';
import axios from 'axios';
import { geoCache } from '../lib/cache';

const router = express.Router();

const OVERPASS_URLS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get('/nearby', async (req, res) => {
  const { lat, lon, radius = '3000' } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  const latN = parseFloat(lat as string);
  const lonN = parseFloat(lon as string);
  const radiusN = Math.min(parseInt(radius as string, 10), 10000);

  const cacheKey = `overpass:${latN.toFixed(2)},${lonN.toFixed(2)}:${radiusN}`;
  const cached = geoCache.get(cacheKey);
  if (cached) return res.json({ ...cached as object, cached: true });

  const r = radiusN, ll = `${latN},${lonN}`;
  const block = (filters: string[], limit: number) =>
    `(${filters.map((f) => `${f}(around:${r},${ll});`).join('')})->.s; out center ${limit};`;
  const query = `[out:json][timeout:20];
${block(['node["leisure"="park"]', 'way["leisure"="park"]'], 40)}
${block(['node["railway"="station"]', 'node["railway"="subway_entrance"]', 'node["public_transport"="station"]'], 40)}
${block(['node["highway"="bus_stop"]'], 60)}
${block(['node["amenity"="bicycle_rental"]', 'way["amenity"="bicycle_rental"]'], 30)}
${block(['node["amenity"="hospital"]', 'node["amenity"="clinic"]', 'node["amenity"="doctors"]'], 40)}`;

  try {
    let response: any;
    let lastErr: any;
    const attempts = OVERPASS_URLS;
    for (let i = 0; i < attempts.length && !response; i++) {
      const url = attempts[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 500 * i));
      try {
        response = await axios.post(url, `data=${encodeURIComponent(query)}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AirAlly/1.0 (air quality assistant; https://github.com/airally)',
            Accept: 'application/json',
          },
          timeout: 15000,
        });
      } catch (e) { lastErr = e; }
    }
    if (!response) throw lastErr;

    const elements: OverpassElement[] = response.data.elements || [];

    const categorize = (el: OverpassElement) => {
      const tags = el.tags || {};
      const elLat = el.lat ?? el.center?.lat ?? latN;
      const elLon = el.lon ?? el.center?.lon ?? lonN;
      const dist = +distanceKm(latN, lonN, elLat, elLon).toFixed(2);
      const name = tags['name:en'] || tags.name || tags['name:hi'] || '';

      if (tags.leisure === 'park') return { type: 'park', name, lat: elLat, lon: elLon, dist, tags };
      if (tags.railway === 'station' || tags.railway === 'subway_entrance' || tags.public_transport === 'station')
        return { type: 'transit', subtype: tags.railway || 'station', name, lat: elLat, lon: elLon, dist, tags };
      if (tags.highway === 'bus_stop') return { type: 'bus_stop', name, lat: elLat, lon: elLon, dist, tags };
      if (tags.amenity === 'bicycle_rental') return { type: 'bike_rental', name, lat: elLat, lon: elLon, dist, tags };
      if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'doctors')
        return { type: 'clinic', subtype: tags.amenity, name, lat: elLat, lon: elLon, dist, tags };
      return null;
    };

    const places = elements
      .map(categorize)
      .filter((p: any) => p && p.name)
      .sort((a: any, b: any) => a.dist - b.dist);

    // De-duplicate by name+type (keep nearest)
    const seen = new Set<string>();
    const unique = places.filter((p: any) => {
      const key = `${p.type}:${p.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const result = {
      parks: unique.filter((p: any) => p.type === 'park').slice(0, 10),
      transit: unique.filter((p: any) => p.type === 'transit').slice(0, 10),
      busStops: unique.filter((p: any) => p.type === 'bus_stop').slice(0, 10),
      bikeRentals: unique.filter((p: any) => p.type === 'bike_rental').slice(0, 5),
      clinics: unique.filter((p: any) => p.type === 'clinic').slice(0, 5),
      total: unique.length,
      queryRadius: radiusN,
      cached: false,
    };

    geoCache.set(cacheKey, result, 1800); // 30 min cache for POI
    return res.json(result);
  } catch (err: any) {
    console.error('[Overpass Error]', err?.message);
    return res.status(502).json({ error: 'Overpass API failed', detail: err?.message, retryable: true });
  }
});

export { router as overpassRouter };
