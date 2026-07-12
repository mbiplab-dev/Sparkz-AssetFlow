"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AppIcon, DomainIcons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { can, type Capability } from "@/lib/auth/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional capability required to see the item. Undefined ⇒ everyone authenticated. */
  capability?: Capability;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DomainIcons.dashboard },
  {
    href: "/organization",
    label: "Organization setup",
    icon: DomainIcons.organization,
    capability: "org.manage",
  },
  { href: "/assets", label: "Assets", icon: DomainIcons.assets, capability: "assets.view" },
  { href: "/allocation", label: "Allocation & Transfer", icon: DomainIcons.allocation },
  {
    href: "/booking",
    label: "Resource Booking",
    icon: DomainIcons.booking,
    capability: "bookings.view",
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: DomainIcons.maintenance,
    capability: "maintenance.view",
  },
  {
    href: "/audit",
    label: "Audit",
    icon: DomainIcons.audit,
    capability: "audit.view",
  },
  { href: "/reports", label: "Reports", icon: DomainIcons.reports, capability: "reports.view" },
  {
    href: "/activity",
    label: "Activity Logs",
    icon: DomainIcons.activity,
    capability: "activity.view",
  },
  { href: "/notifications", label: "Notifications", icon: DomainIcons.notifications },
];

export function AppSidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="focus-visible:ring-ring flex shrink-0 items-center rounded-sm px-5 pt-5 pb-4 outline-none focus-visible:ring-2"
    >
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
    <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-3 py-2">
      {items.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "text-sidebar-foreground flex shrink-0 items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[14px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60",
            )}
          >
            <AppIcon
              icon={icon}
              className={cn(
                "size-[1.125rem]",
                active ? "text-primary" : "text-ink-muted",
              )}
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Desktop sidebar: full viewport height, never scrolls with page content.
 * Parent app shell is `h-dvh overflow-hidden`; only main content scrolls.
 */
export function AppSidebar() {
  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border hidden h-full w-60 shrink-0 flex-col",
        "overflow-hidden overscroll-none border-r md:flex",
      )}
    >
      <AppSidebarBrand />
      <AppSidebarNav />
    </aside>
  );
}
