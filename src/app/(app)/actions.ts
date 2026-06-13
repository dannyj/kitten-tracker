"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { deleteSessionCookie, getCurrentSession, invalidateSession } from "@/lib/auth/session";

export async function logout(): Promise<void> {
  const { session, user } = await getCurrentSession();
  if (session) {
    invalidateSession(session.id);
    audit("logout", { username: user?.username });
  }
  await deleteSessionCookie();
  redirect("/login");
}
