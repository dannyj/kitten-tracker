import "server-only";
import { LoginLimits, RequestLimit } from "./login-limits";

// One standalone process only. Use shared storage before adding replicas.
const state = globalThis as unknown as {
  __loginLimits?: LoginLimits;
  __loginRequests?: RequestLimit;
};
const limits = (state.__loginLimits ??= new LoginLimits());
export function acquireLoginAttempt(username: string): (() => void) | null {
  return limits.acquire(username);
}

const requests = (state.__loginRequests ??= new RequestLimit());
export function consumeLoginRequest(): boolean {
  return requests.consume();
}
