import { UserProfile } from '../store/profileStore';

/** Maps the user's profile to the Impact Engine's emission-factor keys. */
export function emissionKey(l: UserProfile['lifestyle']): string | null {
  switch (l.commute) {
    case 'walk': return 'walk';
    case 'bike': return 'bike';
    case 'bus': return 'bus';
    case 'metro': return 'metro';
    case 'two_wheeler': return l.vehicle === 'ev' ? 'two_ev' : 'two_petrol';
    case 'car': return l.vehicle === 'ev' ? 'car_ev' : l.vehicle === 'diesel' ? 'car_diesel' : l.vehicle === 'cng' ? 'car_cng' : 'car_petrol';
    default: return null;
  }
}

export const MODE_LABEL: Record<string, string> = {
  walk: 'Walking', bike: 'Cycling', ebike: 'E-bike', metro: 'Metro', bus: 'Bus', car_petrol: 'Petrol car', car_diesel: 'Diesel car',
  car_ev: 'Electric car', car_cng: 'CNG car', two_petrol: 'Petrol two-wheeler', two_ev: 'Electric two-wheeler',
};
