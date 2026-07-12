import Link from "next/link";
import { ArrowRight, Building2, LayoutGrid, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    label: "Departments",
    desc: "Create teams and assign heads",
    icon: Building2,
    tint: "text-accent-sky",
    bg: "bg-accent-sky/15",
  },
  {
    label: "Asset categories",
    desc: "Electronics, furniture, vehicles…",
    icon: LayoutGrid,
    tint: "text-accent-teal",
    bg: "bg-accent-teal/15",
  },
  {
    label: "Employee directory",
    desc: "Promote heads & asset managers",
    icon: Users,
    tint: "text-accent-purple-deep",
    bg: "bg-accent-purple/25",
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
          {STEPS.map(({ label, desc, icon: Icon, tint, bg }) => (
            <li key={label}>
              <Link
                href="/organization"
                className="group hover:bg-muted/70 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
              >
                <span
                  className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", bg)}
                >
                  <Icon className={cn("size-4", tint)} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ink-secondary text-sm font-medium">{label}</span>
                  <span className="text-ink-muted truncate text-xs">{desc}</span>
                </span>
                <ArrowRight className="text-ink-faint size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild className="self-start rounded-full">
          <Link href="/organization">
            Set up organization
            <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
