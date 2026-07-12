"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/http";
import { resolveMaintenance, type MaintenanceRequest } from "@/lib/api/maintenance";

type ResolveDialogProps = {
  request: MaintenanceRequest | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResolved: (req: MaintenanceRequest) => void;
};

export function ResolveDialog({ request, open, onOpenChange, onResolved }: ResolveDialogProps) {
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes("");
      setCost(request?.estimated_cost ?? "");
    }
  }, [open, request]);

  async function submit() {
    if (!request) return;
    if (!notes.trim()) {
      toast.error("Resolution notes are required");
      return;
    }
    setSaving(true);
    try {
      const updated = await resolveMaintenance(request.id, notes.trim(), cost || null);
      toast.success(`Request #${updated.id} resolved`);
      onResolved(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to resolve", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve maintenance request</DialogTitle>
          <DialogDescription>
            {request
              ? `${request.asset_tag} — ${request.asset_name}`
              : "Record how the issue was fixed."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Resolution notes *</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was done to resolve the issue?"
              rows={4}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-secondary text-sm font-medium">Actual cost (optional)</label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="rounded-full">
            {saving ? "Resolving…" : "Mark resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
