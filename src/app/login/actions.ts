"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getDummyPasswordHash, verifyPassword } from "@/lib/auth/password";
import { consumeLoginAttempt, resetLoginAttempts } from "@/lib/auth/rate-limit";
import { createSession, generateSessionToken, setSessionCookie } from "@/lib/auth/session";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginState = { error: string } | null;

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  // Behind Nginx Proxy Manager the client address arrives in X-Forwarded-For.
  const forwarded = headerStore.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a username and password." };
  }

  const ip = await clientIp();
  if (!consumeLoginAttempt(ip)) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  const { username, password } = parsed.data;
  const user = db.select().from(users).where(eq(users.username, username)).get();

  let validPassword = false;
  if (user) {
    validPassword = await verifyPassword(user.passwordHash, password);
  } else {
    // Burn the same hashing time for unknown usernames (no timing oracle).
    await verifyPassword(await getDummyPasswordHash(), password);
  }

  if (!user || !validPassword) {
    return { error: "Invalid username or password." };
  }

  resetLoginAttempts(ip);
  const token = generateSessionToken();
  const session = createSession(token, user.id);
  await setSessionCookie(token, session.expiresAt);
  redirect("/");
}
