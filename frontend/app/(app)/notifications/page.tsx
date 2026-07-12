"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlarmClock, CalendarClock, Package, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import {
  listNotifications,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/api/dashboard";

type Filter = "all" | "maintenance" | "booking" | "allocation" | "overdue";

function iconFor(kind: NotificationKind): LucideIcon {
  if (kind.startsWith("maintenance")) return Wrench;
  if (kind.startsWith("booking")) return CalendarClock;
  if (kind.startsWith("asset")) return Package;
  if (kind.startsWith("overdue")) return AlarmClock;
  return Package;
}

function matchesFilter(kind: NotificationKind, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "maintenance") return kind.startsWith("maintenance");
  if (filter === "booking") return kind.startsWith("booking");
  if (filter === "allocation") return kind === "asset_allocated";
  if (filter === "overdue") return kind === "overdue_return";
  return true;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [lastSeenAt] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    listNotifications()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load notifications.";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => items.filter((it) => matchesFilter(it.kind, filter)),
    [items, filter],
  );

  const unreadCount = useMemo(
    () => items.filter((it) => new Date(it.timestamp).getTime() > lastSeenAt).length,
    [items, lastSeenAt],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl leading-tight font-medium">
            Notifications & Activity Log
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            A live feed of maintenance, bookings, and allocations across your organization.
          </p>
        </div>
        <span className="bg-primary/10 text-primary inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium">
          Unread {unreadCount}
        </span>
      </header>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Filter</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="booking">Booking</SelectItem>
            <SelectItem value="allocation">Allocation</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-xl border border-dashed text-sm">
          No activity yet
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => {
            const Icon = iconFor(item.kind);
            const overdue = item.is_overdue || item.kind === "overdue_return";
            return (
              <Card
                key={item.id}
                size="sm"
                className={cn(
                  "flex-row items-start gap-3 px-4 py-3",
                  overdue && "border-destructive/40 bg-destructive/5",
                )}
              >
                <div
                  className={cn(
                    "bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg",
                    overdue && "bg-destructive/10 text-destructive",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{item.title}</p>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDistanceToNow(new Date(item.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {item.body ? (
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{item.body}</p>
                  ) : null}
                  {item.actor_name ? (
                    <p className="text-muted-foreground/80 mt-1 text-xs">by {item.actor_name}</p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
