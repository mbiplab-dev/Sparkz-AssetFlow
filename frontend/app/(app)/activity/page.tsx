"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/components/rbac/RoleGate";
import { listActivityLogs, type ActivityLog } from "@/lib/api/activity";
import { ApiError } from "@/lib/api/http";
import { useCan } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const ACTION_FILTERS = [
  { value: "all", label: "All actions" },
  { value: "user", label: "Users / roles" },
  { value: "allocation", label: "Allocations" },
  { value: "booking", label: "Bookings" },
  { value: "maintenance", label: "Maintenance" },
] as const;

export default function ActivityPage() {
  const canViewAll = useCan("activity.view_all");
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    // Loading flips only inside async callbacks (avoids set-state-in-effect lint).
    listActivityLogs({
      search: search || undefined,
      action: actionFilter === "all" ? undefined : actionFilter,
    })
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : "Failed to load activity logs.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, actionFilter]);

  const subtitle = useMemo(
    () =>
      canViewAll
        ? "Full organization audit trail — who did what, when."
        : "Your personal action history.",
    [canViewAll],
  );

  return (
    <RoleGate
      capability="activity.view"
      title="Activity logs unavailable"
      description="You need an active account to view activity history."
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-ink text-xl font-semibold sm:text-2xl">
            Activity Logs
          </h1>
          <p className="text-ink-muted text-sm">{subtitle}</p>
        </header>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative min-w-0">
            <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search message, action, or actor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
            <ClipboardList className="text-ink-faint size-8" />
            <p className="text-ink-secondary text-sm font-medium">No activity yet</p>
            <p className="text-ink-muted max-w-sm text-xs">
              Role changes, allocations, bookings, and maintenance transitions will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <Card key={item.id} size="sm" className="flex-row items-start gap-3 px-4 py-3">
                <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <ClipboardList className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-ink text-sm font-medium">{item.message}</p>
                    <span className="text-ink-faint shrink-0 text-xs tabular-nums">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-ink-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className={cn("font-mono")}>{item.action}</span>
                    {item.actor_name && <span>by {item.actor_name}</span>}
                    {item.entity_type && (
                      <span>
                        {item.entity_type}
                        {item.entity_id ? `#${item.entity_id}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleGate>
  );
}
