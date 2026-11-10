// Pure limiter core. No forwarding header is a trusted client identity.
export class LoginLimits {
  private accounts = new Map<string, { count: number; until: number }>();
  private total = { count: 0, until: 0 };
  private active = 0;
  private readonly capacity: number;
  constructor(capacity = 1000) {
    this.capacity = capacity;
  }

  acquire(username: string, now = Date.now()): (() => void) | null {
    if (this.total.until <= now) this.total = { count: 0, until: now + 900_000 };
    if (this.total.count >= 50 || this.active >= 2) return null;
    for (const [key, value] of this.accounts) {
      if (value.until <= now) this.accounts.delete(key);
    }
    let account = this.accounts.get(username);
    if (!account) {
      // Refuse new identities instead of evicting a live limit.
      if (this.accounts.size >= this.capacity) return null;
      account = { count: 0, until: now + 900_000 };
      this.accounts.set(username, account);
    }
    if (account.count >= 5) return null;
    account.count++;
    this.total.count++;
    this.active++;
    let released = false;
    return () => {
      if (!released) this.active--;
      released = true;
    };
  }

  get size(): number {
    return this.accounts.size;
  }
}

export class RequestLimit {
  private until = 0;
  private count = 0;
  consume(now = Date.now()): boolean {
    if (this.until <= now) {
      this.until = now + 60_000;
      this.count = 0;
    }
    if (this.count >= 120) return false;
    this.count++;
    return true;
  }
}
