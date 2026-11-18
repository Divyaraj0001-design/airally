import NodeCache from 'node-cache';

// Cache with 10 minute TTL for AQ data, 60 min for geocode
export const aqCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
export const geoCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });
export const aiCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });

// Round lat/lon to 2 decimal places for cache key deduplication
export function roundCoord(val: number, decimals = 2): number {
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function aqCacheKey(lat: number, lon: number): string {
  return `aq:${roundCoord(lat)},${roundCoord(lon)}`;
}

export function weatherCacheKey(lat: number, lon: number): string {
  return `wx:${roundCoord(lat)},${roundCoord(lon)}`;
}
