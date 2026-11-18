import { useCallback } from 'react';
import { api } from '../lib/api';
import { useDataStore } from '../store/dataStore';
import { useProfileStore } from '../store/profileStore';

let generation = 0; // latest fetch wins; stale responses are ignored

/** Loads live air, weather, nearby places, ground station + AI smog explanation for the active location. */
export function useAirData() {
  const profile = useProfileStore((s) => s.profile);
  const activeLocation = profile.locations[profile.activeLocationIndex];
  const lang = profile.language;

  const fetchAll = useCallback(async () => {
    if (!activeLocation) return;
    const gen = ++generation;
    const live = () => gen === generation;
    const d = useDataStore.getState();
    const { lat, lon } = activeLocation;
    d.setLoadingAQ(true); d.setLoadingWeather(true); d.setLoadingNearby(true);
    d.setErrorAQ(null); d.setErrorWeather(null); d.setErrorNearby(null); d.setErrorSmog(null);

    try {
      const [aq, wx] = await Promise.all([
        api.airQuality(lat, lon).catch((e: Error) => { if (live()) d.setErrorAQ(e.message || 'Network error'); return null; }),
        api.weather(lat, lon).catch((e: Error) => { if (live()) d.setErrorWeather(e.message || 'Network error'); return null; }),
      ]);
      if (!live()) return;
      if (aq) d.setAirQuality(aq);
      if (wx) d.setWeather(wx);
      d.setLoadingAQ(false); d.setLoadingWeather(false);

      await Promise.allSettled([
        api.overpassNearby(lat, lon, 3000).then((n) => live() && d.setNearby(n)).catch((e: Error) => d.setErrorNearby(e.message)),
        api.waqiStation(lat, lon).then((w) => live() && d.setWaqi(w.available === false ? null : w)).catch(() => d.setWaqi(null)),
        aq && wx
          ? api.ai.whySmog({ airQuality: aq, weather: wx, profile: { language: lang } })
              .then((r: { explanation: string }) => live() && d.setSmogExplanation(r.explanation))
              .catch((e: Error) => d.setErrorSmog(e.message))
          : Promise.resolve(),
      ]);
    } finally {
      if (live()) d.setLoadingNearby(false);
    }
  }, [activeLocation?.lat, activeLocation?.lon, lang]);

  return { fetchAll, activeLocation };
}

export interface DetectedPlace { lat: number; lon: number; name: string; country: string; state?: string }

export async function detectLocation(): Promise<DetectedPlace> {
  if (!navigator.geolocation) throw new Error('Geolocation is not supported by this browser');
  const pos = await new Promise<GeolocationPosition>((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, (e) => rej(new Error(e.code === 1 ? 'Location permission denied' : 'Could not get your location')), { timeout: 12000 })
  );
  const { latitude: lat, longitude: lon } = pos.coords;
  try {
    const g = await api.geocodeReverse(lat, lon);
    return { lat, lon, name: g.city || g.state || 'My location', country: g.country || '', state: g.state };
  } catch {
    return { lat, lon, name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: '' };
  }
}
