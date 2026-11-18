import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { aiCache } from '../lib/cache';
import {
  getAI, MODELS, isOverload, SYSTEM_PROMPT, langLine, sanitizeText, looksLikeInjection,
  hashObj, generateJson, generateText,
} from '../lib/ai';
import { getAirQuality, geocodeCity } from '../lib/liveData';
import { bestWindows, hourlyFor, addDays } from '../lib/windows';

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please wait a minute.' },
});

// Plain JSON-Schema type names (sent to the model as the required output format)
const S = 'string', I = 'integer', B = 'boolean', O = 'object', A = 'array';

/** Strip the profile down to what the model needs (token-efficient + privacy-minimal). */
function slimProfile(p: any) {
  return {
    members: p?.household?.members,
    sensitivities: p?.household?.sensitivities,
    commute: p?.lifestyle?.commute,
    commuteKm: p?.lifestyle?.commuteKm,
    wfhDays: p?.lifestyle?.wfhDays,
    cookingFuel: p?.lifestyle?.cookingFuel,
    hasPurifier: p?.lifestyle?.hasPurifier,
    hasAC: p?.lifestyle?.hasAC,
    maskType: p?.lifestyle?.maskType,
    windowType: p?.lifestyle?.windowType,
    smokersAtHome: p?.lifestyle?.smokersAtHome,
    pets: p?.lifestyle?.pets,
    vehicle: p?.lifestyle?.vehicle,
    exerciseHabits: p?.lifestyle?.exerciseHabits,
    schoolKids: p?.lifestyle?.schoolKids,
    schoolPickupTime: p?.lifestyle?.schoolPickupTime,
    budget: p?.lifestyle?.budget,
  };
}

const fail = (res: express.Response, label: string, err: any) => {
  console.error(`[AI ${label}]`, err?.message);
  const msg = String(err?.message || '');
  const status = /\b429\b|rate.?limit/i.test(msg) ? 429 : 502;
  return res.status(status).json({
    error: /API key|\b401\b|not configured/i.test(msg) ? 'AI service is not configured correctly (missing or invalid GROQ_API_KEY).' : `${label} failed`,
    detail: msg.slice(0, 300),
    retryable: !/API key|\b401\b|not configured/i.test(msg),
  });
};

// ============================================================
// DAILY PLAN
// ============================================================
const HOUR_SCHEMA = {
  type: O,
  properties: {
    hour: { type: I }, label: { type: S }, activity: { type: S }, advice: { type: S },
    maskNeeded: { type: B }, maskType: { type: S }, icon: { type: S, description: 'one emoji' },
  },
  required: ['hour', 'label', 'activity', 'advice', 'maskNeeded', 'icon'],
};
const DAILY_PLAN_SCHEMA = {
  type: O,
  properties: {
    summary: { type: S },
    overallRisk: { type: S, enum: ['low', 'moderate', 'high', 'very_high', 'severe'] },
    whyBadToday: { type: S },
    today: { type: A, items: HOUR_SCHEMA },
    tomorrow: { type: A, items: HOUR_SCHEMA },
    memberAdvice: {
      type: A,
      items: {
        type: O,
        properties: { member: { type: S }, advice: { type: S }, priority: { type: S, enum: ['normal', 'caution', 'high'] } },
        required: ['member', 'advice', 'priority'],
      },
    },
    outdoorWindowReasons: { type: A, items: { type: S }, description: 'one reason per provided outdoor window, same order' },
    ventilationTips: { type: A, items: { type: S }, description: 'one tip per provided ventilation window, same order' },
    disclaimer: { type: S },
  },
  required: ['summary', 'overallRisk', 'whyBadToday', 'today', 'tomorrow', 'memberAdvice', 'outdoorWindowReasons', 'ventilationTips', 'disclaimer'],
};
const zHour = z.object({
  hour: z.coerce.number(), label: z.string(), activity: z.string(), advice: z.string(),
  maskNeeded: z.boolean(), maskType: z.string().optional().nullable(), icon: z.string(),
});
const zPlan = z.object({
  summary: z.string(), overallRisk: z.enum(['low', 'moderate', 'high', 'very_high', 'severe']),
  whyBadToday: z.string(), today: z.array(zHour), tomorrow: z.array(zHour),
  memberAdvice: z.array(z.object({ member: z.string(), advice: z.string(), priority: z.enum(['normal', 'caution', 'high']) })),
  outdoorWindowReasons: z.array(z.string()).default([]), ventilationTips: z.array(z.string()).default([]),
  disclaimer: z.string(),
});

