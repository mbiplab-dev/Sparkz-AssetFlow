import Link from "next/link";
import { ArrowRight, CalendarClock, Package, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  {
    label: "My assets",
    desc: "Assets allocated to you",
    href: "/assets",
    icon: Package,
    tint: "text-accent-sky",
    bg: "bg-accent-sky/15",
  },
  {
    label: "My bookings",
    desc: "Shared resources you booked",
    href: "/booking",
    icon: CalendarClock,
    tint: "text-accent-teal",
    bg: "bg-accent-teal/15",
  },
  {
    label: "My maintenance requests",
    desc: "Repairs you raised",
    href: "/maintenance",
    icon: Wrench,
    tint: "text-accent-orange",
    bg: "bg-accent-orange/15",
  },
];

export function MyAssetsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-base font-semibold">Your workspace</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-ink-muted mb-3 text-sm">
          Quick access to the assets, bookings, and requests tied to you.
        </p>
        {SHORTCUTS.map(({ label, desc, href, icon: Icon, tint, bg }) => (
          <Link
            key={label}
            href={href}
            className="group hover:bg-muted/70 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
          >
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", bg)}>
              <Icon className={cn("size-4", tint)} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-ink-secondary text-sm font-medium">{label}</span>
              <span className="text-ink-muted truncate text-xs">{desc}</span>
            </span>
            <ArrowRight className="text-ink-faint size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
