import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
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
  const { label, href, icon: Icon, tint, bg } = spec;

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card
        className={cn(
          "hover:ring-foreground/20 gap-2 py-5 transition-all duration-200 ease-out hover:-translate-y-0.5",
          "group-focus-visible:ring-ring group-focus-visible:ring-2",
        )}
      >
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted text-sm font-medium">{label}</span>
            <span className={cn("flex size-7 items-center justify-center rounded-md", bg)}>
              <Icon className={cn("size-4", tint)} />
            </span>
          </div>

          <div className="flex items-end justify-between">
            {value === null ? (
              <Skeleton className="h-9 w-14" />
            ) : (
              <AnimatedNumber
                value={value}
                className="font-display text-ink text-3xl font-bold tracking-tight"
              />
            )}
            <ArrowUpRight
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
