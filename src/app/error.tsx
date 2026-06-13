"use client";

import { Button } from "@/components/ui/button";

// In production Next strips the message/stack from errors crossing to the
// client (only a digest remains), so nothing internal leaks here.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          An unexpected error occurred. Please try again.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
