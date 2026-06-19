import { CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { getViewingItems, groupViewingsByTime } from "@/lib/viewing-data";
import { ViewingList } from "./viewing-list";

export const metadata = { title: "Viewings — Kitten Tracker" };

export default async function ViewingsPage() {
  await requireUser();
  const items = getViewingItems();
  const { upcoming, past } = groupViewingsByTime(items);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Viewings</h1>
        <Button asChild variant="outline">
          <Link href="/viewings/new">
            <Plus className="size-4" aria-hidden /> New viewing
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <CalendarDays className="text-muted-foreground size-7" aria-hidden />
          <p className="font-medium">No viewings yet</p>
          <p className="text-muted-foreground text-sm">
            Book a viewing from here, or from an interested party or kitten.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Upcoming</h2>
            {upcoming.length > 0 ? (
              <ViewingList items={upcoming} />
            ) : (
              <p className="text-muted-foreground text-sm">Nothing booked ahead.</p>
            )}
          </section>
          {past.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Past</h2>
              <ViewingList items={past} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
