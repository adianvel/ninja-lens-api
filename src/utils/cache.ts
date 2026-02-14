import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 30,
  checkperiod: 60,
  useClones: false,
});

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 30
): Promise<T> {
  const existing = cache.get<T>(key);
  if (existing !== undefined) {
    return existing;
  }

  const data = await fetcher();
  cache.set(key, data, ttlSeconds);
  return data;
}

export function invalidate(key: string): void {
  cache.del(key);
}

export function getCacheStats() {
  return cache.getStats();
}

export default cache;