router.post('/daily-plan', aiLimiter, async (req, res) => {
  try {
    const { airQuality, weather, profile, nearbyPlaces } = req.body || {};
    if (!airQuality?.hourly?.time || !airQuality?.current) return res.status(400).json({ error: 'airQuality data required' });

    const times: string[] = airQuality.hourly.time;
    const pm: number[] = airQuality.hourly.pm2_5;
    const nowLocal: string = airQuality.current.time; // location-local ISO
    const today = nowLocal.slice(0, 10);
    const tomorrow = addDays(today, 1);
    const nowHour = parseInt(nowLocal.slice(11, 13), 10);

    const lang = profile?.language || 'en';
    const key = `plan:${(+airQuality.meta?.latitude).toFixed(2)},${(+airQuality.meta?.longitude).toFixed(2)}:${today}T${nowHour}:${lang}:${hashObj(slimProfile(profile))}`;
    const hit = aiCache.get(key);
    if (hit) return res.json({ ...(hit as object), cached: true });

    const todayPm = hourlyFor(times, pm, today);
    const tomorrowPm = hourlyFor(times, pm, tomorrow);
    const keyHours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
    const todayHours = keyHours.filter((h) => h >= nowHour - 1 && todayPm[h] != null);
    const tomorrowHours = keyHours.filter((h) => tomorrowPm[h] != null);

    const outdoor = [
      ...bestWindows(times, pm, today, { fromHour: 6, toHour: 20, len: 2, top: 1, minHour: nowHour }),
      ...bestWindows(times, pm, tomorrow, { fromHour: 6, toHour: 20, len: 2, top: 1 }),
    ];
    const ventilation = [
      ...bestWindows(times, pm, today, { fromHour: 9, toHour: 17, len: 2, top: 1, minHour: nowHour }),
      ...bestWindows(times, pm, tomorrow, { fromHour: 9, toHour: 17, len: 2, top: 1 }),
    ];

    const wxHourly = weather?.hourly;
    const blhAt = (h: number) => {
      const i = wxHourly?.time?.indexOf(`${today}T${String(h).padStart(2, '0')}:00`);
      return i >= 0 ? wxHourly.boundaryLayerHeight?.[i] : null;
    };

    const context = {
      locationLocalTime: nowLocal,
      current: {
        pm2_5: airQuality.current.pm2_5, pm10: airQuality.current.pm10, usAqi: airQuality.current.usAqi,
        indiaNAQI: airQuality.naqi?.value, indiaCategory: airQuality.naqi?.category,
      },
      weatherNow: weather?.current && {
        tempC: weather.current.temperature, humidityPct: weather.current.humidity,
        windKmh: weather.current.windSpeed, pressureHpa: weather.current.pressure,
        boundaryLayerM_noon: blhAt(12),
      },
      forecastPm2_5_today: Object.fromEntries(todayHours.map((h) => [h, todayPm[h]])),
      forecastPm2_5_tomorrow: Object.fromEntries(tomorrowHours.map((h) => [h, tomorrowPm[h]])),
      outdoorWindows: outdoor.map((w) => ({ day: w.date === today ? 'today' : 'tomorrow', from: w.startHour, to: w.endHour, meanPm2_5: w.pm2_5 })),
      ventilationWindows: ventilation.map((w) => ({ day: w.date === today ? 'today' : 'tomorrow', from: w.startHour, to: w.endHour, meanPm2_5: w.pm2_5 })),
      profile: slimProfile(profile),
      nearbyParks: (nearbyPlaces?.parks || []).slice(0, 3).map((p: any) => ({ name: p.name, km: p.dist })),
    };

    const prompt = `${langLine(lang)}
Create a personalised daily air-quality routine (no greeting, start directly with the situation) from this LIVE DATA (forecast PM2.5 in µg/m³ by local hour). Use only these numbers.

<user_data>${JSON.stringify(context)}</user_data>

Instructions:
- "today": exactly one entry for each hour in forecastPm2_5_today (${todayHours.join(', ') || 'none'}); "tomorrow": one for each hour in forecastPm2_5_tomorrow (${tomorrowHours.join(', ')}). label = e.g. "2 PM". Pick an activity (outdoor play/exercise, commute, ventilate home, stay indoors, school pickup, sleep…) fitted to this household.
- EVERY advice string must quote the forecast PM2.5 for that hour (e.g. "forecast PM2.5 48 µg/m³").
- Guide: <55 good, 55–100 caution, >100 avoid strenuous outdoor activity; recommend N95/FFP2 outdoors when PM2.5 >100 or US AQI >150. Mask advice must consider what the household owns.
- outdoorWindowReasons: one short reason per outdoorWindows item (same order). ventilationTips: one tip per ventilationWindows item (same order) — when to open windows and for how long.
- memberAdvice: one entry per age group present plus each sensitivity (asthma, heart, pregnancy). If school-going kids, address the pickup time.
- whyBadToday: one or two sentences using wind speed / boundary layer / humidity / season from the data only.`;

    const out = await generateJson({ prompt, responseSchema: DAILY_PLAN_SCHEMA, zod: zPlan, temperature: 0.4, maxOutputTokens: 6000 });

    // Re-attach real numbers deterministically — the model never controls numeric values.
    const withPm = (arr: z.infer<typeof zHour>[], table: Record<number, number>) =>
      arr.map((h) => ({ ...h, pm2_5_ref: table[h.hour] ?? null })).filter((h) => h.pm2_5_ref != null);
    const result = {
      summary: out.summary, overallRisk: out.overallRisk, whyBadToday: out.whyBadToday,
      today: withPm(out.today, todayPm), tomorrow: withPm(out.tomorrow, tomorrowPm),
      memberAdvice: out.memberAdvice,
      bestOutdoorWindows: outdoor.map((w, i) => ({ ...w, day: w.date === today ? 'today' : 'tomorrow', reason: (out.outdoorWindowReasons ?? [])[i] ?? '' })),
      ventilationWindows: ventilation.map((w, i) => ({ ...w, day: w.date === today ? 'today' : 'tomorrow', tip: (out.ventilationTips ?? [])[i] ?? '' })),
      disclaimer: out.disclaimer,
      generatedAt: new Date().toISOString(),
    };
    aiCache.set(key, result);
    return res.json({ ...result, cached: false });
  } catch (err: any) {
    return fail(res, 'AI plan generation', err);
  }
});

