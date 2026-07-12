import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { AppIcon, IconBadge } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

export type KpiCardSpec = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  tint: string;
  bg: string;
};

export function KpiCard({ spec, value }: { spec: KpiCardSpec; value: number | null }) {
  const { label, href, icon, tint, bg } = spec;

  return (
    <Link href={href} className="group block min-w-0 focus-visible:outline-none">
      <Card
        className={cn(
          "hover:ring-foreground/20 h-full gap-2 py-3 transition-all duration-200 ease-out hover:-translate-y-0.5 sm:py-5",
          "group-focus-visible:ring-ring group-focus-visible:ring-2",
        )}
      >
        <CardContent className="flex flex-col gap-2 sm:gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-ink-muted line-clamp-2 text-xs font-medium sm:text-sm">
              {label}
            </span>
            <IconBadge
              icon={icon}
              tint={tint}
              bg={bg}
              size="sm"
              className="sm:size-8 sm:rounded-lg"
              iconClassName="sm:size-4"
            />
          </div>

          <div className="flex items-end justify-between gap-2">
            {value === null ? (
              <Skeleton className="h-8 w-12 sm:h-9 sm:w-14" />
            ) : (
              <AnimatedNumber
                value={value}
                className="font-display text-ink text-2xl font-bold tracking-tight sm:text-3xl"
              />
            )}
            <AppIcon
              icon={ArrowUpRight}
              className={cn(
                "size-4 shrink-0 translate-y-1 opacity-0 transition-all duration-200 ease-out",
                "text-ink-faint group-hover:translate-y-0 group-hover:opacity-100",
              )}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
