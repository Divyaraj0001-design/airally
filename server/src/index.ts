import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { airQualityRouter } from './routes/airQuality';
import { weatherRouter } from './routes/weather';
import { geocodeRouter } from './routes/geocode';
import { overpassRouter } from './routes/overpass';
import { aiRouter } from './routes/ai';
import { impactRouter } from './routes/impact';
import { waqiRouter } from './routes/waqi';

const app = express();
app.set('trust proxy', 1); // Render/Vercel sit behind a proxy (needed for correct per-IP rate limiting)
const PORT = parseInt(process.env.PORT || '3001', 10);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(express.json({ limit: '50kb' }));

// CORS
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use(globalLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      ai: !!process.env.GROQ_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      waqi: !!process.env.WAQI_TOKEN,
    },
  });
});

// Routes
app.use('/api/air-quality', airQualityRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/overpass', overpassRouter);
app.use('/api/ai', aiRouter);
app.use('/api/impact', impactRouter);
app.use('/api/waqi', waqiRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🌿 AirAlly server running on port ${PORT}`);
  console.log(`   Groq:   ${process.env.GROQ_API_KEY ? '✓' : '✗ NOT SET (add GROQ_API_KEY to server/.env)'}`);
  console.log(`   WAQI:   ${process.env.WAQI_TOKEN ? '✓' : '(optional, not set)'}`);
});

export default app;
