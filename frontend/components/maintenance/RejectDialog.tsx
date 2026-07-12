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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/http";
import { rejectMaintenance, type MaintenanceRequest } from "@/lib/api/maintenance";

type RejectDialogProps = {
  request: MaintenanceRequest | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRejected: (req: MaintenanceRequest) => void;
};

export function RejectDialog({ request, open, onOpenChange, onRejected }: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  async function submit() {
    if (!request) return;
    if (!reason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await rejectMaintenance(request.id, reason.trim());
      toast.success(`Request #${updated.id} rejected`);
      onRejected(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to reject", {
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
          <DialogTitle>Reject maintenance request</DialogTitle>
          <DialogDescription>
            {request ? `${request.asset_tag} — ${request.asset_name}` : "Provide a reason."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label className="text-ink-secondary text-sm font-medium">Reason *</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this request being rejected?"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="rounded-full">
            {saving ? "Rejecting…" : "Reject request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