// ============================================================
// INDOOR HACKS
// ============================================================
const INDOOR_SCHEMA = {
  type: O,
  properties: {
    summary: { type: S },
    rankedActions: {
      type: A, minItems: 6, maxItems: 8,
      items: {
        type: O,
        properties: {
          rank: { type: I }, action: { type: S },
          impact: { type: S, enum: ['high', 'medium', 'low'] },
          effort: { type: S, enum: ['easy', 'moderate', 'hard'] },
          cost: { type: S, enum: ['free', 'low', 'medium', 'high'] },
          why: { type: S, description: 'which user/profile/live-data fact makes this rank here' },
          steps: { type: A, items: { type: S } },
        },
        required: ['rank', 'action', 'impact', 'effort', 'cost', 'why', 'steps'],
      },
    },
    skipList: {
      type: A,
      items: { type: O, properties: { item: { type: S }, reason: { type: S } }, required: ['item', 'reason'] },
      description: 'things that do NOT help (myths) and why',
    },
    purifier: {
      type: O,
      properties: { advice: { type: S }, budgetOptions: { type: A, items: { type: S } }, filterCareTips: { type: A, items: { type: S } } },
      required: ['advice', 'filterCareTips'],
    },
    diyCorsiRosenthal: { type: A, items: { type: S }, description: 'step-by-step Corsi-Rosenthal cube instructions' },
    cookingTips: { type: A, items: { type: S } },
    plantFacts: { type: A, items: { type: S } },
    disclaimer: { type: S },
  },
  required: ['summary', 'rankedActions', 'skipList', 'purifier', 'diyCorsiRosenthal', 'cookingTips', 'plantFacts', 'disclaimer'],
};
const zIndoor = z.object({
  summary: z.string(),
  rankedActions: z.array(z.object({
    rank: z.coerce.number(), action: z.string(), impact: z.string(), effort: z.string(), cost: z.string(),
    why: z.string().default(''), steps: z.array(z.string()),
  })).min(4),
  skipList: z.array(z.object({ item: z.string(), reason: z.string() })),
  purifier: z.object({ advice: z.string(), budgetOptions: z.array(z.string()).default([]), filterCareTips: z.array(z.string()) }),
  diyCorsiRosenthal: z.array(z.string()), cookingTips: z.array(z.string()), plantFacts: z.array(z.string()),
  disclaimer: z.string(),
});

