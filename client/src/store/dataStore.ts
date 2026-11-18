import { create } from 'zustand';

export interface AirQualityData {
  current: {
    pm2_5: number; pm10: number; no2: number; o3: number;
    so2: number; co: number; usAqi: number; europeanAqi: number;
    dust: number; uvIndex: number; aerosolOpticalDepth: number | null;
    ammonia: number | null; time: string;
  };
  naqi: { value: number; category: string; dominantPollutant: string };
  usCategory: { label: string; color: string; emoji: string };
  whoRatios: Record<string, number | null>;
  whoGuidelines: Record<string, { daily?: number; annual?: number; unit: string }>;
  hourly: {
    time: string[]; pm2_5: number[]; pm10: number[]; no2: number[];
    o3: number[]; so2: number[]; co: number[]; usAqi: number[];
    europeanAqi: number[]; dust: number[]; uvIndex: number[];
  };
  meta: { latitude: number; longitude: number; timezone: string; fetchedAt: string };
  cached: boolean;
}

export interface WeatherData {
  current: {
    temperature: number; humidity: number; apparentTemperature: number;
    windSpeed: number; windDirection: number; windGusts: number;
    precipitation: number; pressure: number; cloudCover: number;
    visibility: number; isDay: number; weatherCode: number; time: string;
  };
  hourly: {
    time: string[]; temperature: number[]; humidity: number[];
    windSpeed: number[]; windDirection: number[]; precipProbability: number[];
    precipitation: number[]; pressure: number[]; cloudCover: number[];
    visibility: number[]; boundaryLayerHeight: number[]; weatherCode: number[];
  };
  meta: { latitude: number; longitude: number; timezone: string; fetchedAt: string };
}

export interface NearbyPlace {
  type: string; name: string; lat: number; lon: number; dist: number;
  tags?: Record<string, string>;
}

export interface NearbyPlaces {
  parks: NearbyPlace[]; transit: NearbyPlace[]; busStops: NearbyPlace[];
  bikeRentals: NearbyPlace[]; clinics: NearbyPlace[]; total: number; queryRadius: number;
}

export interface WAQIData {
  available: boolean; stationName: string; stationUrl?: string;
  aqi: number; dominentPol: string; time: string;
  readings: Record<string, number | null>;
  attribution: Array<{ url: string; name: string }>;
}

interface DataStore {
  airQuality: AirQualityData | null;
  weather: WeatherData | null;
  nearby: NearbyPlaces | null;
  waqi: WAQIData | null;
  smogExplanation: string | null;
  isLoadingAQ: boolean;
  isLoadingWeather: boolean;
  isLoadingNearby: boolean;
  errorAQ: string | null;
  errorWeather: string | null;
  errorNearby: string | null;
  errorSmog: string | null;
  lastFetchedAt: string | null;
  setAirQuality: (d: AirQualityData | null) => void;
  setWeather: (d: WeatherData | null) => void;
  setNearby: (d: NearbyPlaces | null) => void;
  setWaqi: (d: WAQIData | null) => void;
  setSmogExplanation: (s: string | null) => void;
  setLoadingAQ: (b: boolean) => void;
  setLoadingWeather: (b: boolean) => void;
  setLoadingNearby: (b: boolean) => void;
  setErrorAQ: (e: string | null) => void;
  setErrorWeather: (e: string | null) => void;
  setErrorNearby: (e: string | null) => void;
  setErrorSmog: (e: string | null) => void;
  clearForLocation: () => void;
}

export const useDataStore = create<DataStore>((set) => ({
  airQuality: null, weather: null, nearby: null, waqi: null,
  smogExplanation: null, isLoadingAQ: false, isLoadingWeather: false,
  isLoadingNearby: false, errorAQ: null, errorWeather: null, errorNearby: null, errorSmog: null, lastFetchedAt: null,
  setAirQuality: (d) => set({ airQuality: d, lastFetchedAt: new Date().toISOString(), errorAQ: null }),
  setWeather: (d) => set({ weather: d, errorWeather: null }),
  setNearby: (d) => set({ nearby: d }),
  setWaqi: (d) => set({ waqi: d }),
  setSmogExplanation: (s) => set({ smogExplanation: s }),
  setLoadingAQ: (b) => set({ isLoadingAQ: b }),
  setLoadingWeather: (b) => set({ isLoadingWeather: b }),
  setLoadingNearby: (b) => set({ isLoadingNearby: b }),
  setErrorAQ: (e) => set({ errorAQ: e }),
  setErrorWeather: (e) => set({ errorWeather: e }),
  setErrorNearby: (e) => set({ errorNearby: e }),
  setErrorSmog: (e) => set({ errorSmog: e }),
  clearForLocation: () => set({ airQuality: null, weather: null, nearby: null, waqi: null, smogExplanation: null }),
}));
