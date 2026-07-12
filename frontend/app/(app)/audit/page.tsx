"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  CreateCycleDialog,
  type CreateCycleFormInput,
} from "@/components/audit/CreateCycleDialog";
import { CycleDetailSheet } from "@/components/audit/CycleDetailSheet";
import { CycleStatusBadge } from "@/components/audit/CycleStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useAuth } from "@/context/AuthContext";
import {
  closeAuditCycle,
  createAuditCycle,
  discrepanciesFromCycle,
  isAuditApiLocal,
  listAuditCycles,
  scopeLabel,
  startAuditCycle,
  updateAuditItemVerdict,
  type AuditCycle,
  type AuditCycleStatus,
  type AuditVerdict,
} from "@/lib/api/audits";
import { useCan } from "@/lib/auth/permissions";
import { useAsyncList } from "@/lib/hooks/useAsyncList";
import { cn } from "@/lib/utils";

/**
 * Asset Audit UI. All data goes through `@/lib/api/audits` — never mock modules.
 * When the backend is ready, only that API file changes.
 */
export default function AuditPage() {
  const { user } = useAuth();
  const canManage = useCan("audit.manage");

  const {
    data: cycles,
    loading,
    error,
    reload,
  } = useAsyncList<AuditCycle[]>((signal) => listAuditCycles(signal), []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AuditCycleStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const selected = useMemo(
    () => (cycles ?? []).find((c) => c.id === selectedId) ?? null,
    [cycles, selectedId],
  );

  const filtered = useMemo(() => {
    const list = cycles ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        c.name,
        c.scope_dept_name,
        c.scope_loc_name,
        ...c.auditors.map((a) => a.full_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cycles, search, statusFilter]);

  const stats = useMemo(() => {
    let active = 0;
    let pendingItems = 0;
    let openDiscrepancies = 0;
    let closed = 0;
    for (const c of cycles ?? []) {
      if (c.status === "in_progress") active++;
      if (c.status === "closed") closed++;
      if (c.status !== "closed") {
        pendingItems += c.items.filter((i) => i.verdict === "pending").length;
        openDiscrepancies += discrepanciesFromCycle(c).filter((d) => !d.resolved).length;
      }
    }
    return { active, pendingItems, openDiscrepancies, closed };
  }, [cycles]);

  function actor() {
    return {
      id: String(user?.id ?? "local"),
      name: user?.full_name || user?.email || "You",
    };
  }

  async function handleCreate(input: CreateCycleFormInput) {
    setActionPending(true);
    try {
      const created = await createAuditCycle(input, actor());
      toast.success("Draft cycle created");
      setSelectedId(created.id);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create cycle");
    } finally {
      setActionPending(false);
    }
  }

  async function handleStart(cycleId: string) {
    setActionPending(true);
    try {
      await startAuditCycle(cycleId);
      toast.success("Cycle started");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start cycle");
    } finally {
      setActionPending(false);
    }
  }

  async function handleClose(cycleId: string) {
    setActionPending(true);
    try {
      await closeAuditCycle(cycleId, actor());
      toast.success("Cycle closed");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close cycle");
    } finally {
      setActionPending(false);
    }
  }

  async function handleUpdateVerdict(itemId: string, verdict: AuditVerdict, notes?: string) {
    if (!selectedId) return;
    try {
      await updateAuditItemVerdict(selectedId, itemId, verdict, notes, actor());
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
              <ClipboardCheck className="text-primary size-5" />
            </span>
            <h2 className="font-display text-ink text-xl font-bold tracking-tight sm:text-2xl">
              Asset Audit
            </h2>
          </div>
          <p className="text-ink-muted max-w-2xl text-sm">
            Structured verification cycles: scope department/location, assign auditors, mark each
            asset verified / missing / damaged, auto-build discrepancy reports, then close the
            cycle.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={actionPending}
            className="w-full shrink-0 rounded-full sm:w-auto"
          >
            <Plus />
            New cycle
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Active cycles" value={stats.active} icon={ClipboardList} tint="primary" />
        <StatCard label="Items pending" value={stats.pendingItems} icon={Search} tint="sky" />
        <StatCard
          label="Open discrepancies"
          value={stats.openDiscrepancies}
          icon={AlertTriangle}
          tint="orange"
          emphasize={stats.openDiscrepancies > 0}
        />
        <StatCard label="Closed cycles" value={stats.closed} icon={CheckCircle2} tint="green" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 sm:col-span-2 lg:min-w-[16rem] lg:flex-1">
          <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cycles, scope, or auditors…"
            className="w-full rounded-xs pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "all" | AuditCycleStatus)}
        >
          <SelectTrigger className="w-full rounded-xs lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-canvas-soft/80 hover:bg-canvas-soft/80">
                    <TableHead className="text-ink-muted pl-4 text-xs font-semibold tracking-wide uppercase">
                      Cycle
                    </TableHead>
                    <TableHead className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                      Scope
                    </TableHead>
                    <TableHead className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                      Window
                    </TableHead>
                    <TableHead className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                      Status
                    </TableHead>
                    <TableHead className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                      Progress
                    </TableHead>
                    <TableHead className="text-ink-muted pr-4 text-xs font-semibold tracking-wide uppercase">
                      Flags
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-36 text-center">
                        <div className="flex flex-col items-center gap-2 py-6">
                          <span className="bg-primary/10 flex size-11 items-center justify-center rounded-xl">
                            <ClipboardCheck className="text-primary size-5" />
                          </span>
                          <p className="text-ink-secondary text-sm font-medium">No cycles found</p>
                          <p className="text-ink-muted max-w-sm text-sm">
                            {canManage
                              ? "Create a draft cycle scoped by department or location to begin."
                              : "No cycles match your filters."}
                          </p>
                          {canManage && (
                            <Button
                              variant="outline"
                              className="mt-1 rounded-full"
                              onClick={() => setCreateOpen(true)}
                            >
                              <Plus />
                              New cycle
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((cycle) => {
                      const done = cycle.items.filter((i) => i.verdict !== "pending").length;
                      const total = cycle.items.length;
                      const disc = discrepanciesFromCycle(cycle).length;
                      return (
                        <TableRow
                          key={cycle.id}
                          className="hover:bg-muted/40 cursor-pointer"
                          onClick={() => setSelectedId(cycle.id)}
                        >
                          <TableCell className="pl-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-ink text-sm font-medium">{cycle.name}</span>
                              <span className="text-ink-faint text-xs">
                                {cycle.auditors.length} auditor
                                {cycle.auditors.length === 1 ? "" : "s"} · {cycle.created_by_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-ink-muted text-sm">
                            {scopeLabel(cycle)}
                          </TableCell>
                          <TableCell className="text-ink-muted whitespace-nowrap text-sm">
                            {cycle.starts_on} → {cycle.ends_on}
                          </TableCell>
                          <TableCell>
                            <CycleStatusBadge status={cycle.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-[104px] flex-col gap-1">
                              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    cycle.status === "closed" ? "bg-accent-green" : "bg-primary",
                                  )}
                                  style={{
                                    width:
                                      total === 0
                                        ? "0%"
                                        : `${Math.round((done / total) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-ink-faint text-xs tabular-nums">
                                {total === 0 ? "No items" : `${done}/${total}`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="pr-4">
                            {disc > 0 ? (
                              <span className="text-accent-orange inline-flex items-center gap-1 text-xs font-medium">
                                <AlertTriangle className="size-3.5" />
                                {disc}
                              </span>
                            ) : (
                              <span className="text-ink-faint text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!canManage && (
        <p className="text-ink-muted text-center text-xs">
          View only. Creating, starting, and closing cycles requires Asset Manager or Admin.
        </p>
      )}

      {isAuditApiLocal() && (
        <p className="text-ink-faint text-center text-[11px]">
          Using local audit data stand-in (`lib/api/audits.ts` → USE_LOCAL_AUDIT_API). Flip that flag
          when the backend is ready — UI stays the same.
        </p>
      )}

      <CreateCycleDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />

      <CycleDetailSheet
        cycle={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        canManage={canManage}
        busy={actionPending}
        onUpdateVerdict={handleUpdateVerdict}
        onStart={handleStart}
        onClose={handleClose}
      />
    </div>
  );
}

const TINT: Record<string, { bg: string; icon: string }> = {
  primary: { bg: "bg-primary/10", icon: "text-primary" },
  sky: { bg: "bg-accent-sky/15", icon: "text-accent-sky" },
  orange: { bg: "bg-accent-orange/15", icon: "text-accent-orange" },
  green: { bg: "bg-accent-green/15", icon: "text-accent-green" },
};

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  emphasize,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tint: keyof typeof TINT;
  emphasize?: boolean;
}) {
  const t = TINT[tint];
  return (
    <Card className={cn("py-0 transition-shadow", emphasize && "ring-accent-orange/25 ring-1")}>
      <CardContent className="flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0">
          <p className="text-ink-muted text-xs font-medium sm:text-sm">{label}</p>
          <p className="font-display text-ink mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9",
            t.bg,
          )}
        >
          <Icon className={cn("size-4", t.icon)} />
        </span>
      </CardContent>
    </Card>
  );
}
