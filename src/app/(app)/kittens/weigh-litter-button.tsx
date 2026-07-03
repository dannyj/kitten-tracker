"use client";

import { Scale } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type WeighableLitter = { id: number; label: string };

/**
 * Daily-driver action on the kittens list: weigh a whole litter at once. Sits on
 * its own row, away from the "+ Litter"/"+ Kitten" create buttons, so it's hard
 * to hit by accident. One litter → straight to its weigh-in; several → a picker.
 */
export function WeighLitterButton({ litters }: { litters: WeighableLitter[] }) {
  const [open, setOpen] = useState(false);

  if (litters.length === 0) return null;

  if (litters.length === 1) {
    // w-auto alone still stretches (flex-col parent); self-start makes it shrink-to-fit.
    return (
      <Button asChild size="lg" className="w-full sm:w-auto sm:self-start">
        <Link href={`/litters/${litters[0].id}/weigh`}>
          <Scale className="size-4" aria-hidden /> Weigh litter
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto sm:self-start">
          <Scale className="size-4" aria-hidden /> Weigh litter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Weigh which litter?</DialogTitle>
          <DialogDescription>
            Record a weight for every kitten in the litter on one screen.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {litters.map((l) => (
            <li key={l.id}>
              <Button asChild variant="outline" className="h-auto w-full justify-start py-2.5">
                <Link href={`/litters/${l.id}/weigh`} onClick={() => setOpen(false)}>
                  <Scale className="size-4 shrink-0" aria-hidden /> {l.label}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
