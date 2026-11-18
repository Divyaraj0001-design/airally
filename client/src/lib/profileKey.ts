import { UserProfile } from '../store/profileStore';

/** Stable string of the profile bits that affect AI output (used for cache keys). */
export function profileKey(p: UserProfile): string {
  return JSON.stringify([p.language, p.household, p.lifestyle]);
}

export function aiProfile(p: UserProfile) {
  return { language: p.language, household: p.household, lifestyle: p.lifestyle };
}
