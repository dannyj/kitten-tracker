import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users, type Session, type User } from "@/db/schema";
import { SESSION_COOKIE_NAME } from "./cookie-name";

export { SESSION_COOKIE_NAME };

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEW_BEFORE_MS = 1000 * 60 * 60 * 24 * 15; // renew when < 15 days left

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set (>= 32 chars). See .env.example.");
  }
  return secret;
}

// The cookie holds a random token; the DB stores only its keyed hash, so a
// leaked database cannot be replayed as a session.
function hashToken(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createSession(token: string, userId: number): Session {
  const session: Session = {
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
  };
  db.insert(sessions).values(session).run();
  return session;
}

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };

export function validateSessionToken(token: string): SessionValidationResult {
  const sessionId = hashToken(token);
  const result = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();

  if (!result) {
    return { session: null, user: null };
  }
  const { session, user } = result;

  if (Date.now() >= session.expiresAt.getTime()) {
    db.delete(sessions).where(eq(sessions.id, session.id)).run();
    return { session: null, user: null };
  }

  if (session.expiresAt.getTime() - Date.now() < SESSION_RENEW_BEFORE_MS) {
    session.expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    db.update(sessions)
      .set({ expiresAt: session.expiresAt })
      .where(eq(sessions.id, session.id))
      .run();
  }

  return { session, user };
}

export function invalidateSession(sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Read + validate the session for the current request. Cached per request. */
export const getCurrentSession = cache(async (): Promise<SessionValidationResult> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return { session: null, user: null };
  }
  return validateSessionToken(token);
});
