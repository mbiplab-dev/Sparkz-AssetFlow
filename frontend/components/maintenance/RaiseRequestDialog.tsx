"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { Asset } from "@/lib/api/assets";
import {
  createMaintenanceRequest,
  MAINTENANCE_PRIORITY_LABELS,
  type MaintenancePriority,
  type MaintenanceRequest,
} from "@/lib/api/maintenance";

const PRIORITIES: MaintenancePriority[] = ["low", "medium", "high", "critical"];

type RaiseRequestDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assets: Asset[];
  onCreated: (req: MaintenanceRequest) => void;
};

export function RaiseRequestDialog({
  open,
  onOpenChange,
  assets,
  onCreated,
}: RaiseRequestDialogProps) {
  const [assetId, setAssetId] = useState<string>("");
  const [priority, setPriority] = useState<MaintenancePriority>("medium");
  const [description, setDescription] = useState("");
  const [estimated, setEstimated] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setAssetId("");
      setPriority("medium");
      setDescription("");
      setEstimated("");
      setSearch("");
    }
  }, [open]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets.slice(0, 200);
    return assets
      .filter(
        (a) =>
          a.asset_tag.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.serial_number ?? "").toLowerCase().includes(q),
      )
      .slice(0, 200);
  }, [assets, search]);

  async function handleSubmit() {
    const parsedId = Number(assetId);
    if (!parsedId) {
      toast.error("Please select an asset");
      return;
    }
    if (!description.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    setSaving(true);
    try {
      const created = await createMaintenanceRequest({
        asset: parsedId,
        issue_description: description.trim(),
        priority,
        estimated_cost: estimated ? estimated : null,
      });
      toast.success(`Request #${created.id} raised for ${created.asset_tag}`);
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to raise request", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raise a maintenance request</DialogTitle>
          <DialogDescription>
            Describe the issue and set a priority. An asset manager will approve or reject it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Search asset</label>
            <Input
              placeholder="Search by tag, name, serial…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Asset *</label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an asset" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {assets.length === 0 ? (
                  <EmptySelectOptions
                    title="No assets found"
                    description="Register assets before raising maintenance."
                    actionHref="/assets"
                    actionLabel="Create assets →"
                  />
                ) : filteredAssets.length === 0 ? (
                  <EmptySelectOptions
                    title="No matching assets"
                    description="Try a different search tag or name."
                  />
                ) : (
                  filteredAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      <span className="font-mono text-xs">{a.asset_tag}</span>
                      <span className="ml-2">{a.name}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as MaintenancePriority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {MAINTENANCE_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Issue description *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's wrong with the asset?"
              rows={4}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">
              Estimated cost (optional)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={estimated}
              onChange={(e) => setEstimated(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="rounded-full">
            {saving ? "Submitting…" : "Raise request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
