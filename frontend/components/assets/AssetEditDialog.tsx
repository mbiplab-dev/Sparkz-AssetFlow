"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptySelectOptions } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/http";
import {
  ASSET_CONDITION_LABELS,
  ASSET_STATUS_LABELS,
  updateAsset,
  type Asset,
  type AssetCondition,
  type AssetInput,
  type AssetStatus,
  type Location,
} from "@/lib/api/assets";

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

type EditForm = {
  name: string;
  category: number;
  condition: AssetCondition;
  status: AssetStatus;
  location: number | null;
  department: number | null;
  is_bookable: boolean;
  notes: string;
};

function formFromAsset(asset: Asset): EditForm {
  return {
    name: asset.name,
    category: asset.category,
    condition: asset.condition,
    status: asset.status,
    location: asset.location,
    department: asset.department,
    is_bookable: asset.is_bookable,
    notes: asset.notes ?? "",
  };
}

function AssetEditForm({
  asset,
  categories,
  departments,
  locations,
  onSaved,
  onOpenChange,
}: {
  asset: Asset;
  categories: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  locations: Location[];
  onSaved: (asset: Asset) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditForm>(() => formFromAsset(asset));

  async function handleSave() {
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
      const patch: Partial<AssetInput> & { status?: AssetStatus } = {
        name: form.name,
        category: form.category,
        condition: form.condition,
        location: form.location,
        department: form.department,
        is_bookable: form.is_bookable,
        notes: form.notes,
      };
      if (form.status !== asset.status) {
        patch.status = form.status;
      }
      const updated = await updateAsset(asset.id, patch);
      onSaved(updated);
      toast.success("Asset updated");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to update asset", {
        description:
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        duration: 6000,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit asset</DialogTitle>
        <DialogDescription>
          Update the asset details. Asset tag and serial number are read-only.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Asset tag</label>
            <Input value={asset.asset_tag} readOnly disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Serial number</label>
            <Input value={asset.serial_number || "—"} readOnly disabled />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-ink-secondary text-sm font-medium">Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder='e.g. MacBook Pro 14"'
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-ink-secondary text-sm font-medium">Category</label>
          <Select
            value={form.category ? form.category.toString() : ""}
            onValueChange={(v) => setForm({ ...form, category: Number(v) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.length === 0 ? (
                <EmptySelectOptions
                  title="No categories found"
                  description="Create categories in Organization setup."
                  actionHref="/organization"
                  actionLabel="Create a category →"
                />
              ) : (
                categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Condition</label>
            <Select
              value={form.condition}
              onValueChange={(v) => setForm({ ...form, condition: v as AssetCondition })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {ASSET_CONDITION_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Status</label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as AssetStatus })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ASSET_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Location</label>
            <Select
              value={form.location?.toString() ?? "none"}
              onValueChange={(v) => setForm({ ...form, location: v === "none" ? null : Number(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {locations.length === 0 ? (
                  <EmptySelectOptions
                    title="No locations found"
                    description="Locations are optional until you add them."
                  />
                ) : (
                  locations.map((l) => (
                    <SelectItem key={l.id} value={l.id.toString()}>
                      {l.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Department</label>
            <Select
              value={form.department?.toString() ?? "none"}
              onValueChange={(v) =>
                setForm({ ...form, department: v === "none" ? null : Number(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {departments.length === 0 ? (
                  <EmptySelectOptions
                    title="No departments found"
                    description="Create departments in Organization setup."
                    actionHref="/organization"
                    actionLabel="Create a department →"
                  />
                ) : (
                  departments.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
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
          <Checkbox
            checked={form.is_bookable}
            onCheckedChange={(checked) => setForm({ ...form, is_bookable: checked === true })}
          />
          <span className="text-ink-secondary text-sm font-medium">Shared / bookable resource</span>
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="rounded-full">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AssetEditDialog({
  asset,
  open,
  onOpenChange,
  categories,
  departments,
  locations,
  onSaved,
}: {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  locations: Location[];
  onSaved: (asset: Asset) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,44rem)] overflow-y-auto sm:max-w-lg">
        {asset ? (
          <AssetEditForm
            key={asset.id}
            asset={asset}
            categories={categories}
            departments={departments}
            locations={locations}
            onSaved={onSaved}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
