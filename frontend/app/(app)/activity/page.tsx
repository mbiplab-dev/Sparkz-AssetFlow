"use client";

import { useEffect, useState } from "react";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import { activityIcon } from "@/components/dashboard/activityIcon";
import { RoleGate } from "@/components/rbac/RoleGate";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listActivityLogs, type ActivityLog } from "@/lib/api/activity";
import { useAsyncList } from "@/lib/hooks/useAsyncList";
import { cn } from "@/lib/utils";

const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All actions" },
  { value: "asset", label: "Assets" },
  { value: "booking", label: "Bookings" },
  { value: "maintenance", label: "Maintenance" },
  { value: "allocation", label: "Allocation" },
  { value: "audit", label: "Audit" },
  { value: "user", label: "Users" },
];

function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ActivityPage() {
  return (
    <RoleGate
      capability="activity.view"
      title="You don't have access to activity logs"
      description="Activity logs are available to signed-in users. Contact an administrator if this looks wrong."
    >
      <ActivityPageContent />
    </RoleGate>
  );
}

function ActivityPageContent() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const {
    data: logs,
    loading,
    error,
    reload,
  } = useAsyncList<ActivityLog[]>(
    () =>
      listActivityLogs({
        action: actionFilter === "all" ? undefined : actionFilter,
        search: debouncedSearch || undefined,
      }),
    [actionFilter, debouncedSearch],
  );

  const hasFilters = actionFilter !== "all" || debouncedSearch.length > 0;

  function handleRefresh() {
    setRefreshing(true);
    reload();
    window.setTimeout(() => setRefreshing(false), 400);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-ink-muted text-sm leading-relaxed">
            Immutable audit trail of who did what and when across AssetFlow.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-md sm:w-auto"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message, action, or actor…"
            className="pl-9"
            aria-label="Search activity logs"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by action">
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
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error && logs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Couldn't load activity"
          description={error}
          actionLabel="Try again"
          onAction={() => reload()}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? "No matching activity" : "No activity yet"}
          description={
            hasFilters
              ? "Try a different search or clear the action filter."
              : "Actions like allocations, bookings, and role changes will appear here."
          }
          actionLabel={hasFilters ? "Clear filters" : undefined}
          onAction={
            hasFilters
              ? () => {
                  setSearch("");
                  setActionFilter("all");
                }
              : undefined
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {logs.map((log) => (
              <ActivityCard key={log.id} log={log} />
            ))}
          </ul>

          <div className="border-border bg-card hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Event</TableHead>
                  <TableHead className="w-40">Actor</TableHead>
                  <TableHead className="w-36">Action</TableHead>
                  <TableHead className="w-40 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const { icon: Icon, tint, bg } = activityIcon(`${log.action} ${log.message}`);
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <span
                          className={cn("flex size-8 items-center justify-center rounded-lg", bg)}
                        >
                          <Icon className={cn("size-3.5", tint)} />
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-ink-secondary max-w-xl text-sm leading-snug">
                          {log.message || humanizeAction(log.action)}
                        </p>
                        {log.entity_type ? (
                          <p className="text-ink-faint mt-0.5 text-xs">
                            {log.entity_type}
                            {log.entity_id ? ` #${log.entity_id}` : ""}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <p className="text-ink-secondary truncate text-sm">
                          {log.actor_name || "System"}
                        </p>
                        {log.actor_email ? (
                          <p className="text-ink-faint truncate text-xs">{log.actor_email}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="bg-muted text-ink-muted inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium">
                          {humanizeAction(log.action)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <time
                          dateTime={log.created_at}
                          title={format(new Date(log.created_at), "PPpp")}
                          className="text-ink-muted text-xs tabular-nums"
                        >
                          {formatDistanceToNow(new Date(log.created_at), {
                            addSuffix: true,
                          })}
                        </time>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-ink-faint text-center text-xs sm:text-left">
            Showing {logs.length} entr{logs.length === 1 ? "y" : "ies"}
          </p>
        </>
      )}
    </div>
  );
}

function ActivityCard({ log }: { log: ActivityLog }) {
  const { icon: Icon, tint, bg } = activityIcon(`${log.action} ${log.message}`);
  return (
    <li className="border-border bg-card flex items-start gap-3 rounded-xl border px-3.5 py-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", bg)}>
        <Icon className={cn("size-3.5", tint)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ink-secondary text-sm leading-snug">
          {log.message || humanizeAction(log.action)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-ink-muted text-xs">{log.actor_name || "System"}</span>
          <span className="text-ink-faint text-xs">·</span>
          <time dateTime={log.created_at} className="text-ink-faint text-xs tabular-nums">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </time>
        </div>
        <span className="bg-muted text-ink-muted mt-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium">
          {humanizeAction(log.action)}
        </span>
      </div>
    </li>
  );
}
