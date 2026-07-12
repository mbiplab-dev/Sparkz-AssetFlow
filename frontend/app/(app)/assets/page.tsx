"use client";

import { useState } from "react";
import { MoreHorizontal, Package, PackagePlus, Search } from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ApiError } from "@/lib/api/http";
import { useAsyncList } from "@/lib/hooks/useAsyncList";
import {
  ASSET_STATUS_LABELS,
  createAsset,
  listAssets,
  listCategoriesSimple,
  listDepartmentsSimple,
  updateAssetStatus,
  type Asset,
  type AssetCondition,
  type AssetInput,
  type AssetStatus,
} from "@/lib/api/assets";
import { AssetStatusBadge } from "@/components/assets/AssetStatusBadge";

const STATUSES: AssetStatus[] = [
  "available",
  "allocated",
  "reserved",
  "under_maintenance",
  "lost",
  "retired",
  "disposed",
];

const CONDITIONS: AssetCondition[] = ["new", "good", "fair", "poor", "damaged"];

const CONDITION_LABELS: Record<AssetCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  damaged: "Damaged",
};

export default function AssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AssetStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");
  const [bookableFilter, setBookableFilter] = useState<"all" | "true" | "false">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AssetInput>({
    name: "",
    category: 0,
    serial_number: "",
    condition: "good",
    is_bookable: false,
    notes: "",
  });

  const canManage = user?.role === "admin" || user?.role === "asset_manager";

  const { loading } = useAsyncList(
    () =>
      Promise.all([
        listAssets({
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          category: categoryFilter === "all" ? undefined : categoryFilter,
          is_bookable: bookableFilter === "all" ? undefined : bookableFilter,
        }),
        listCategoriesSimple(),
        listDepartmentsSimple(),
      ]).then(([assetList, cats, depts]) => {
        setAssets(assetList);
        setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
        setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
        return assetList;
      }),
    [search, statusFilter, categoryFilter, bookableFilter],
  );

  function openRegister() {
    setForm({
      name: "",
      category: categories[0]?.id ?? 0,
      serial_number: "",
      condition: "good",
      is_bookable: false,
      notes: "",
    });
    setRegisterOpen(true);
  }

  async function handleRegister() {
    if (!form.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    if (!form.category) {
      toast.error("Please select a category");
      return;
    }
    setSaving(true);
    try {
      const created = await createAsset(form);
      setAssets((prev) => [created, ...prev]);
      toast.success(`Asset ${created.asset_tag} registered`);
      setRegisterOpen(false);
    } catch (err) {
      toast.error("Failed to register asset", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(asset: Asset, status: AssetStatus) {
    try {
      const updated = await updateAssetStatus(asset.id, status);
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success(`Status changed to ${ASSET_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error("Failed to change status", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-ink text-2xl font-bold tracking-tight">Assets</h2>
          <p className="text-ink-muted mt-0.5 text-sm">
            Register and track assets through their full lifecycle.
          </p>
        </div>
        {canManage && (
          <Button onClick={openRegister} className="rounded-full">
            <PackagePlus />
            Register Asset
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by tag, name, or serial…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | AssetStatus)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ASSET_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bookableFilter} onValueChange={(v) => setBookableFilter(v as "all" | "true" | "false")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assets</SelectItem>
            <SelectItem value="true">Bookable only</SelectItem>
            <SelectItem value="false">Non-bookable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="bg-accent-green/15 flex size-11 items-center justify-center rounded-xl">
                <Package className="text-accent-green size-5" />
              </span>
              <p className="text-ink-secondary text-sm font-medium">No assets found</p>
              <p className="text-ink-muted text-sm">
                {canManage
                  ? "Register your first asset to start tracking it through its lifecycle."
                  : "No assets match your current filters."}
              </p>
              {canManage && (
                <Button onClick={openRegister} variant="outline" className="mt-1 rounded-full">
                  <PackagePlus />
                  Register Asset
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Asset Tag</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Bookable</TableHead>
                  {canManage && <TableHead className="pr-4 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="pl-4 font-mono text-xs font-medium text-ink">
                      {asset.asset_tag}
                    </TableCell>
                    <TableCell className="font-medium text-ink">{asset.name}</TableCell>
                    <TableCell className="text-ink-muted">{asset.category_name}</TableCell>
                    <TableCell className="text-ink-muted">{asset.serial_number || "—"}</TableCell>
                    <TableCell>
                      <AssetStatusBadge status={asset.status} />
                    </TableCell>
                    <TableCell className="text-ink-muted">{asset.condition_label}</TableCell>
                    <TableCell>
                      {asset.is_bookable ? (
                        <span className="text-accent-teal text-sm font-medium">Yes</span>
                      ) : (
                        <span className="text-ink-faint text-sm">No</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="pr-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Change status</DropdownMenuLabel>
                            {STATUSES.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onSelect={() => handleStatusChange(asset, s)}
                                disabled={asset.status === s}
                              >
                                {ASSET_STATUS_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register a new asset</DialogTitle>
            <DialogDescription>
              The asset tag (e.g. AF-0001) is auto-generated on save.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. MacBook Pro 14&quot;"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Category *</label>
              <Select
                value={form.category?.toString() ?? ""}
                onValueChange={(v) => setForm({ ...form, category: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-ink-secondary text-sm font-medium">Serial number</label>
                <Input
                  value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  placeholder="e.g. C02XK1234"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-ink-secondary text-sm font-medium">Condition</label>
                <Select
                  value={form.condition ?? "good"}
                  onValueChange={(v) => setForm({ ...form, condition: v as AssetCondition })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONDITION_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Department</label>
              <Select
                value={form.department?.toString() ?? "none"}
                onValueChange={(v) => setForm({ ...form, department: v === "none" ? null : Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.is_bookable ?? false}
                onChange={(e) => setForm({ ...form, is_bookable: e.target.checked })}
                className="border-input size-4 rounded"
              />
              <span className="text-ink-secondary text-sm font-medium">
                Shared / bookable resource
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleRegister} disabled={saving} className="rounded-full">
              {saving ? "Registering…" : "Register asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
