import "server-only";

import { redirect } from "next/navigation";
import { getCurrentSession } from "./session";
import type { User } from "@/db/schema";

/** Every server action and protected page loader goes through one of these. */
export async function requireUser(): Promise<User> {
  const { user } = await getCurrentSession();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Admin role required");
  }
  return user;
}