router.post('/indoor-hacks', aiLimiter, async (req, res) => {
  try {
    const { airQuality, profile, roomArea, ceilingHeight } = req.body || {};
    if (!airQuality?.current) return res.status(400).json({ error: 'airQuality required' });
    const area = Math.min(Math.max(Number(roomArea) || 15, 4), 200);
    const h = Math.min(Math.max(Number(ceilingHeight) || 2.7, 2), 5);
    const lang = profile?.language || 'en';
    // Deterministic sizing: CADR = ACH × volume. 5 ACH target (see /api/impact/room)
    const volume = area * h;
    const cadr = Math.round(volume * 5);
    const key = `indoor:${airQuality.current.time?.slice(0, 13)}:${(+airQuality.meta?.latitude).toFixed(2)}:${area}:${lang}:${hashObj(slimProfile(profile))}`;
    const hit = aiCache.get(key);
    if (hit) return res.json({ ...(hit as object), cached: true });

    const ctx = {
      outdoorPm2_5: airQuality.current.pm2_5, outdoorUsAqi: airQuality.current.usAqi,
      indiaCategory: airQuality.naqi?.category,
      roomAreaM2: area, ceilingM: h, roomVolumeM3: +volume.toFixed(1),
      recommendedCADR_m3_per_h: cadr, targetACH: 5,
      profile: slimProfile(profile),
    };
    const prompt = `${langLine(lang)}
Give personalised INDOOR air-quality actions for this household. Use only the data below.
<user_data>${JSON.stringify(ctx)}</user_data>
- rankedActions: 6–8 actions ranked by impact for THIS household (consider cooking fuel, windows, existing purifier/AC, smokers, pets, budget). Each has concrete numbered-style steps.
- skipList: 3–5 popular things that do NOT help (e.g. houseplants for PM, ozone/ionizer gadgets, burning incense) and why.
- purifier: use the provided recommendedCADR (${cadr} m³/h for ${area} m², 5 ACH). Do not change it. Add HEPA filter care/replacement tips (typically every 6–12 months; shorter in heavy smog).
- diyCorsiRosenthal: exact steps to build a box-fan + 4 MERV-13 filter cube (safe fan use, no unattended running if damaged).
- plantFacts: honest facts on what plants can/cannot do for particulate matter.`;
    const out = await generateJson({ prompt, responseSchema: INDOOR_SCHEMA, zod: zIndoor, temperature: 0.3, maxOutputTokens: 6000 });
    const result = { ...out, calculatedCadr: cadr, roomArea: area, ceilingHeight: h, targetACH: 5 };
    aiCache.set(key, result);
    return res.json({ ...result, cached: false });
  } catch (err: any) {
    return fail(res, 'Indoor hacks generation', err);
  }
});

