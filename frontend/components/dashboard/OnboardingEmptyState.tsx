import Link from "next/link";
import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import { AppIcon, DomainIcons, IconBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/auth/authApi";

const CTA: Record<
  UserRole,
  { title: string; desc: string; cta: string; href: string; icon: LucideIcon }
> = {
  admin: {
    title: "Set up your organization",
    desc: "Start by creating departments, asset categories, and your employee directory. Everything else builds on this master data.",
    cta: "Open organization setup",
    href: "/organization",
    icon: DomainIcons.organization,
  },
  asset_manager: {
    title: "Register your first asset",
    desc: "Add an asset to start tracking it through its lifecycle — allocation, booking, maintenance, and audit.",
    cta: "Register an asset",
    href: "/assets",
    icon: DomainIcons.assetsRegister,
  },
  department_head: {
    title: "Get your team moving",
    desc: "View assets allocated to your department, approve requests, or book a shared resource on the team's behalf.",
    cta: "Browse assets",
    href: "/assets",
    icon: DomainIcons.assets,
  },
  employee: {
    title: "Explore your workspace",
    desc: "Browse assets, reserve a shared resource, or raise a maintenance request — your operational tools are ready.",
    cta: "Book a resource",
    href: "/booking",
    icon: DomainIcons.booking,
  },
};

export function OnboardingEmptyState({ role }: { role: UserRole }) {
  const { title, desc, cta, href, icon } = CTA[role];

  return (
    <div className="bg-card animate-in fade-in zoom-in-95 fill-mode-both ring-foreground/10 rounded-xl p-5 ring-1 duration-500 ease-out sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <IconBadge
          icon={Sparkles}
          size="lg"
          className="size-12"
          tint="text-accent-sky"
          bg="bg-accent-sky/15"
          iconClassName="size-6"
        />
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-ink text-lg font-semibold sm:text-xl">{title}</h2>
          <p className="text-ink-muted mx-auto max-w-md text-sm leading-relaxed">{desc}</p>
        </div>
        <Button asChild className="mt-1 rounded-full">
          <Link href={href}>
            <AppIcon icon={icon} />
            {cta}
            <AppIcon icon={ArrowRight} />
          </Link>
        </Button>
      </div>
    </div>
  );
}
