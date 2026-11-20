const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';

async function fetchWithError(url: string, opts?: RequestInit) {
  const r = await fetch(url, { ...opts });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(body.error || `HTTP ${r.status}`);
  }
  return r.json();
}

/** Direct browser call to Open-Meteo (user's own IP) — fallback when the server is rate-limited. Same shape as /api/weather. */
async function weatherDirect(lat: number, lon: number) {
  const qs = new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lon.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,surface_pressure,cloud_cover,visibility,is_day,weather_code',
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,precipitation,surface_pressure,cloud_cover,visibility,boundary_layer_height,weather_code',
    forecast_days: '5', past_days: '1', timezone: 'auto', wind_speed_unit: 'kmh',
  });
  const d = await fetchWithError(`https://api.open-meteo.com/v1/forecast?${qs}`);
  const c = d.current, h = d.hourly;
  return {
    current: {
      temperature: c.temperature_2m, humidity: c.relative_humidity_2m, apparentTemperature: c.apparent_temperature,
      windSpeed: c.wind_speed_10m, windDirection: c.wind_direction_10m, windGusts: c.wind_gusts_10m,
      precipitation: c.precipitation, pressure: c.surface_pressure, cloudCover: c.cloud_cover,
      visibility: c.visibility, isDay: c.is_day, weatherCode: c.weather_code, time: c.time,
    },
    hourly: {
      time: h.time, temperature: h.temperature_2m, humidity: h.relative_humidity_2m, windSpeed: h.wind_speed_10m,
      windDirection: h.wind_direction_10m, precipProbability: h.precipitation_probability, precipitation: h.precipitation,
      pressure: h.surface_pressure, cloudCover: h.cloud_cover, visibility: h.visibility,
      boundaryLayerHeight: h.boundary_layer_height, weatherCode: h.weather_code,
    },
    units: d.current_units,
    meta: { latitude: d.latitude, longitude: d.longitude, timezone: d.timezone, fetchedAt: new Date().toISOString() },
    cached: false,
  };
}

export const api = {
  health: () => fetchWithError(`${BASE}/api/health`),
  airQuality: (lat: number, lon: number) =>
    fetchWithError(`${BASE}/api/air-quality?lat=${lat}&lon=${lon}`),
  weather: (lat: number, lon: number) =>
    fetchWithError(`${BASE}/api/weather?lat=${lat}&lon=${lon}`).catch(() => weatherDirect(lat, lon)),
  geocodeSearch: (q: string, language = 'en') =>
    fetchWithError(`${BASE}/api/geocode/search?q=${encodeURIComponent(q)}&language=${language}`),
  geocodeReverse: (lat: number, lon: number) =>
    fetchWithError(`${BASE}/api/geocode/reverse?lat=${lat}&lon=${lon}`),
  overpassNearby: (lat: number, lon: number, radius = 3000) =>
    fetchWithError(`${BASE}/api/overpass/nearby?lat=${lat}&lon=${lon}&radius=${radius}`),
  waqiStation: (lat: number, lon: number) =>
    fetchWithError(`${BASE}/api/waqi/station?lat=${lat}&lon=${lon}`),
  ai: {
    dailyPlan: (body: object) =>
      fetchWithError(`${BASE}/api/ai/daily-plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    indoorHacks: (body: object) =>
      fetchWithError(`${BASE}/api/ai/indoor-hacks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    alternatives: (body: object) =>
      fetchWithError(`${BASE}/api/ai/alternatives`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    explainImpact: (body: object) =>
      fetchWithError(`${BASE}/api/ai/explain-impact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    whySmog: (body: object) =>
      fetchWithError(`${BASE}/api/ai/why-smog`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    suggestedQuestions: (body: object) =>
      fetchWithError(`${BASE}/api/ai/suggested-questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    chatStream: async (
      body: object,
      h: { onText: (t: string) => void; onTool?: (name: string, args: any) => void; onDone: () => void; onError: (e: string) => void },
      signal?: AbortSignal
    ) => {
      let r: Response;
      try {
        r = await fetch(`${BASE}/api/ai/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
        });
      } catch (e: any) { if (e?.name !== 'AbortError') h.onError('Network error — are you offline?'); return; }
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        h.onError(j.error || `HTTP ${r.status}`); return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const p = JSON.parse(line.slice(6));
              if (p.text) h.onText(p.text);
              if (p.tool) h.onTool?.(p.tool, p.args);
              if (p.error) { h.onError(p.error); return; }
              if (p.done) { h.onDone(); return; }
            } catch { /* partial line */ }
          }
        }
        h.onDone();
      } catch (e: any) { if (e?.name !== 'AbortError') h.onError('Connection interrupted'); }
    },
  },
  impact: {
    exposure: (body: object) =>
      fetchWithError(`${BASE}/api/impact/exposure`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    emissions: (body: object) =>
      fetchWithError(`${BASE}/api/impact/emissions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    choices: (body: object) =>
      fetchWithError(`${BASE}/api/impact/choices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    room: (area: number, height: number, ach: number, cadr?: number) =>
      fetchWithError(`${BASE}/api/impact/room?area=${area}&height=${height}&ach=${ach}${cadr ? `&cadr=${cadr}` : ''}`),
    factors: () => fetchWithError(`${BASE}/api/impact/emission-factors`),
  },
};
