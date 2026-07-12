"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, MoreHorizontal, Package, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptySelectOptions } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/lib/auth/permissions";
import {
  allocateAsset,
  createAllocationRequest,
  listHoldings,
  listResourceAssets,
  listTransfers,
  returnAsset,
  type HolderType,
  type Holding,
  type ResourceAsset,
  type Transfer,
} from "@/lib/api/allocation";
import { ExportButton } from "@/components/ExportButton";
import { ApiError } from "@/lib/api/http";
import { useAsyncList } from "@/lib/hooks/useAsyncList";
import { listDepartments, listEmployees, type Department, type Employee } from "@/lib/api/organization";

type Bundle = {
  holdings: Holding[];
  assets: ResourceAsset[];
  transfers: Transfer[];
  departments: Department[];
  employees: Employee[];
};

const EMPTY_BUNDLE: Bundle = {
  holdings: [],
  assets: [],
  transfers: [],
  departments: [],
  employees: [],
};

const HOLDER_TYPE_LABEL: Record<HolderType, string> = {
  manager: "Manager Pool",
  department: "Department",
  employee: "Employee",
};

function holderName(
  holderType: HolderType,
  holderId: number,
  departments: Department[],
  employees: Employee[],
): string {
  if (holderType === "manager") return "Manager Pool";
  if (holderType === "department") {
    return departments.find((d) => d.id === holderId)?.name ?? `Department #${holderId}`;
  }
  const emp = employees.find((e) => e.id === holderId);
  return emp?.full_name ?? `Employee #${holderId}`;
}

