"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARTY_STATUSES } from "@/db/schema";
import { PARTY_STATUS_LABELS } from "@/lib/parties";

export function PartyFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "default") params.delete("status");
    else params.set("status", value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        defaultValue={searchParams.get("status") ?? "default"}
        onValueChange={setParam}
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Active (default)</SelectItem>
          <SelectItem value="all">All statuses</SelectItem>
          {PARTY_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {PARTY_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
