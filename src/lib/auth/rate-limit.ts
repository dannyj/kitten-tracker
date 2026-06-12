import "server-only";

// In-memory fixed-window rate limiter. Single app instance, so this is enough;
// swap for something shared if the app ever scales past one container.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Window = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as { __loginAttempts?: Map<string, Window> };
const attempts = (globalForRateLimit.__loginAttempts ??= new Map<string, Window>());

/** Returns true if this attempt is allowed, false if the key is rate limited. */
export function consumeLoginAttempt(key: string): boolean {
  const now = Date.now();

  // Opportunistic cleanup so the map doesn't grow unboundedly.
  if (attempts.size > 1000) {
    for (const [k, w] of attempts) {
      if (w.resetAt <= now) attempts.delete(k);
    }
  }

  const window = attempts.get(key);
  if (!window || window.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  window.count += 1;
  return window.count <= MAX_ATTEMPTS;
}

/** Clear the window after a successful login so legitimate users aren't locked out. */
export function resetLoginAttempts(key: string): void {
  attempts.delete(key);
}
