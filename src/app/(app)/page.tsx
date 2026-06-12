import { Cat } from "lucide-react";

export const metadata = { title: "Dashboard — Kitten Tracker" };

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
          <Cat className="text-muted-foreground size-7" aria-hidden />
        </div>
        <p className="font-medium">No kittens yet</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Once kittens are added, their weights, feeding countdowns and alerts will show up here.
        </p>
      </div>
    </div>
  );
}
