import express from 'express';
import { getAirQuality } from '../lib/liveData';

const router = express.Router();

router.get('/', async (req, res) => {
  const latN = parseFloat(req.query.lat as string);
  const lonN = parseFloat(req.query.lon as string);
  if (isNaN(latN) || isNaN(lonN) || Math.abs(latN) > 90 || Math.abs(lonN) > 180) {
    return res.status(400).json({ error: 'Valid lat and lon required' });
  }
  try {
    return res.json(await getAirQuality(latN, lonN));
  } catch (err: any) {
    console.error('[AQ Error]', err?.message);
    return res.status(502).json({
      error: 'Failed to fetch air quality data from Open-Meteo',
      detail: err?.message,
      retryable: true,
    });
  }
});

export { router as airQualityRouter };
