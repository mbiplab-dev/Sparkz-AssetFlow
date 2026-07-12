import Link from "next/link";
import { ArrowRight, Building2, CalendarPlus, Package, PackagePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/authApi";

const CTA: Record<
  UserRole,
  { title: string; desc: string; cta: string; href: string; icon: typeof Package }
> = {
  admin: {
    title: "Set up your organization",
    desc: "Start by creating departments, asset categories, and your employee directory. Everything else builds on this master data.",
    cta: "Open organization setup",
    href: "/organization",
    icon: Building2,
  },
  asset_manager: {
    title: "Register your first asset",
    desc: "Add an asset to start tracking it through its lifecycle — allocation, booking, maintenance, and audit.",
    cta: "Register an asset",
    href: "/assets",
    icon: PackagePlus,
  },
  department_head: {
    title: "Get your team moving",
    desc: "View assets allocated to your department, approve requests, or book a shared resource on the team's behalf.",
    cta: "Browse assets",
    href: "/assets",
    icon: Package,
  },
  employee: {
    title: "Explore your workspace",
    desc: "Browse assets, reserve a shared resource, or raise a maintenance request — your operational tools are ready.",
    cta: "Book a resource",
    href: "/booking",
    icon: CalendarPlus,
  },
};

export function OnboardingEmptyState({ role }: { role: UserRole }) {
  const { title, desc, cta, href, icon: Icon } = CTA[role];

  return (
    <div className="bg-card animate-in fade-in zoom-in-95 fill-mode-both ring-foreground/10 rounded-xl p-5 ring-1 duration-500 ease-out sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-accent-sky/15 flex size-12 items-center justify-center rounded-xl">
          <Sparkles className="text-accent-sky size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-ink text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </h3>
          <p className="text-ink-muted mx-auto max-w-md text-sm">{desc}</p>
        </div>
        <Button asChild className={cn("mt-1 w-full rounded-full sm:w-auto")}>
          <Link href={href}>
            <Icon />
            {cta}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
