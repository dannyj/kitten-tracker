import { requireUser } from "@/lib/auth/guard";

// Standalone (no app shell) so the print view is clean. Auth still required.
export default async function ExportLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="mx-auto max-w-3xl p-6 print:p-0">{children}</div>;
}
