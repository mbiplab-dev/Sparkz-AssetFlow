import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { AppIcon, DomainIcons, DomainTints, IconBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    label: "Departments",
    desc: "Create teams and assign heads",
    icon: DomainIcons.organization,
    ...DomainTints.sky,
  },
  {
    label: "Asset categories",
    desc: "Electronics, furniture, vehicles…",
    icon: LayoutGrid,
    ...DomainTints.teal,
  },
  {
    label: "Employee directory",
    desc: "Promote heads & asset managers",
    icon: DomainIcons.people,
    ...DomainTints.purple,
  },
];

export function OrgSetupCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-base font-semibold">Organization setup</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-ink-muted text-sm">
          Everything else depends on this master data. Set up the building blocks your teams will
          use.
        </p>
        <ul className="flex flex-col gap-1">
          {STEPS.map(({ label, desc, icon, tint, bg }) => (
            <li key={label}>
              <Link
                href="/organization"
                className="group hover:bg-muted/70 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
              >
                <IconBadge icon={icon} tint={tint} bg={bg} size="sm" className="size-8" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ink-secondary text-sm font-medium">{label}</span>
                  <span className="text-ink-muted truncate text-xs">{desc}</span>
                </span>
                <AppIcon
                  icon={ArrowRight}
                  className="text-ink-faint size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild className="w-full self-start rounded-full sm:w-auto">
          <Link href="/organization">
            Set up organization
            <AppIcon icon={ArrowRight} />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
