"use client";

import { Cat, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/(app)/actions";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" className="w-full justify-start gap-3 px-3">
        <LogOut className="size-4" aria-hidden />
        Log out
      </Button>
    </form>
  );
}

export function AppShell({ username, children }: { username: string; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r p-4 md:flex">
        <div className="flex items-center gap-2 px-3 pb-4">
          <Cat className="size-5" aria-hidden />
          <span className="font-semibold">Kitten Tracker</span>
        </div>
        <AppNav />
        <div className="mt-auto">
          <Separator className="mb-2" />
          <p className="text-muted-foreground px-3 pb-2 text-xs">Signed in as {username}</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col md:pl-60">
        {/* Mobile top bar */}
        <header className="bg-background/95 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="p-0 pb-4 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <Cat className="size-5" aria-hidden />
                  Kitten Tracker
                </SheetTitle>
              </SheetHeader>
              <AppNav onNavigate={() => setMenuOpen(false)} />
              <div className="mt-6">
                <Separator className="mb-2" />
                <p className="text-muted-foreground px-3 pb-2 text-xs">Signed in as {username}</p>
                <LogoutButton />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <Cat className="size-5" aria-hidden />
            <span className="font-semibold">Kitten Tracker</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