/** Newest allocate/sub_allocate/fulfill/peer transfer INTO this holding — used as "allocated_at". */
function lastAllocatedAt(holding: Holding, transfers: Transfer[]): string | null {
  const match = transfers
    .filter(
      (t) =>
        t.asset === holding.asset &&
        t.to_holder_type === holding.holder_type &&
        t.to_holder_id === holding.holder_id &&
        t.kind !== "return",
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return match?.created_at ?? null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AllocationPage() {
  const { user } = useAuth();
  // Manager-only mutations (direct allocate out of the pool, initiate transfers).
  const canAllocate = useCan("assets.allocate");
  const canInitiateTransfer = useCan("transfers.initiate");
  const canInitiateReturn = useCan("returns.initiate");
  // TODO(rbac): when the allocation page grows an explicit approve/reject UI
  // for pending transfer and return requests, gate those controls on
  // `useCan("transfers.approve")` / `useCan("returns.approve")`. Right now the
  // page only surfaces holdings + a manager-driven initiate flow.
  // Department heads raise allocation *requests* for their team; asset managers
  // / admins allocate directly from the manager pool. Employees only initiate
  // returns/transfers — they do not allocate.
  const canRequestAllocation = user?.role === "department_head";
  const [search, setSearch] = useState("");
  const { data, loading, setData, reload } = useAsyncList<Bundle>(
    () =>
      Promise.all([
        listHoldings().catch(() => [] as Holding[]),
        listResourceAssets().catch(() => [] as ResourceAsset[]),
        listTransfers().catch(() => [] as Transfer[]),
        // Soft-fail so missing read perms never blank the whole allocation screen.
        listDepartments({ status: "active" }).catch(() => [] as Department[]),
        listEmployees({ status: "active" }).catch(() => [] as Employee[]),
      ]).then<Bundle>(([holdings, assets, transfers, departments, employees]) => ({
        holdings: Array.isArray(holdings) ? holdings : [],
        assets: Array.isArray(assets) ? assets : [],
        transfers: Array.isArray(transfers) ? transfers : [],
        departments: Array.isArray(departments) ? departments : [],
        employees: Array.isArray(employees) ? employees : [],
      })),
    [],
  );

  // useAsyncList's default seed is [] cast to T — normalize to the empty bundle.
  const bundle: Bundle = Array.isArray(data) ? EMPTY_BUNDLE : data;
  const { holdings, assets, transfers, departments, employees } = bundle;

  // `isManager` decides which backend endpoint to call (direct allocate vs
  // raise a request); the *visibility* of the button uses capability checks.
  const isManager = user?.role === "asset_manager" || user?.role === "admin";
  // Show the "Allocate / Request allocation" button to anyone who can either
  // allocate directly (admin/asset_manager) or file an allocation request
  // (department_head — per the product spec they book/allocate on behalf of
  // their department). Employees stay read-only for allocation.
  const showAllocateButton = canAllocate || canRequestAllocation;

  // Active allocations = any holding with quantity > 0 that isn't the manager pool.
  const activeHoldings = useMemo(
    () =>
      holdings.filter((h) => h.quantity > 0 && h.holder_type !== "manager"),
    [holdings],
  );

  const filteredHoldings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeHoldings;
    return activeHoldings.filter((h) => {
      const holder = holderName(h.holder_type, h.holder_id, departments, employees).toLowerCase();
      return h.asset_name.toLowerCase().includes(q) || holder.includes(q);
    });
  }, [activeHoldings, search, departments, employees]);

  // ── Allocate dialog ────────────────────────────────────────────────────
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateSaving, setAllocateSaving] = useState(false);
  const [allocateForm, setAllocateForm] = useState<{
    asset: string;
    to_holder_type: HolderType;
    to_holder_id: string;
    quantity: string;
  }>({ asset: "", to_holder_type: "employee", to_holder_id: "", quantity: "1" });

  function openAllocate() {
    setAllocateForm({ asset: "", to_holder_type: "employee", to_holder_id: "", quantity: "1" });
    setAllocateOpen(true);
  }

  async function handleAllocate() {
    if (!allocateForm.asset || !allocateForm.to_holder_id || !allocateForm.quantity) {
      toast.error("Please fill asset, holder, and quantity");
      return;
    }
    const qty = Number(allocateForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be a positive integer");
      return;
    }
    setAllocateSaving(true);
    try {
      if (isManager) {
        await allocateAsset({
          asset: Number(allocateForm.asset),
          to_holder_type: allocateForm.to_holder_type,
          to_holder_id: Number(allocateForm.to_holder_id),
          quantity: qty,
        });
      } else {
        // Non-managers can only request; the backend rejects direct allocate for them.
        await createAllocationRequest({
          asset: Number(allocateForm.asset),
          for_holder_type: allocateForm.to_holder_type,
          for_holder_id: Number(allocateForm.to_holder_id),
          quantity_requested: qty,
        });
      }
      toast.success(isManager ? "Asset allocated" : "Allocation request raised");
      setAllocateOpen(false);
      reload();
    } catch (err) {
      toast.error(isManager ? "Failed to allocate" : "Failed to raise request", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setAllocateSaving(false);
    }
  }

  // ── Return dialog ──────────────────────────────────────────────────────
  const [returnTarget, setReturnTarget] = useState<Holding | null>(null);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnForm, setReturnForm] = useState<{
    quantity: string;
    condition: string;
    notes: string;
  }>({ quantity: "1", condition: "good", notes: "" });

  function openReturn(h: Holding) {
    setReturnTarget(h);
    setReturnForm({ quantity: String(h.quantity), condition: "good", notes: "" });
  }

  async function handleReturn() {
    if (!returnTarget) return;
    const qty = Number(returnForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > returnTarget.quantity) {
      toast.error(`Quantity must be between 1 and ${returnTarget.quantity}`);
      return;
    }
    setReturnSaving(true);
    try {
      // Backend ReturnSerializer only accepts { asset, quantity }; condition/notes are
      // captured client-side for now (surfaced as toast context).
      await returnAsset({ asset: returnTarget.asset, quantity: qty });
      toast.success(
        `Returned ${qty} unit(s) of ${returnTarget.asset_name}`,
        returnForm.notes ? { description: returnForm.notes } : undefined,
      );
      setReturnTarget(null);
      reload();
    } catch (err) {
      toast.error("Failed to return asset", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setReturnSaving(false);
    }
  }

  // ── Transfer dialog ────────────────────────────────────────────────────
  const [transferTarget, setTransferTarget] = useState<Holding | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferForm, setTransferForm] = useState<{
    to_holder_type: HolderType;
    to_holder_id: string;
    quantity: string;
  }>({ to_holder_type: "employee", to_holder_id: "", quantity: "1" });

  function openTransfer(h: Holding) {
    setTransferTarget(h);
    setTransferForm({
      to_holder_type: "employee",
      to_holder_id: "",
      quantity: String(h.quantity),
    });
  }

  async function handleTransfer() {
    if (!transferTarget) return;
    const qty = Number(transferForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > transferTarget.quantity) {
      toast.error(`Quantity must be between 1 and ${transferTarget.quantity}`);
      return;
    }
    if (!transferForm.to_holder_id) {
      toast.error("Select a new holder");
      return;
    }
    setTransferSaving(true);
    try {
      // Direct transfers between arbitrary holders aren't exposed by the current
      // backend; we return to the manager pool first, then re-allocate. This works
      // when the acting user is an Asset Manager (the only role that can allocate
      // out of the manager pool). Requires 2 API calls, wrapped optimistically.
      await returnAsset({
        asset: transferTarget.asset,
        quantity: qty,
      });
      await allocateAsset({
        asset: transferTarget.asset,
        to_holder_type: transferForm.to_holder_type,
        to_holder_id: Number(transferForm.to_holder_id),
        quantity: qty,
      });
      toast.success("Transfer complete");
      setTransferTarget(null);
      reload();
    } catch (err) {
      toast.error("Failed to transfer", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setTransferSaving(false);
    }
  }

  // Wire-up for setData typing (useAsyncList seeds with []; we mutate through reload)
  // Keep this reference to avoid the "unused import" lint if we later swap in
  // optimistic updates without a full reload.
  void setData;

  const isEmployee = user?.role === "employee";

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="bg-accent-sky/15 flex size-9 items-center justify-center rounded-xl">
            <ArrowLeftRight className="text-accent-sky size-4" />
          </span>
          <h1 className="text-ink text-xl font-semibold">
            {isEmployee ? "My allocations" : "Allocation & Transfer"}
          </h1>
        </div>
        <p className="text-ink-muted text-sm">
          {isEmployee
            ? "Assets currently assigned to you. Return items when you no longer need them, or raise maintenance if something is broken."
            : "Track current holdings, allocate assets to employees or departments, and process returns."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search asset or holder…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton resource="holdings" />
          {showAllocateButton && (
            <Button onClick={openAllocate} className="rounded-full">
              <Plus />
              {canAllocate ? "Allocate asset" : "Request allocation"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredHoldings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="bg-accent-sky/15 flex size-11 items-center justify-center rounded-xl">
                <Package className="text-accent-sky size-5" />
              </span>
              <p className="text-ink-secondary text-sm font-medium">
                {isEmployee ? "No assets allocated to you" : "No current holdings"}
              </p>
              <p className="text-ink-muted max-w-sm text-sm">
                {activeHoldings.length === 0
                  ? isEmployee
                    ? "When an asset manager allocates equipment to you, it will appear here so you can return it when finished."
                    : "Nothing has been allocated yet. Allocate an asset or create assets first."
                  : "No holdings match your search."}
              </p>
              {showAllocateButton && activeHoldings.length === 0 && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={openAllocate} variant="outline" className="rounded-full">
                    <Plus />
                    {canAllocate ? "Allocate asset" : "Request allocation"}
                  </Button>
                  <Button asChild variant="ghost" className="rounded-full">
                    <a href="/assets">Go to Assets</a>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Asset</TableHead>
                  <TableHead>Holder</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Allocated</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHoldings.map((h) => {
                  const allocatedAt = lastAllocatedAt(h, transfers);
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="pl-4 font-medium text-ink">{h.asset_name}</TableCell>
                      <TableCell className="text-ink">
                        {holderName(h.holder_type, h.holder_id, departments, employees)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {HOLDER_TYPE_LABEL[h.holder_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{h.quantity}</TableCell>
                      <TableCell className="text-ink-muted text-sm">
                        {formatDate(allocatedAt)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {(canInitiateReturn || canInitiateTransfer) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canInitiateReturn && (
                                <DropdownMenuItem onSelect={() => openReturn(h)}>
                                  <RotateCcw />
                                  Return
                                </DropdownMenuItem>
                              )}
                              {/*
                                TODO(rbac): employees + department heads have
                                `transfers.initiate` in the capability matrix,
                                but the current implementation executes the
                                transfer as return + re-allocate, which needs
                                asset-manager rights. Restrict the button to
                                `isManager` until a proper transfer-request
                                endpoint lands and this UI can raise a request
                                for non-managers.
                              */}
                              {canInitiateTransfer && isManager && (
                                <>
                                  {canInitiateReturn && <DropdownMenuSeparator />}
                                  <DropdownMenuItem onSelect={() => openTransfer(h)}>
                                    <ArrowLeftRight />
                                    Initiate transfer
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Allocate dialog ───────────────────────────────────────────── */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isManager ? "Allocate asset" : "Request allocation"}</DialogTitle>
            <DialogDescription>
              {isManager
                ? "Push quantity from the manager pool to a department or employee."
                : "Raise a request for the Asset Manager or a peer Department Head to fulfill."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Asset</label>
              <Select
                value={allocateForm.asset}
                onValueChange={(v) => setAllocateForm((f) => ({ ...f, asset: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {assets.length === 0 ? (
                    <EmptySelectOptions
                      title="No assets found"
                      description="Register assets before allocating them."
                      actionHref="/assets"
                      actionLabel="Create assets →"
                    />
                  ) : (
                    // Managers/admins get the full resource pool (synced from
                    // the main asset directory on list). Show available stock.
                    [...assets]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((a) => {
                        const avail =
                          typeof a.available_quantity === "number"
                            ? a.available_quantity
                            : a.total_quantity;
                        return (
                          <SelectItem key={a.id} value={String(a.id)}>
                            <span className="font-medium">{a.name}</span>
                            <span className="text-ink-faint ml-2 text-xs">
                              {a.category_name}
                              {typeof avail === "number" ? ` · avail ${avail}` : ""}
                            </span>
                          </SelectItem>
                        );
                      })
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Holder type</label>
              <Select
                value={allocateForm.to_holder_type}
                onValueChange={(v) =>
                  setAllocateForm((f) => ({ ...f, to_holder_type: v as HolderType, to_holder_id: "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">
                {allocateForm.to_holder_type === "employee" ? "Employee" : "Department"}
              </label>
              <Select
                value={allocateForm.to_holder_id}
                onValueChange={(v) => setAllocateForm((f) => ({ ...f, to_holder_id: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      allocateForm.to_holder_type === "employee"
                        ? "Select employee"
                        : "Select department"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {allocateForm.to_holder_type === "employee" ? (
                    employees.length === 0 ? (
                      <EmptySelectOptions
                        title="No employees found"
                        description="People appear after they sign up."
                      />
                    ) : (
                      employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.full_name}
                          {e.department_name && (
                            <span className="text-ink-faint ml-2 text-xs">
                              · {e.department_name}
                            </span>
                          )}
                        </SelectItem>
                      ))
                    )
                  ) : departments.length === 0 ? (
                    <EmptySelectOptions
                      title="No departments found"
                      description="Create departments in Organization setup."
                      actionHref="/organization"
                      actionLabel="Create a department →"
                    />
                  ) : (
                    departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min={1}
                value={allocateForm.quantity}
                onChange={(e) =>
                  setAllocateForm((f) => ({ ...f, quantity: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateOpen(false)} disabled={allocateSaving}>
              Cancel
            </Button>
            <Button onClick={handleAllocate} disabled={allocateSaving} className="rounded-full">
              {allocateSaving
                ? "Working…"
                : isManager
                  ? "Allocate"
                  : "Raise request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Return dialog ─────────────────────────────────────────────── */}
      <Dialog open={returnTarget !== null} onOpenChange={(o) => !o && setReturnTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return {returnTarget?.asset_name}</DialogTitle>
            <DialogDescription>
              Return quantity from{" "}
              {returnTarget
                ? holderName(
                    returnTarget.holder_type,
                    returnTarget.holder_id,
                    departments,
                    employees,
                  )
                : ""}{" "}
              to the manager pool.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">
                Quantity (holding: {returnTarget?.quantity ?? 0})
              </label>
              <Input
                type="number"
                min={1}
                max={returnTarget?.quantity ?? 1}
                value={returnForm.quantity}
                onChange={(e) => setReturnForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Condition</label>
              <Select
                value={returnForm.condition}
                onValueChange={(v) => setReturnForm((f) => ({ ...f, condition: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Notes (optional)</label>
              <Textarea
                rows={3}
                value={returnForm.notes}
                onChange={(e) => setReturnForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anything the Asset Manager should know"
              />
              <p className="text-ink-faint text-xs">
                Condition and notes are logged in the toast; the current backend accepts only
                quantity on <code>/return/</code>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)} disabled={returnSaving}>
              Cancel
            </Button>
            <Button onClick={handleReturn} disabled={returnSaving} className="rounded-full">
              {returnSaving ? "Returning…" : "Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transfer dialog ───────────────────────────────────────────── */}
      <Dialog open={transferTarget !== null} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer {transferTarget?.asset_name}</DialogTitle>
            <DialogDescription>
              Move quantity from{" "}
              {transferTarget
                ? holderName(
                    transferTarget.holder_type,
                    transferTarget.holder_id,
                    departments,
                    employees,
                  )
                : ""}{" "}
              to a new holder. Executed as a return + re-allocate.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">New holder type</label>
              <Select
                value={transferForm.to_holder_type}
                onValueChange={(v) =>
                  setTransferForm((f) => ({
                    ...f,
                    to_holder_type: v as HolderType,
                    to_holder_id: "",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">
                {transferForm.to_holder_type === "employee" ? "New employee" : "New department"}
              </label>
              <Select
                value={transferForm.to_holder_id}
                onValueChange={(v) =>
                  setTransferForm((f) => ({ ...f, to_holder_id: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select new holder" />
                </SelectTrigger>
                <SelectContent>
                  {transferForm.to_holder_type === "employee"
                    ? (() => {
                        const list = employees.filter(
                          (e) =>
                            !(
                              transferTarget?.holder_type === "employee" &&
                              transferTarget.holder_id === e.id
                            ),
                        );
                        if (list.length === 0) {
                          return (
                            <EmptySelectOptions
                              title="No other employees"
                              description="No eligible employees to transfer to."
                            />
                          );
                        }
                        return list.map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {e.full_name}
                          </SelectItem>
                        ));
                      })()
                    : (() => {
                        const list = departments.filter(
                          (d) =>
                            !(
                              transferTarget?.holder_type === "department" &&
                              transferTarget.holder_id === d.id
                            ),
                        );
                        if (list.length === 0) {
                          return (
                            <EmptySelectOptions
                              title="No other departments"
                              description="No eligible departments to transfer to."
                              actionHref="/organization"
                              actionLabel="Create a department →"
                            />
                          );
                        }
                        return list.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ));
                      })()}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">
                Quantity (max {transferTarget?.quantity ?? 0})
              </label>
              <Input
                type="number"
                min={1}
                max={transferTarget?.quantity ?? 1}
                value={transferForm.quantity}
                onChange={(e) =>
                  setTransferForm((f) => ({ ...f, quantity: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferTarget(null)}
              disabled={transferSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={transferSaving} className="rounded-full">
              {transferSaving ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
