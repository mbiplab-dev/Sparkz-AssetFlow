"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Lock, MapPin, Users } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DISCREPANCY_KIND_LABELS,
  scopeLabel,
  type AuditCycle,
  type AuditDiscrepancy,
  type AuditItem,
  type AuditVerdict,
  type DiscrepancyKind,
} from "@/lib/api/audits";
import { cn } from "@/lib/utils";

/** Non-pending verdicts the API accepts. */
const SETTABLE_VERDICTS: Exclude<AuditVerdict, "pending">[] = ["verified", "missing", "damaged"];

const KIND_TINT: Record<DiscrepancyKind, string> = {
  missing: "border-destructive/25 bg-destructive/5",
  damaged: "border-accent-orange/30 bg-accent-orange/5",
};

type Props = {
  cycle: AuditCycle | null;
  items: AuditItem[];
  discrepancies: AuditDiscrepancy[];
  itemsLoading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create / close cycle / resolve discrepancies / manage auditors. */
  canManage: boolean;
  /** Record item verdicts (managers or assigned auditors while open). */
  canAuditItems?: boolean;
  busy?: boolean;
  onUpdateVerdict: (
    itemId: number,
    verdict: Exclude<AuditVerdict, "pending">,
    notes?: string,
  ) => void;
  onClose: (cycleId: number) => void;
  onResolveDiscrepancy?: (discrepancyId: number) => void;
};

export function CycleDetailSheet({
  cycle,
  items,
  discrepancies,
  itemsLoading,
  open,
  onOpenChange,
  canManage,
  canAuditItems,
  busy,
  onUpdateVerdict,
  onClose,
  onResolveDiscrepancy,
}: Props) {
  const progress = useMemo(() => {
    if (items.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = items.filter((i) => i.verdict !== "pending").length;
    const total = items.length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }, [items]);

  if (!cycle) return null;

  const locked = cycle.status === "closed";
  const canEditItems = (canAuditItems ?? canManage) && cycle.status === "open";

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
                {cycle.closed_by_name ? ` · Closed by ${cycle.closed_by_name}` : ""}
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
          <div className="border-border bg-card mb-4 rounded-xl border p-4">
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
              {cycle.status === "open" && (
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
                  Cycle locked. Confirmed-missing assets were marked <strong>lost</strong>; damaged
                  assets had condition set to <strong>damaged</strong>.
                </p>
              )}
            </div>
          )}

          <Tabs defaultValue="items" className="min-h-0 flex-1">
            <TabsList variant="line" className="mb-3 w-full justify-start">
              <TabsTrigger value="items">
                <ClipboardList className="size-3.5" />
                Items
                <span className="text-ink-faint ml-1 text-xs tabular-nums">{items.length}</span>
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
              {itemsLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="text-ink-muted border-border rounded-xl border border-dashed px-4 py-10 text-center text-sm">
                  No assets in scope for this cycle. Adjust department/location when creating the
                  next cycle.
                </p>
              ) : (
                <div className="border-border overflow-hidden rounded-xl border">
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
                      {items.map((row) => (
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
                                value={row.verdict === "pending" ? undefined : row.verdict}
                                onValueChange={(v) =>
                                  onUpdateVerdict(
                                    row.id,
                                    v as Exclude<AuditVerdict, "pending">,
                                    row.notes,
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 w-[128px] rounded-xs text-xs">
                                  <SelectValue placeholder="Set verdict…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SETTABLE_VERDICTS.map((v) => (
                                    <SelectItem key={v} value={v}>
                                      {v.charAt(0).toUpperCase() + v.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <VerdictBadge verdict={row.verdict} />
                            )}
                          </TableCell>
                          <TableCell className="hidden align-top sm:table-cell">
                            {canEditItems && row.verdict !== "pending" ? (
                              <Textarea
                                defaultValue={row.notes}
                                key={`${row.id}-${row.verdict}-${row.verified_at ?? ""}`}
                                onBlur={(e) => {
                                  const next = e.target.value;
                                  if (next === row.notes) return;
                                  onUpdateVerdict(
                                    row.id,
                                    row.verdict as Exclude<AuditVerdict, "pending">,
                                    next,
                                  );
                                }}
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
                Auto-created when a verdict is missing or damaged. Managers can mark resolved
                independently of the cycle status.
              </p>
              {discrepancies.length === 0 ? (
                <div className="text-ink-muted border-border bg-card flex items-center gap-2 rounded-xl border px-4 py-8 text-sm">
                  <CheckCircle2 className="text-accent-green size-4 shrink-0" />
                  No discrepancies. Verified items produce no rows.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {discrepancies.map((d) => (
                    <li
                      key={d.id}
                      className={cn("rounded-xl border px-3 py-2.5", KIND_TINT[d.kind])}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-medium">
                            {d.asset_tag}{" "}
                            <span className="text-ink-muted font-normal">· {d.asset_name}</span>
                          </p>
                          <p className="text-ink-muted mt-0.5 text-xs">{d.detail || "—"}</p>
                          {d.resolved && (
                            <p className="text-ink-faint mt-1 text-xs">
                              Resolved
                              {d.resolved_by_name ? ` by ${d.resolved_by_name}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="border-border bg-card text-ink-secondary inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium">
                            {DISCREPANCY_KIND_LABELS[d.kind]}
                          </span>
                          {canManage && !d.resolved && onResolveDiscrepancy && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full text-xs"
                              disabled={busy}
                              onClick={() => onResolveDiscrepancy(d.id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="auditors" className="mt-0">
              {cycle.auditors.length === 0 ? (
                <p className="text-ink-muted border-border rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                  No auditors assigned.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cycle.auditors.map((a) => (
                    <li
                      key={a.id}
                      className="border-border bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5"
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
                        <p className="text-ink-faint text-xs">Employee · id {a.id}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
