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
import { can, type Capability } from "@/lib/auth/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Optional capability required to see the item. Undefined ⇒ everyone. */
  capability?: Capability;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/organization",
    label: "Organization setup",
    icon: Building2,
    capability: "org.manage",
  },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/allocation", label: "Allocation & Transfer", icon: ArrowLeftRight },
  { href: "/booking", label: "Resource Booking", icon: CalendarClock },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/audit", label: "Audit", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: BarChart3, capability: "reports.view" },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function AppSidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-5 pt-5 pb-4"
    >
      <span className="bg-primary text-primary-foreground font-display flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold">
        AF
      </span>
      <span className="font-display text-ink text-[17px] font-semibold tracking-tight">
        AssetFlow
      </span>
    </Link>
  );
}

export function AppSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = NAV_ITEMS.filter((item) => !item.capability || can(user, item.capability));

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-hidden px-3 py-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "text-sidebar-foreground flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[15px] font-medium transition-colors sm:py-1.5",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-ink-muted")} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Persistent desktop sidebar (hidden below md). */
export function AppSidebar() {
  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 flex-col border-r md:flex">
      <AppSidebarBrand />
      <AppSidebarNav />
    </aside>
  );
}
