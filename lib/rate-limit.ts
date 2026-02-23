interface RateLimitEntry {
  count: number;
  windowEnd: number;
}

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.windowEnd < now) store.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.windowEnd < now) {
    store.set(key, { count: 1, windowEnd: now + opts.windowMs });
    return { allowed: true, remaining: opts.limit - 1, resetAt: now + opts.windowMs };
  }

  if (entry.count >= opts.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.windowEnd };
  }

  entry.count++;
  return { allowed: true, remaining: opts.limit - entry.count, resetAt: entry.windowEnd };
}