// ============================================================
// ALTERNATIVES
// ============================================================
const ALT_SCHEMA = {
  type: O,
  properties: {
    summary: { type: S },
    alternatives: {
      type: A,
      items: {
        type: O,
        properties: {
          category: { type: S, enum: ['commute', 'cooking', 'vehicle', 'waste', 'community', 'home'] },
          current: { type: S }, alternative: { type: S },
          nearbyOption: { type: S, description: 'actual nearby station/stop/stand name with distance, or "none found within radius"' },
          timeTradeoff: { type: S }, costTradeoff: { type: S },
          difficulty: { type: S, enum: ['easy', 'moderate', 'challenging'] },
          steps: { type: A, items: { type: S } },
        },
        required: ['category', 'current', 'alternative', 'nearbyOption', 'timeTradeoff', 'costTradeoff', 'difficulty', 'steps'],
      },
    },
    communityActions: { type: A, items: { type: S } },
    disclaimer: { type: S },
  },
  required: ['summary', 'alternatives', 'communityActions', 'disclaimer'],
};
const zAlt = z.object({
  summary: z.string(),
  alternatives: z.array(z.object({
    category: z.string(), current: z.string(), alternative: z.string(), nearbyOption: z.string(),
    timeTradeoff: z.string(), costTradeoff: z.string(), difficulty: z.string(), steps: z.array(z.string()),
  })),
  communityActions: z.array(z.string()), disclaimer: z.string(),
});

router.post('/alternatives', aiLimiter, async (req, res) => {
  try {
    const { profile, nearbyPlaces, emissions } = req.body || {};
    const lang = profile?.language || 'en';
    const pick = (a: any[] = [], n = 3) => a.slice(0, n).map((p) => ({ name: p.name, km: p.dist, kind: p.subtype || p.type }));
    const ctx = {
      profile: slimProfile(profile),
      nearby: nearbyPlaces ? {
        radiusKm: nearbyPlaces.queryRadius ? nearbyPlaces.queryRadius / 1000 : null,
        metroOrRailStations: pick(nearbyPlaces.transit), busStops: pick(nearbyPlaces.busStops),
        bikeRentals: pick(nearbyPlaces.bikeRentals), parks: pick(nearbyPlaces.parks, 2),
      } : 'UNAVAILABLE (map-data service did not respond) — do not name any specific stations or stops',
      engineEmissionsPerTrip: emissions, // deterministic numbers from the Impact Engine
    };
    const key = `alt:${lang}:${hashObj(ctx)}`;
    const hit = aiCache.get(key);
    if (hit) return res.json({ ...(hit as object), cached: true });

    const prompt = `${langLine(lang)}
Suggest realistic low-emission alternatives for this user's commute, cooking, vehicle and habits.
<user_data>${JSON.stringify(ctx)}</user_data>
- Name ONLY places listed in "nearby" (with their distance in km). If none exist for a mode, say none were found within the radius — do not invent any.
- Do not invent CO₂/PM numbers: quote engineEmissionsPerTrip where relevant, otherwise describe qualitatively.
- timeTradeoff and costTradeoff must be honest (say if it is slower or costlier). Include carpooling, CNG/EV, induction cooking, avoiding biomass/waste burning, WFH where relevant.
- communityActions: tree planting, reporting open burning, school anti-idling campaigns, RWA actions.`;
    const result = await generateJson({ prompt, responseSchema: ALT_SCHEMA, zod: zAlt, temperature: 0.4, maxOutputTokens: 5000 });
    aiCache.set(key, result);
    return res.json({ ...result, cached: false });
  } catch (err: any) {
    return fail(res, 'Alternatives generation', err);
  }
});

