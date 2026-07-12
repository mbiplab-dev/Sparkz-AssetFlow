import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";
import { activityIcon } from "./activityIcon";

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  const empty = items.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base font-semibold">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <span className="bg-muted flex size-9 items-center justify-center rounded-full">
              <Inbox className="text-ink-faint size-5" />
            </span>
            <p className="text-ink-secondary text-sm font-medium">No activity yet</p>
            <p className="text-ink-muted text-sm">
              Allocations, bookings, and maintenance events will appear here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => {
              const { icon: Icon, tint, bg } = activityIcon(item.message);
              return (
                <li
                  key={item.id}
                  className="border-border flex items-start gap-2.5 border-b py-2.5 last:border-b-0 sm:items-center sm:gap-3"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md sm:mt-0",
                      bg,
                    )}
                  >
                    <Icon className={cn("size-3.5", tint)} />
                  </span>
                  <span className="text-ink-secondary min-w-0 flex-1 text-sm sm:truncate">
                    {item.message}
                  </span>
                  <span className="text-ink-faint shrink-0 text-xs tabular-nums">
                    {relativeTime(item.timestamp)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/activity"
          className="group text-primary hover:bg-muted/70 mt-3 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors"
        >
          View activity logs
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
