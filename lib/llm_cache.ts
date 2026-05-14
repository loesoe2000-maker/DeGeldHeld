/**
 * Simple in-memory TTL cache + global rate limiter.
 * Production: replace with Redis. For now: per-process memory.
 */

type Entry<T> = { value: T; expiresAt: number };

class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  constructor(private defaultTtlMs: number) {}

  get(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

export const negotiatorCache = new TtlCache<unknown>(24 * 60 * 60 * 1000); // 24u
export const ocrCache = new TtlCache<unknown>(30 * 24 * 60 * 60 * 1000); // 30d

class RateLimiter {
  private events: number[] = [];
  constructor(
    private maxPerMinute: number,
    private maxPerDay: number,
  ) {}

  check(now = Date.now()): { ok: boolean; reason?: string } {
    this.events = this.events.filter((t) => now - t < 24 * 60 * 60 * 1000);
    const lastMinute = this.events.filter((t) => now - t < 60 * 1000).length;
    if (lastMinute >= this.maxPerMinute) {
      return { ok: false, reason: `rate cap: ${this.maxPerMinute}/min reached` };
    }
    if (this.events.length >= this.maxPerDay) {
      return { ok: false, reason: `rate cap: ${this.maxPerDay}/day reached` };
    }
    return { ok: true };
  }

  record(now = Date.now()): void {
    this.events.push(now);
  }

  reset(): void {
    this.events = [];
  }

  countLastMinute(now = Date.now()): number {
    return this.events.filter((t) => now - t < 60 * 1000).length;
  }

  countLastDay(now = Date.now()): number {
    return this.events.filter((t) => now - t < 24 * 60 * 60 * 1000).length;
  }
}

export const groqLimiter = new RateLimiter(5, 100);

export function cacheKey(parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => String(p ?? "")).join("|");
}
