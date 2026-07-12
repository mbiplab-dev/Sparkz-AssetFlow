"use client";

import { useMemo, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

import { DiagnoseDialog } from "@/components/maintenance/DiagnoseDialog";
import { KanbanCard } from "@/components/maintenance/KanbanCard";
import { RaiseRequestDialog } from "@/components/maintenance/RaiseRequestDialog";
import { RejectDialog } from "@/components/maintenance/RejectDialog";
import { ResolveDialog } from "@/components/maintenance/ResolveDialog";
import { Button } from "@/components/ui/button";
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
import { useCan } from "@/lib/auth/permissions";
import { listAssets, type Asset } from "@/lib/api/assets";
import { ExportButton } from "@/components/ExportButton";
import {
  approveMaintenance,
  listMaintenanceRequests,
  startMaintenance,
  type MaintenancePriority,
  type MaintenanceRequest,
  type MaintenanceStatus,
} from "@/lib/api/maintenance";
import { useAsyncList } from "@/lib/hooks/useAsyncList";

const COLUMNS: { status: MaintenanceStatus; label: string; accent: string }[] = [
  { status: "pending", label: "Pending", accent: "border-t-accent-orange" },
  { status: "approved", label: "Approved", accent: "border-t-accent-sky" },
  { status: "in_progress", label: "In Progress", accent: "border-t-accent-orange" },
  { status: "resolved", label: "Resolved", accent: "border-t-accent-green" },
  { status: "rejected", label: "Rejected", accent: "border-t-accent-pink" },
];

export default function MaintenancePage() {
  const canManage = useCan("maintenance.approve");
  const canRaise = useCan("maintenance.raise");

  const [assetFilter, setAssetFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const {
    data: requests,
    loading,
    reload,
  } = useAsyncList<MaintenanceRequest[]>(
    () =>
      listMaintenanceRequests({
        asset: assetFilter || undefined,
        priority: (priorityFilter as MaintenancePriority) || undefined,
        starts_on: from || undefined,
        ends_on: to || undefined,
      }),
    [assetFilter, priorityFilter, from, to],
  );

  const { data: assets } = useAsyncList<Asset[]>(() => listAssets(), []);

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [diagnoseFor, setDiagnoseFor] = useState<MaintenanceRequest | null>(null);
  const [rejectFor, setRejectFor] = useState<MaintenanceRequest | null>(null);
  const [resolveFor, setResolveFor] = useState<MaintenanceRequest | null>(null);
  const [actionPending, setActionPending] = useState<number | null>(null);

  const counts = useMemo(() => {
    const c: Record<MaintenanceStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      cancelled: 0,
    };
    for (const r of requests) c[r.status]++;
    return c;
  }, [requests]);

  const grouped = useMemo(() => {
    const g: Record<MaintenanceStatus, MaintenanceRequest[]> = {
      pending: [],
      approved: [],
      rejected: [],
      assigned: [],
      in_progress: [],
      resolved: [],
      cancelled: [],
    };
    for (const r of requests) g[r.status].push(r);
    // Merge assigned into approved column for display (workflow: approved → assigned → in_progress)
    g.approved = [...g.approved, ...g.assigned];
    return g;
  }, [requests]);

  async function handleApprove(req: MaintenanceRequest) {
    setActionPending(req.id);
    try {
      await approveMaintenance(req.id);
      toast.success(`${req.asset_tag} approved`);
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve";
      toast.error(msg);
    } finally {
      setActionPending(null);
    }
  }

  async function handleStart(req: MaintenanceRequest) {
    setActionPending(req.id);
    try {
      await startMaintenance(req.id);
      toast.success(`${req.asset_tag} in progress`);
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start work";
      toast.error(msg);
    } finally {
      setActionPending(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
              <Wrench className="text-primary size-4" />
            </span>
            <h2 className="font-display text-ink text-2xl font-bold tracking-tight">Maintenance</h2>
          </div>
          <p className="text-ink-muted text-sm">
            Raise, approve, and resolve maintenance requests across the asset fleet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton resource="maintenance" />
          {canRaise ? (
            <Button onClick={() => setRaiseOpen(true)} className="rounded-full">
              <Plus />
              Raise Request
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {COLUMNS.map((col) => (
          <Card key={col.status} className={`border-t-4 p-4 shadow-none ${col.accent}`}>
            <div className="text-ink-muted text-xs font-medium">{col.label}</div>
            <div className="text-ink mt-1 text-2xl font-semibold">{counts[col.status]}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={assetFilter || "__all__"} onValueChange={(v) => setAssetFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All assets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All assets</SelectItem>
            {assets.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.asset_tag} · {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || "__all__"} onValueChange={(v) => setPriorityFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-ink-muted text-xs">From:</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-muted text-xs">To:</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.status} className="flex min-w-0 flex-col gap-3">
              <Card className={`border-t-4 px-3 py-2 shadow-none ${col.accent}`}>
                <div className="flex items-center justify-between">
                  <span className="text-ink text-sm font-semibold">{col.label}</span>
                  <span className="text-ink-muted bg-muted rounded-full px-2 py-0.5 text-xs">
                    {grouped[col.status].length}
                  </span>
                </div>
              </Card>
              <div className="flex flex-col gap-2">
                {grouped[col.status].length === 0 ? (
                  <p className="text-ink-faint py-6 text-center text-xs">No requests</p>
                ) : (
                  grouped[col.status].map((req) => (
                    <KanbanCard
                      key={req.id}
                      request={req}
                      canManage={canManage}
                      onDiagnose={setDiagnoseFor}
                      onApprove={handleApprove}
                      onReject={setRejectFor}
                      onStart={handleStart}
                      onResolve={setResolveFor}
                      actionPending={actionPending}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RaiseRequestDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        assets={assets}
        onCreated={() => {
          setRaiseOpen(false);
          reload();
        }}
      />
      <DiagnoseDialog
        request={diagnoseFor}
        open={diagnoseFor != null}
        onOpenChange={(v) => !v && setDiagnoseFor(null)}
      />
      <RejectDialog
        request={rejectFor}
        open={rejectFor != null}
        onOpenChange={(v) => !v && setRejectFor(null)}
        onRejected={() => {
          setRejectFor(null);
          reload();
        }}
      />
      <ResolveDialog
        request={resolveFor}
        open={resolveFor != null}
        onOpenChange={(v) => !v && setResolveFor(null)}
        onResolved={() => {
          setResolveFor(null);
          reload();
        }}
      />
    </div>
  );
}