// ============================================================
// IMPACT EXPLANATION (explains deterministic numbers — never changes them)
// ============================================================
const IMPACT_SCHEMA = {
  type: O,
  properties: {
    headline: { type: S },
    explanation: { type: A, items: { type: S }, description: 'short friendly bullet points' },
    forKidsAndElders: { type: S },
    nextStep: { type: S },
    uncertainty: { type: S },
  },
  required: ['headline', 'explanation', 'forKidsAndElders', 'nextStep', 'uncertainty'],
};
const zImpact = z.object({
  headline: z.string(), explanation: z.array(z.string()), forKidsAndElders: z.string(),
  nextStep: z.string(), uncertainty: z.string(),
});

router.post('/explain-impact', aiLimiter, async (req, res) => {
  try {
    const { impactData, profile } = req.body || {};
    if (!impactData) return res.status(400).json({ error: 'impactData required' });
    const lang = profile?.language || 'en';
    const key = `impact:${lang}:${hashObj(impactData)}`;
    const hit = aiCache.get(key);
    if (hit) return res.json({ ...(hit as object), cached: true });
    const prompt = `${langLine(lang)}
A deterministic Impact Engine (not you) computed the numbers below. Explain them in plain, warm language. Do NOT change, round differently, or add numbers; only reuse the ones given. Mention the main assumptions and that real exposure varies.
<user_data>${JSON.stringify(impactData)}</user_data>
- explanation: 3–5 short bullets (what the dose means, why the change helps, CO₂ meaning).
- forKidsAndElders: 2 very simple sentences with a relatable analogy that does not use invented figures.
- nextStep: one concrete action.
- uncertainty: one sentence on limits of the estimate.`;
    const result = await generateJson({ prompt, responseSchema: IMPACT_SCHEMA, zod: zImpact, temperature: 0.4, maxOutputTokens: 4000 });
    aiCache.set(key, result);
    return res.json({ ...result, cached: false });
  } catch (err: any) {
    return fail(res, 'Impact explanation', err);
  }
});

// ============================================================
// CHAT — streaming with real function calling
// ============================================================
const TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_city_aqi',
      description: 'Get the live air quality (PM2.5, PM10, US AQI, India NAQI) for any city in the world.',
      parameters: { type: O, properties: { city: { type: S, description: 'City name, e.g. "Mumbai"' } }, required: ['city'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_forecast',
      description: 'Get the hourly PM2.5 forecast summary and cleanest 2-hour windows for a city, for today or tomorrow (local time).',
      parameters: {
        type: O,
        properties: { city: { type: S }, day: { type: S, enum: ['today', 'tomorrow'] } },
        required: ['city', 'day'],
      },
    },
  },
];

async function runTool(name: string, args: any): Promise<any> {
  const city = sanitizeText(args?.city, 80);
  const geo = await geocodeCity(city);
  if (!geo) return { error: `I don't have data for "${city}" — city not found.` };
  const aq = await getAirQuality(geo.lat, geo.lon);
  const place = `${geo.name}${geo.state ? ', ' + geo.state : ''}, ${geo.country}`;
  if (name === 'fetch_city_aqi') {
    return {
      place, localTime: aq.current.time, pm2_5: aq.current.pm2_5, pm10: aq.current.pm10,
      usAqi: aq.current.usAqi, usCategory: aq.usCategory.label,
      indiaNAQI: aq.naqi.value, indiaCategory: aq.naqi.category, dominant: aq.naqi.dominantPollutant,
    };
  }
  if (name === 'fetch_forecast') {
    const today = aq.current.time.slice(0, 10);
    const date = args?.day === 'tomorrow' ? addDays(today, 1) : today;
    const nowHour = parseInt(aq.current.time.slice(11, 13), 10);
    const hourly = hourlyFor(aq.hourly.time, aq.hourly.pm2_5, date);
    return {
      place, date, pm2_5_by_hour: hourly,
      cleanestWindows: bestWindows(aq.hourly.time, aq.hourly.pm2_5, date, {
        fromHour: 6, toHour: 21, len: 2, top: 2, minHour: date === today ? nowHour : 0,
      }),
    };
  }
  return { error: 'unknown tool' };
}

