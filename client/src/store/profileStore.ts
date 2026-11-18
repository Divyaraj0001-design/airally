import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CommutMode = 'walk' | 'bike' | 'bus' | 'metro' | 'car' | 'two_wheeler' | 'wfh';

export interface SavedLocation {
  label: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export interface HouseholdMember {
  ageGroup: 'infant' | 'toddler' | 'child' | 'teen' | 'adult' | 'senior';
  count: number;
}

export interface CompletedChoice {
  id: string;
  doneAt: string; // ISO
  doseAvoided_ug: number;
  co2Avoided_g: number;
}

export interface UserProfile {
  language: 'en' | 'hi';
  locations: SavedLocation[];
  activeLocationIndex: number;
  household: {
    members: HouseholdMember[];
    sensitivities: string[];
  };
  lifestyle: {
    commute: CommutMode;
    commuteKm: number;
    commuteDuration: number;
    wfhDays: number;
    cookingFuel: 'lpg' | 'induction' | 'biomass' | 'other';
    hasAC: boolean;
    hasPurifier: boolean;
    hasMask: boolean;
    maskType: 'none' | 'cloth' | 'surgical' | 'n95';
    windowType: 'sealed' | 'standard' | 'open';
    smokersAtHome: boolean;
    pets: boolean;
    vehicle: 'petrol' | 'diesel' | 'ev' | 'cng' | 'none';
    exerciseHabits: 'daily' | 'weekends' | 'rarely' | 'none';
    schoolKids: boolean;
    schoolPickupTime: string;
    budget: 'low' | 'medium' | 'high';
    roomArea: number;
  };
  alerts: {
    enabled: boolean;
    threshold: number;
  };
  onboardingComplete: boolean;
  completed: CompletedChoice[]; // actions the user marked as done (with the engine numbers at that moment)
  hepa: { installedAt: string | null; lifeHours: number; hoursPerDay: number };
  theme: 'dark' | 'light';
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PROFILE: UserProfile = {
  language: 'en',
  locations: [],
  activeLocationIndex: 0,
  household: { members: [], sensitivities: [] },
  lifestyle: {
    commute: 'walk', commuteKm: 5, commuteDuration: 30,
    wfhDays: 0, cookingFuel: 'lpg',
    hasAC: false, hasPurifier: false, hasMask: false,
    maskType: 'none', windowType: 'standard',
    smokersAtHome: false, pets: false, vehicle: 'none',
    exerciseHabits: 'weekends', schoolKids: false,
    schoolPickupTime: '15:00', budget: 'medium', roomArea: 15,
  },
  alerts: { enabled: false, threshold: 150 },
  onboardingComplete: false,
  completed: [],
  hepa: { installedAt: null, lifeHours: 4380, hoursPerDay: 12 },
  theme: 'dark',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface ProfileStore {
  profile: UserProfile;
  setProfile: (p: Partial<UserProfile>) => void;
  setLanguage: (lang: 'en' | 'hi') => void;
  setActiveLocation: (idx: number) => void;
  addLocation: (loc: SavedLocation) => void;
  removeLocation: (idx: number) => void;
  completeOnboarding: () => void;
  markDone: (c: CompletedChoice) => void;
  unmarkDone: (id: string) => void;
  replaceLocation: (idx: number, loc: SavedLocation) => void;
  toggleTheme: () => void;
  setAlertThreshold: (t: number) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      setProfile: (p) =>
        set((s) => ({ profile: { ...s.profile, ...p, updatedAt: new Date().toISOString() } })),
      setLanguage: (lang) =>
        set((s) => ({ profile: { ...s.profile, language: lang } })),
      setActiveLocation: (idx) =>
        set((s) => ({ profile: { ...s.profile, activeLocationIndex: idx } })),
      addLocation: (loc) =>
        set((s) => ({
          profile: {
            ...s.profile,
            locations: [...s.profile.locations.filter((l) => !(Math.abs(l.lat - loc.lat) < 0.01 && Math.abs(l.lon - loc.lon) < 0.01)), loc].slice(0, 5),
          },
        })),
      removeLocation: (idx) =>
        set((s) => ({
          profile: {
            ...s.profile,
            locations: s.profile.locations.filter((_, i) => i !== idx),
            activeLocationIndex: 0,
          },
        })),
      completeOnboarding: () =>
        set((s) => ({ profile: { ...s.profile, onboardingComplete: true } })),
      markDone: (c) =>
        set((s) => ({
          profile: {
            ...s.profile,
            completed: [...s.profile.completed.filter((x) => !(x.id === c.id && x.doneAt.slice(0, 10) === c.doneAt.slice(0, 10))), c],
          },
        })),
      unmarkDone: (id) =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10);
          return { profile: { ...s.profile, completed: s.profile.completed.filter((x) => !(x.id === id && x.doneAt.slice(0, 10) === today)) } };
        }),
      replaceLocation: (idx, loc) =>
        set((s) => ({ profile: { ...s.profile, locations: s.profile.locations.map((l, i) => (i === idx ? loc : l)) } })),
      toggleTheme: () =>
        set((s) => ({ profile: { ...s.profile, theme: s.profile.theme === 'dark' ? 'light' : 'dark' } })),
      setAlertThreshold: (t) =>
        set((s) => ({ profile: { ...s.profile, alerts: { ...s.profile.alerts, threshold: t } } })),
      reset: () => set({ profile: DEFAULT_PROFILE }),
    }),
    {
      name: 'airally-profile-v3',
      merge: (persisted: any, current) => {
        const p = persisted?.profile ?? {};
        return {
          ...current,
          profile: {
            ...current.profile, ...p,
            household: { ...current.profile.household, ...p.household },
            lifestyle: { ...current.profile.lifestyle, ...p.lifestyle },
            alerts: { ...current.profile.alerts, ...p.alerts },
            hepa: { ...current.profile.hepa, ...p.hepa },
          },
        };
      },
    }
  )
);
