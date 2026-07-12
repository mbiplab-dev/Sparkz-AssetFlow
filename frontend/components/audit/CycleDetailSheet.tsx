"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Lock,
  MapPin,
  Users,
} from "lucide-react";
import { CycleStatusBadge } from "@/components/audit/CycleStatusBadge";
import { VerdictBadge } from "@/components/audit/VerdictBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  discrepanciesFromCycle,
  scopeLabel,
  DISCREPANCY_KIND_LABELS,
  type AuditCycle,
  type AuditVerdict,
  type DiscrepancyKind,
} from "@/lib/api/audits";
import { cn } from "@/lib/utils";

const VERDICTS: AuditVerdict[] = ["pending", "verified", "missing", "damaged"];

const KIND_TINT: Record<DiscrepancyKind, string> = {
  missing: "border-destructive/25 bg-destructive/5",
  damaged: "border-accent-orange/30 bg-accent-orange/5",
  wrong_location: "border-accent-sky/30 bg-accent-sky/5",
};

type Props = {
  cycle: AuditCycle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  busy?: boolean;
  onUpdateVerdict: (itemId: string, verdict: AuditVerdict, notes?: string) => void;
  onStart: (cycleId: string) => void;
  onClose: (cycleId: string) => void;
};

export function CycleDetailSheet({
  cycle,
  open,
  onOpenChange,
  canManage,
  busy,
  onUpdateVerdict,
  onStart,
  onClose,
}: Props) {
  const discrepancies = useMemo(
    () => (cycle ? discrepanciesFromCycle(cycle) : []),
    [cycle],
  );

  const progress = useMemo(() => {
    if (!cycle || cycle.items.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = cycle.items.filter((i) => i.verdict !== "pending").length;
    const total = cycle.items.length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }, [cycle]);

  if (!cycle) return null;

  const locked = cycle.status === "closed";
  const canEditItems = canManage && cycle.status === "in_progress";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-border shrink-0 space-y-2 border-b px-5 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <CycleStatusBadge status={cycle.status} />
            <span className="text-ink-faint text-xs">
              {cycle.starts_on} → {cycle.ends_on}
            </span>
          </div>
          <SheetTitle className="font-display text-ink text-xl font-bold tracking-tight">
            {cycle.name}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="text-ink-muted flex flex-col gap-1.5 text-sm">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                {scopeLabel(cycle)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5 shrink-0" />
                {cycle.auditors.map((a) => a.full_name).join(", ") || "No auditors"}
              </span>
              <span className="text-ink-faint text-xs">
                Created by {cycle.created_by_name}
                {cycle.closed_by_name
                  ? ` · Closed by ${cycle.closed_by_name}`
                  : ""}
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
          <div className="border-border mb-4 rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-ink font-medium">Verification progress</span>
              <span className="text-ink-muted tabular-nums">
                {progress.done}/{progress.total} · {progress.pct}%
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>

          {canManage && (
            <div className="mb-4 flex flex-wrap gap-2">
              {cycle.status === "draft" && (
                <Button
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => onStart(cycle.id)}
                >
                  Start cycle
                </Button>
              )}
              {cycle.status === "in_progress" && (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => onClose(cycle.id)}
                  disabled={busy || (progress.total > 0 && progress.done < progress.total)}
                >
                  <Lock className="size-3.5" />
                  Close cycle
                </Button>
              )}
              {locked && (
                <p className="text-ink-muted text-xs leading-relaxed">
                  Cycle locked. Confirmed-missing assets → <strong>lost</strong>; damaged items keep
                  condition updates (schema close invariant — demo only).
                </p>
              )}
            </div>
          )}

          <Tabs defaultValue="items" className="min-h-0 flex-1">
            <TabsList variant="line" className="mb-3 w-full justify-start">
              <TabsTrigger value="items">
                <ClipboardList className="size-3.5" />
                Items
                <span className="text-ink-faint ml-1 text-xs tabular-nums">
                  {cycle.items.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="discrepancies">
                <AlertTriangle className="size-3.5" />
                Discrepancies
                <span className="text-ink-faint ml-1 text-xs tabular-nums">
                  {discrepancies.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="auditors">
                <Users className="size-3.5" />
                Auditors
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="mt-0">
              {cycle.items.length === 0 ? (
                <p className="text-ink-muted rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm">
                  No <code className="text-xs">audit_items</code> yet. Starting the cycle snapshots
                  assets in scope.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-canvas-soft hover:bg-canvas-soft">
                        <TableHead className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                          Asset
                        </TableHead>
                        <TableHead className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                          Verdict
                        </TableHead>
                        <TableHead className="text-ink-muted hidden text-xs font-semibold tracking-wide uppercase sm:table-cell">
                          Notes
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycle.items.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-ink text-sm font-medium">{row.asset_tag}</span>
                              <span className="text-ink-muted text-xs">{row.asset_name}</span>
                              {row.expected_location_name && (
                                <span className="text-ink-faint text-xs">
                                  Exp: {row.expected_location_name}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            {canEditItems ? (
                              <Select
                                value={row.verdict}
                                onValueChange={(v) =>
                                  onUpdateVerdict(row.id, v as AuditVerdict)
                                }
                              >
                                <SelectTrigger className="h-8 w-[128px] rounded-xs text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VERDICTS.map((v) => (
                                    <SelectItem key={v} value={v}>
                                      {v === "pending"
                                        ? "Pending"
                                        : v.charAt(0).toUpperCase() + v.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <VerdictBadge verdict={row.verdict} />
                            )}
                          </TableCell>
                          <TableCell className="hidden align-top sm:table-cell">
                            {canEditItems ? (
                              <Textarea
                                value={row.notes}
                                onChange={(e) =>
                                  onUpdateVerdict(row.id, row.verdict, e.target.value)
                                }
                                placeholder="Optional notes"
                                className="min-h-8 resize-none rounded-xs text-xs"
                                rows={1}
                              />
                            ) : (
                              <span className="text-ink-muted text-xs">{row.notes || "—"}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="discrepancies" className="mt-0">
              <p className="text-ink-muted mb-3 text-xs">
                Auto-generated when verdict is not verified (
                <code className="text-[11px]">audit_discrepancies</code>
                ). Kinds: missing · damaged · wrong_location.
              </p>
              {discrepancies.length === 0 ? (
                <div className="text-ink-muted flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-8 text-sm">
                  <CheckCircle2 className="text-accent-green size-4 shrink-0" />
                  No discrepancies. Verified items produce no rows.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {discrepancies.map((d) => (
                    <li
                      key={d.id}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        KIND_TINT[d.kind],
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-ink text-sm font-medium">
                            {d.asset_tag}{" "}
                            <span className="text-ink-muted font-normal">· {d.asset_name}</span>
                          </p>
                          <p className="text-ink-muted mt-0.5 text-xs">{d.detail}</p>
                          {d.resolved && (
                            <p className="text-ink-faint mt-1 text-xs">
                              Resolved
                              {d.resolved_by_name ? ` by ${d.resolved_by_name}` : ""}
                            </p>
                          )}
                        </div>
                        <span className="border-border bg-card text-ink-secondary inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium">
                          {DISCREPANCY_KIND_LABELS[d.kind]}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="auditors" className="mt-0">
              <ul className="flex flex-col gap-2">
                {cycle.auditors.map((a) => (
                  <li
                    key={a.id}
                    className="border-border flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5"
                  >
                    <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-semibold">
                      {a.full_name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-ink text-sm font-medium">{a.full_name}</p>
                      <p className="text-ink-faint text-xs">auditor_id · {a.id}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
