const CACHE_VERSION = 1;
const prefix = `by-the-whey:v${CACHE_VERSION}:`;

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${prefix}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: T; savedAt: number };
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(`${prefix}${key}`, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // A full or unavailable cache must never prevent the live app from working.
  }
}
