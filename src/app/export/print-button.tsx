"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Print
    </Button>
  );
}
