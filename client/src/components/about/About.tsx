import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';
import LocationPicker from '../onboarding/LocationPicker';
import { Card, SectionTitle } from '../ui/primitives';

const SOURCES = [
  ['Air quality (current, 24 h history, 5-day hourly forecast)', 'Open-Meteo Air Quality API — CAMS global atmospheric composition model. PM2.5, PM10, NO₂, O₃, SO₂, CO, US AQI, dust, UV.', 'https://open-meteo.com/en/docs/air-quality-api'],
  ['Weather & boundary layer', 'Open-Meteo Forecast API — temperature, humidity, wind, pressure, visibility, boundary-layer height (a proxy for inversion / pollutant trapping).', 'https://open-meteo.com/en/docs'],
  ['Ground-station AQI (optional)', 'World Air Quality Index project — nearest measuring station, shown next to the model. Hidden when unavailable.', 'https://waqi.info/'],
  ['Places, map tiles', 'OpenStreetMap contributors via Overpass API (parks, metro/rail, bus stops, cycle rental, clinics) and OSM tiles; reverse geocoding via Nominatim; city search via Open-Meteo Geocoding.', 'https://www.openstreetmap.org/copyright'],
  ['AI reasoning', 'Groq (Llama 3.3 70B — structured JSON output validated with zod, streaming chat with function calling). Groq writes advice around numbers computed elsewhere; it never produces the figures.', 'https://groq.com/'],
] as const;

const METHODS = [
  ['US AQI', 'Provided by Open-Meteo (US-EPA scale). Colour palette is colour-blind-safe (Okabe–Ito) and every colour is paired with a text label.'],
  ['India NAQI', 'CPCB National AQI 2014 sub-index formula I = [(I_hi − I_lo)/(BP_hi − BP_lo)]·(C − BP_lo) + I_lo applied to current PM2.5 and PM10; the higher sub-index wins. Official NAQI uses 24-hour averages for PM, so the value shown is indicative.'],
  ['WHO comparison', 'Concentration ÷ WHO 2021 24-hour guideline (PM2.5 15, PM10 45, NO₂ 25, O₃ 100, SO₂ 40 µg/m³; CO 4 mg/m³).'],
  ['Cleanest windows', 'Lowest mean PM2.5 over contiguous 2-hour spans (6 AM–8 PM local) in the real hourly forecast. Computed by code, not by the AI.'],
  ['Exposure dose', 'concentration × inhalation rate × hours, adjusted by indoor/outdoor ratio, commute-mode factor and mask efficiency — see “How we calculated this” on the Impact page for all factors and citations.'],
  ['CADR sizing', 'CADR (m³/h) = target air changes per hour × room volume. Default 5 ACH, 2.7 m ceilings.'],
  ['Caching', 'Air data is cached 10 minutes per location (lat/lon rounded to 2 decimals); AI results per (location, hour, profile).'],
];

export default function About({ onBack }: { onBack: () => void }) {
  const { reset } = useProfileStore();
  return (
    <div className="mx-auto max-w-4xl px-4 py-5 space-y-4">
      <button className="btn-ghost" onClick={onBack}><ArrowLeft size={14} />Back</button>
      <h1 className="text-xl font-extrabold">Data sources &amp; methodology</h1>
      <Card><SectionTitle>Your locations</SectionTitle><LocationPicker /></Card>
      <Card>
        <SectionTitle>Data sources</SectionTitle>
        <ul className="space-y-3 text-sm">{SOURCES.map(([t, d, u]) => <li key={t}><p className="font-bold">{t}</p><p className="text-fg/70">{d} <a className="underline" href={u} target="_blank" rel="noreferrer">Link</a></p></li>)}</ul>
        <p className="text-xs text-fg/60 mt-3">No mock or sample data is used anywhere. If a source fails, the app shows an error with a retry button instead of substituting numbers.</p>
      </Card>
      <Card><SectionTitle>Methodology</SectionTitle><dl className="space-y-3 text-sm">{METHODS.map(([k, v]) => <div key={k}><dt className="font-bold">{k}</dt><dd className="text-fg/70">{v}</dd></div>)}</dl></Card>
      <Card>
        <SectionTitle>Privacy &amp; safety</SectionTitle>
        <ul className="list-disc pl-5 text-sm space-y-1.5 text-fg/80">
          <li>Your profile (household, health sensitivities, lifestyle) is stored only in this browser. The server never saves or logs it; a minimal subset is sent per request to generate personalised AI text.</li>
          <li>API keys live on the server only. Chat input is length-limited, sanitised and screened for prompt-injection; requests are rate-limited.</li>
          <li><strong>Not medical advice.</strong> For symptoms such as breathlessness, wheezing, chest pain or dizziness, contact a doctor or emergency services.</li>
        </ul>
      </Card>
      <button className="btn-ghost text-red-400" onClick={() => { if (confirm('Delete your profile from this device and start over?')) { reset(); location.reload(); } }}><RotateCcw size={14} />Reset profile &amp; start over</button>
    </div>
  );
}
