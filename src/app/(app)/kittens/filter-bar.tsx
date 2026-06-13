"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KITTEN_STATUSES } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/status";

export function FilterBar({ litterOptions }: { litterOptions: { id: number; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "default") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        defaultValue={searchParams.get("status") ?? "default"}
        onValueChange={(value) => setParam("status", value)}
      >
        <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Active (default)</SelectItem>
          <SelectItem value="all">All statuses</SelectItem>
          {KITTEN_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        defaultValue={searchParams.get("litter") ?? "default"}
        onValueChange={(value) => setParam("litter", value)}
      >
        <SelectTrigger className="w-full sm:w-64" aria-label="Filter by litter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">All litters</SelectItem>
          {litterOptions.map((litter) => (
            <SelectItem key={litter.id} value={String(litter.id)}>
              {litter.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
