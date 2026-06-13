"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void): () => void {
  const timer = setInterval(onTick, 30_000);
  return () => clearInterval(timer);
}

// 30s buckets keep getSnapshot stable between ticks (required by
// useSyncExternalStore) while the value still advances for edit-window checks.
function getSnapshot(): number {
  return Math.floor(Date.now() / 30_000) * 30_000;
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Current time in ms, bucketed to 30s. Returns null until mounted (server and
 * first client paint), so time-dependent UI (edit windows) stays off until
 * hydration. Render stays pure — no Date.now() in the component body.
 */
export function useNow(): number | null {
  const t = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return t === 0 ? null : t;
}