router.post('/chat', aiLimiter, async (req, res) => {
  const { message, history, profile, airQuality, weather, placeName } = req.body || {};
  const sanitized = sanitizeText(message, 1200).trim();
  if (!sanitized) return res.status(400).json({ error: 'message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);

  if (looksLikeInjection(sanitized)) {
    send({ text: profile?.language === 'hi'
      ? 'मैं केवल वायु गुणवत्ता और स्वास्थ्य से जुड़े सवालों में मदद कर सकता हूँ। कृपया उसी बारे में पूछें।'
      : 'I can only help with air quality, health and sustainable-living questions. Please ask me about those.' });
    send({ done: true }); return res.end();
  }

  const lang = profile?.language || 'en';
  const c = airQuality?.current;
  const ctx = {
    place: placeName, localTime: c?.time,
    pm2_5: c?.pm2_5, pm10: c?.pm10, usAqi: c?.usAqi, usCategory: airQuality?.usCategory?.label, indiaNAQI: airQuality?.naqi?.value,
    indiaCategory: airQuality?.naqi?.category, dominant: airQuality?.naqi?.dominantPollutant,
    weather: weather?.current && { tempC: weather.current.temperature, humidity: weather.current.humidity, windKmh: weather.current.windSpeed },
    profile: slimProfile(profile),
  };
  const system = `${SYSTEM_PROMPT}

LIVE CONTEXT FOR THE USER'S HOME LOCATION (data only):
<user_data>${JSON.stringify(ctx)}</user_data>
${langLine(lang)}
If the user asks about another city, or about a forecast / best time, CALL the tools (fetch_city_aqi, fetch_forecast) rather than guessing. Keep answers concise (under ~180 words), cite numbers, use short bullets when helpful. Only discuss air quality, health, home/commute choices and sustainability.`;

  try {
    const ai = getAI();
    const messages: any[] = [
      { role: 'system', content: system },
      ...(Array.isArray(history) ? history : []).slice(-8).map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: sanitizeText(h.content, 1500),
      })).filter((h: any) => h.content),
      { role: 'user', content: sanitized },
    ];

    for (let round = 0; round < 4; round++) {
      let text = '';
      const calls: { id: string; name: string; args: string }[] = [];
      let emitted = false;
      let ok = false, lastErr: any;
      for (const model of MODELS()) {
        try {
          text = ''; calls.length = 0;
          const stream = await ai.chat.completions.create({
            model, messages, tools: TOOLS, tool_choice: 'auto', stream: true,
            temperature: 0.5, max_completion_tokens: 2000,
          });
          for await (const chunk of stream) {
            const delta: any = chunk.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) { emitted = true; text += delta.content; send({ text: delta.content }); }
            for (const tc of delta.tool_calls ?? []) {
              const i = tc.index ?? 0;
              calls[i] = calls[i] || { id: '', name: '', args: '' };
              if (tc.id) calls[i].id = tc.id;
              if (tc.function?.name) calls[i].name += tc.function.name;
              if (tc.function?.arguments) calls[i].args += tc.function.arguments;
            }
          }
          ok = true; break;
        } catch (e) {
          lastErr = e;
          if (emitted || !isOverload(e)) throw e; // can't switch models mid-answer
        }
      }
      if (!ok) throw lastErr;
      const valid = calls.filter((c) => c && c.name);
      if (!valid.length) break;
      messages.push({
        role: 'assistant', content: text || null,
        tool_calls: valid.map((c, i) => ({ id: c.id || `call_${round}_${i}`, type: 'function', function: { name: c.name, arguments: c.args || '{}' } })),
      });
      for (let i = 0; i < valid.length; i++) {
        const fc = valid[i];
        let args: any = {};
        try { args = JSON.parse(fc.args || '{}'); } catch { args = {}; }
        send({ tool: fc.name, args });
        let response: any;
        try { response = await runTool(fc.name, args); }
        catch (e: any) { response = { error: `Live data fetch failed: ${String(e?.message).slice(0, 100)}` }; }
        messages.push({ role: 'tool', tool_call_id: fc.id || `call_${round}_${i}`, content: JSON.stringify(response) });
      }
    }
    send({ done: true });
    res.end();
  } catch (err: any) {
    console.error('[Chat Error]', err?.message);
    send({ error: /API key|\b401\b|not configured/i.test(String(err?.message)) ? 'AI service is not configured correctly (missing or invalid GROQ_API_KEY).' : 'The assistant could not answer right now. Please try again.' });
    res.end();
  }
});

