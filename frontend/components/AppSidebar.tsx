"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organization", label: "Organization setup", icon: Building2, adminOnly: true },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/allocation", label: "Allocation & Transfer", icon: ArrowLeftRight },
  { href: "/booking", label: "Resource Booking", icon: CalendarClock },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/audit", label: "Audit", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = NAV_ITEMS.filter((item) => !("adminOnly" in item) || user?.role === "admin");

  return (
    <aside className="bg-sidebar border-sidebar-border flex w-60 shrink-0 flex-col border-r">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <span className="bg-primary text-primary-foreground font-display flex size-7 items-center justify-center rounded-md text-sm font-bold">
          AF
        </span>
        <span className="font-display text-ink text-[17px] font-semibold tracking-tight">
          AssetFlow
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "text-sidebar-foreground flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[15px] font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary" : "text-ink-muted")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
