"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit, auditLoginRejection } from "@/lib/audit";
import { getDummyPasswordHash, verifyPassword } from "@/lib/auth/password";
import { acquireLoginAttempt, consumeLoginRequest } from "@/lib/auth/rate-limit";
import { createSession, generateSessionToken, setSessionCookie } from "@/lib/auth/session";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginState = { error: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!consumeLoginRequest()) {
    auditLoginRejection();
    return { error: "Too many requests. Try again in one minute." };
  }
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a username and password." };
  }

  // Neither NPM nor direct Tailscale headers prove the socket peer identity.
  const ip = null;
  const { username, password } = parsed.data;

  const release = acquireLoginAttempt(username);
  if (!release) {
    auditLoginRejection();
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  try {
    const user = db.select().from(users).where(eq(users.username, username)).get();

    let validPassword = false;
    if (user) {
      validPassword = await verifyPassword(user.passwordHash, password);
    } else {
      // Burn the same hashing time for unknown usernames (no timing oracle).
      await verifyPassword(await getDummyPasswordHash(), password);
    }

    if (!user || !validPassword) {
      audit("login.failure", { username, ip });
      return { error: "Invalid username or password." };
    }

    audit("login.success", { username: user.username, ip });
    const token = generateSessionToken();
    const session = createSession(token, user.id);
    await setSessionCookie(token, session.expiresAt);
    redirect("/");
  } finally {
    release();
  }
}
