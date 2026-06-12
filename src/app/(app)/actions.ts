"use server";

import { redirect } from "next/navigation";
import { deleteSessionCookie, getCurrentSession, invalidateSession } from "@/lib/auth/session";

export async function logout(): Promise<void> {
  const { session } = await getCurrentSession();
  if (session) {
    invalidateSession(session.id);
  }
  await deleteSessionCookie();
  redirect("/login");
}
