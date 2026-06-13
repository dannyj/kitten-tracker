"use client";

import { Cat, Milk } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertBadge } from "@/components/alert-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AlertResult } from "@/lib/alerts";
import type { KittenStatus } from "@/db/schema";

export type KittenRowView = {
  id: number;
  name: string;
  handFeeding: boolean;
  coverPhotoId: number | null;
  shelterNumber: string | null;
  sexLabel: string;
  ageText: string;
  status: KittenStatus;
  alert: AlertResult | null;
};

export function KittensTable({ rows }: { rows: KittenRowView[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Shelter #</TableHead>
            <TableHead className="hidden sm:table-cell">Sex</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((kitten) => {
            const open = () => router.push(`/kittens/${kitten.id}`);
            return (
              // Whole row is one hit target — click/tap anywhere opens the kitten.
              <TableRow
                key={kitten.id}
                role="link"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
                className="hover:bg-muted/50 cursor-pointer"
              >
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {kitten.coverPhotoId ? (
                      <Image
                        src={`/api/photos/${kitten.coverPhotoId}?thumb=1`}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
                        <Cat className="text-muted-foreground size-5" aria-hidden />
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 font-medium">
                      {kitten.name}
                      {kitten.handFeeding ? (
                        <Milk
                          className="size-3.5 shrink-0 text-sky-600"
                          aria-label="Hand-feeding"
                        />
                      ) : null}
                    </span>
                    {kitten.alert ? <AlertBadge result={kitten.alert} /> : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {kitten.shelterNumber ?? "—"}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{kitten.sexLabel}</TableCell>
                <TableCell>{kitten.ageText}</TableCell>
                <TableCell>
                  <StatusBadge status={kitten.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
