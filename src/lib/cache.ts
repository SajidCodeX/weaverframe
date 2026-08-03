// In-memory cache for application-wide caching
const cache = new Map<string, { data: any; expiry: number }>();

export const getCache = <T>(key: string): T | null => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
};

export const setCache = (key: string, data: any, ttlSeconds: number) => {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
};

export const invalidateCache = (prefix: string) => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};