// ============================================================
// SUGGESTED QUESTIONS
// ============================================================
router.post('/suggested-questions', aiLimiter, async (req, res) => {
  try {
    const { airQuality, profile } = req.body || {};
    if (!airQuality?.current) return res.status(400).json({ error: 'airQuality required' });
    const lang = profile?.language || 'en';
    const key = `sq:${lang}:${Math.round(airQuality.current.pm2_5 / 10)}:${hashObj(slimProfile(profile).members)}:${hashObj(slimProfile(profile).sensitivities)}`;
    const hit = aiCache.get(key);
    if (hit) return res.json(hit);
    const ctx = { pm2_5: airQuality.current.pm2_5, usAqi: airQuality.current.usAqi, members: profile?.household?.members, sensitivities: profile?.household?.sensitivities, hasPurifier: profile?.lifestyle?.hasPurifier };
    const prompt = `${langLine(lang)}
Suggest 5 short questions (each under 60 characters) this household might ask right now.
<user_data>${JSON.stringify(ctx)}</user_data>
Tie them to the conditions (e.g. kids and outdoor play, windows, purifier vs mask).`;
    const out = await generateJson({
      prompt, responseSchema: { type: O, properties: { questions: { type: A, items: { type: S } } }, required: ['questions'] },
      zod: z.object({ questions: z.array(z.string()).min(1) }), temperature: 0.7, maxOutputTokens: 2000,
    });
    const result = { questions: out.questions.slice(0, 5) };
    aiCache.set(key, result);
    return res.json(result);
  } catch (err: any) {
    return fail(res, 'Suggested questions', err);
  }
});

// ============================================================
// WHY IS THE AIR BAD — one-liner from real values
// ============================================================
router.post('/why-smog', aiLimiter, async (req, res) => {
  try {
    const { airQuality, weather, profile } = req.body || {};
    if (!airQuality?.current || !weather?.current) return res.status(400).json({ error: 'airQuality and weather required' });
    const lang = profile?.language || 'en';
    const nowLocal: string = airQuality.current.time;
    const bi = weather.hourly?.time?.indexOf(nowLocal.slice(0, 13) + ':00');
    const blh = bi >= 0 ? weather.hourly.boundaryLayerHeight?.[bi] : null;
    const ctx = {
      pm2_5: airQuality.current.pm2_5, usAqi: airQuality.current.usAqi,
      windKmh: weather.current.windSpeed, boundaryLayerM: blh, humidityPct: weather.current.humidity,
      tempC: weather.current.temperature, pressureHpa: weather.current.pressure,
      visibilityM: weather.current.visibility, month: new Date(nowLocal).toLocaleString('en', { month: 'long' }),
      lat: airQuality.meta?.latitude,
    };
    const key = `why:${lang}:${nowLocal.slice(0, 13)}:${(+ctx.lat).toFixed(1)}:${hashObj(ctx)}`;
    const hit = aiCache.get(key);
    if (hit) return res.json(hit);
    const prompt = `${langLine(lang)}
In ONE sentence (max 35 words), explain why the air is at this level right now, using only these real values (wind speed, boundary-layer height/inversion, humidity, season, temperature). If the air is clean, say what is keeping it clean. Quote at least two of the numbers. Do not invent causes you cannot infer.
<user_data>${JSON.stringify(ctx)}</user_data>`;
    const explanation = await generateText(prompt, 0.3, 200);
    const result = { explanation };
    aiCache.set(key, result);
    return res.json(result);
  } catch (err: any) {
    return fail(res, 'Smog explanation', err);
  }
});

export { router as aiRouter };
