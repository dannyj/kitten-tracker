import { hash, verify } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";

// OWASP-recommended Argon2id parameters: 19 MiB memory, 2 iterations, 1 lane.
// Argon2id is the library default algorithm (the Algorithm const enum can't be
// imported under isolatedModules).
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

// Verified against when a username doesn't exist, so login takes the same time
// whether or not the user is real. Random value, can never match.
let dummyHash: Promise<string> | null = null;
export function getDummyPasswordHash(): Promise<string> {
  return (dummyHash ??= hash(randomUUID(), ARGON2_OPTIONS));
}
