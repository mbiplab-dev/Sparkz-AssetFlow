"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { BellOff, CheckCheck, RefreshCw, type LucideIcon } from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from "date-fns";
import { toast } from "sonner";

import { AppIcon, DomainIcons, DomainTints, IconBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  listNotifications,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/api/dashboard";
import { useAsyncList } from "@/lib/hooks/useAsyncList";

type Filter = "all" | "maintenance" | "booking" | "allocation" | "overdue";

const SEEN_STORAGE_KEY = "assetflow.notifications.seenAt";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "maintenance", label: "Maintenance" },
  { value: "booking", label: "Booking" },
  { value: "allocation", label: "Allocation" },
  { value: "overdue", label: "Overdue" },
];

function readSeenAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function writeSeenAt(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEN_STORAGE_KEY, String(ts));
}

function kindMeta(kind: NotificationKind): {
  icon: LucideIcon;
  label: string;
  tint: string;
  bg: string;
} {
  if (kind.startsWith("maintenance")) {
    return {
      icon: DomainIcons.maintenance,
      label: "Maintenance",
      ...DomainTints.orange,
    };
  }
  if (kind.startsWith("booking")) {
    return {
      icon: DomainIcons.booking,
      label: "Booking",
      ...DomainTints.teal,
    };
  }
  if (kind === "overdue_return" || kind.startsWith("overdue")) {
    return {
      icon: DomainIcons.overdue,
      label: "Overdue",
      ...DomainTints.danger,
    };
  }
  if (kind === "asset_allocated" || kind.includes("transfer")) {
    return {
      icon: DomainIcons.allocation,
      label: "Allocation",
      ...DomainTints.sky,
    };
  }
  return {
    icon: DomainIcons.activity,
    label: "Activity",
    ...DomainTints.muted,
  };
}

function matchesFilter(kind: NotificationKind, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "maintenance") return kind.startsWith("maintenance");
  if (filter === "booking") return kind.startsWith("booking");
  if (filter === "allocation") {
    return kind === "asset_allocated" || kind.includes("transfer") || kind.includes("allocat");
  }
  if (filter === "overdue") return kind === "overdue_return" || kind.startsWith("overdue");
  return true;
}

function hrefFor(item: NotificationItem): string | null {
  switch (item.entity) {
    case "maintenance_request":
      return "/maintenance";
    case "booking":
      return "/booking";
    case "transfer":
    case "allocation_request":
    case "holding":
      return "/allocation";
    case "asset":
      return "/assets";
    case "audit_cycle":
      return "/audit";
    default:
      return null;
  }
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

function groupByDay(
  items: NotificationItem[],
): { label: string; key: string; items: NotificationItem[] }[] {
  const map = new Map<string, NotificationItem[]>();
  for (const item of items) {
    const key = startOfDay(new Date(item.timestamp)).toISOString();
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    label: dayLabel(groupItems[0]!.timestamp),
    items: groupItems,
  }));
}

