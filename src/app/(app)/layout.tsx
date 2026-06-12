import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getCurrentSession();
  if (!user) {
    redirect("/login");
  }

  return <AppShell username={user.username}>{children}</AppShell>;
}
