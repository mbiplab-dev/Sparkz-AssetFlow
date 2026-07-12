"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { AppSidebarBrand, AppSidebarNav } from "@/components/AppSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/auth/authApi";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  asset_manager: "Asset Manager",
  department_head: "Department Head",
  employee: "Employee",
};

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function AppHeader({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <header className="border-border bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="font-display text-ink truncate text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Badge
            variant="secondary"
            className="border-hairline text-ink-secondary hidden border sm:inline-flex"
          >
            <span className="max-w-[10rem] truncate lg:max-w-none">{ROLE_LABELS[user.role]}</span>
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-accent-sky/20 text-ink text-xs font-semibold">
                  {initialsOf(user.full_name)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="truncate text-sm font-medium">{user.full_name}</span>
                  <span className="text-muted-foreground truncate text-xs font-normal">
                    {user.email}
                  </span>
                  <span className="text-muted-foreground mt-1 text-xs font-normal sm:hidden">
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleLogout}
                disabled={isLoggingOut}
                variant="destructive"
              >
                <LogOut />
                {isLoggingOut ? "Logging out..." : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar w-[min(18rem,85vw)] gap-0 p-0 sm:max-w-xs"
          showCloseButton
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Primary app navigation</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <AppSidebarBrand onNavigate={() => setMobileNavOpen(false)} />
            <AppSidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