export default function NotificationsPage() {
  const {
    data: items,
    loading,
    error,
    reload,
  } = useAsyncList<NotificationItem[]>(() => listNotifications(), []);

  const [filter, setFilter] = useState<Filter>("all");
  const [seenAt, setSeenAt] = useState(readSeenAt);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(
    () => items.filter((it) => matchesFilter(it.kind, filter)),
    [items, filter],
  );

  const unreadCount = useMemo(
    () => items.filter((it) => new Date(it.timestamp).getTime() > seenAt).length,
    [items, seenAt],
  );

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const filterCounts = useMemo(() => {
    const counts: Record<Filter, number> = {
      all: items.length,
      maintenance: 0,
      booking: 0,
      allocation: 0,
      overdue: 0,
    };
    for (const it of items) {
      if (matchesFilter(it.kind, "maintenance")) counts.maintenance += 1;
      if (matchesFilter(it.kind, "booking")) counts.booking += 1;
      if (matchesFilter(it.kind, "allocation")) counts.allocation += 1;
      if (matchesFilter(it.kind, "overdue")) counts.overdue += 1;
    }
    return counts;
  }, [items]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
    // useAsyncList keeps previous data; clear spinner after a short settle.
    window.setTimeout(() => setRefreshing(false), 400);
  }, [reload]);

  function markAllRead() {
    const now = Date.now();
    writeSeenAt(now);
    setSeenAt(now);
    toast.success("All notifications marked as read");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-ink-muted text-sm leading-relaxed">
            Operational alerts from maintenance, bookings, allocations, and overdue items.
          </p>
          {unreadCount > 0 ? (
            <p className="text-primary mt-1 text-xs font-medium">{unreadCount} unread</p>
          ) : (
            <p className="text-ink-faint mt-1 text-xs">You&apos;re all caught up</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-md"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh notifications"
          >
            <AppIcon
              icon={RefreshCw}
              className={cn("size-3.5", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-md"
            onClick={markAllRead}
            disabled={unreadCount === 0 || loading}
          >
            <AppIcon icon={CheckCheck} className="size-3.5" />
            Mark all read
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filter notifications"
        className="-mx-1 flex scrollbar-thin gap-1.5 overflow-x-auto px-1 pb-0.5"
      >
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          const count = filterCounts[value];
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-ink-secondary hover:bg-muted/80",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-ink-muted",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading notifications">
          {Array.from({ length: 3 }).map((_, g) => (
            <div key={g} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: 2 }).map((__, i) => (
                <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Couldn't load notifications"
          description={error}
          actionLabel="Try again"
          onAction={() => reload()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={DomainIcons.notifications}
          title={filter === "all" ? "No notifications yet" : `No ${filter} notifications`}
          description={
            filter === "all"
              ? "When maintenance, bookings, or allocations change, you'll see them here."
              : "Try another filter, or check back after more activity."
          }
          actionLabel={filter !== "all" ? "Show all" : undefined}
          onAction={filter !== "all" ? () => setFilter("all") : undefined}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`day-${group.key}`}>
              <h2
                id={`day-${group.key}`}
                className="text-ink-faint mb-2 text-[11px] font-semibold tracking-wide uppercase"
              >
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    unread={new Date(item.timestamp).getTime() > seenAt}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, unread }: { item: NotificationItem; unread: boolean }) {
  const meta = kindMeta(item.kind);
  const Icon = meta.icon;
  const overdue = item.is_overdue || item.kind === "overdue_return";
  const href = hrefFor(item);
  const time = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });
  const absolute = format(new Date(item.timestamp), "MMM d, yyyy · h:mm a");

  const content = (
    <>
      <IconBadge
        icon={Icon}
        size="lg"
        className="size-10"
        tint={overdue ? DomainTints.danger.tint : meta.tint}
        bg={overdue ? DomainTints.danger.bg : meta.bg}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {unread ? (
              <span
                className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                aria-label="Unread"
              />
            ) : null}
            <p
              className={cn(
                "truncate text-sm leading-snug",
                unread ? "text-ink font-semibold" : "text-ink-secondary font-medium",
              )}
            >
              {item.title}
            </p>
          </div>
          <time
            dateTime={item.timestamp}
            title={absolute}
            className="text-ink-faint shrink-0 pt-0.5 text-[11px] whitespace-nowrap tabular-nums"
          >
            {time}
          </time>
        </div>

        {item.body ? (
          <p className="text-ink-muted mt-0.5 line-clamp-2 text-sm leading-relaxed">{item.body}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
              overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-ink-muted",
            )}
          >
            {overdue ? "Overdue" : meta.label}
          </span>
          {item.actor_name ? (
            <span className="text-ink-faint text-xs">by {item.actor_name}</span>
          ) : null}
          {href ? (
            <span className="text-primary text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100">
              View →
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  const shellClass = cn(
    "group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
    overdue
      ? "border-destructive/30 bg-destructive/[0.04] hover:bg-destructive/[0.07]"
      : unread
        ? "border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06]"
        : "border-border bg-card hover:bg-muted/40",
  );

  if (href) {
    return (
      <li>
        <Link href={href} className={shellClass}>
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div className={shellClass}>{content}</div>
    </li>
  );
}
