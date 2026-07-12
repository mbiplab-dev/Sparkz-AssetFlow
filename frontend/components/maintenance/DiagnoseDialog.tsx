"use client";

import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceRequest,
} from "@/lib/api/maintenance";
import { PriorityBadge } from "./PriorityBadge";

type DiagnoseDialogProps = {
  request: MaintenanceRequest | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return `${new Date(iso).toLocaleString()} (${formatDistanceToNow(new Date(iso), {
      addSuffix: true,
    })})`;
  } catch {
    return iso;
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1.5">
      <dt className="text-ink-muted text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-ink col-span-2 text-sm">{value}</dd>
    </div>
  );
}

export function DiagnoseDialog({ request, open, onOpenChange }: DiagnoseDialogProps) {
  if (!request) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,42rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-mono text-base">
                {request.asset_tag}
              </DialogTitle>
              <DialogDescription>
                {request.asset_name} · {request.category_name}
              </DialogDescription>
            </div>
            <PriorityBadge priority={request.priority} />
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <p className="text-ink-secondary text-sm">{request.issue_description}</p>
          <dl className="mt-4">
            <Row label="Status" value={MAINTENANCE_STATUS_LABELS[request.status]} />
            <Row
              label="Raised by"
              value={
                <>
                  {request.raised_by_name}
                  <span className="text-ink-muted"> · {formatDate(request.created_at)}</span>
                </>
              }
            />
            {request.approved_by_name && (
              <Row
                label={request.status === "rejected" ? "Rejected by" : "Approved by"}
                value={
                  <>
                    {request.approved_by_name}
                    <span className="text-ink-muted">
                      {" "}
                      · {formatDate(request.approved_at)}
                    </span>
                  </>
                }
              />
            )}
            {request.technician_name && (
              <Row label="Technician" value={request.technician_name} />
            )}
            {request.started_at && <Row label="Started" value={formatDate(request.started_at)} />}
            {request.resolved_at && (
              <Row label="Resolved" value={formatDate(request.resolved_at)} />
            )}
            {request.estimated_cost && (
              <Row label="Estimated cost" value={`$${request.estimated_cost}`} />
            )}
            {request.actual_cost && (
              <Row label="Actual cost" value={`$${request.actual_cost}`} />
            )}
            {request.rejection_reason && (
              <Row label="Rejection reason" value={request.rejection_reason} />
            )}
            {request.resolution_notes && (
              <Row label="Resolution notes" value={request.resolution_notes} />
            )}
          </dl>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="rounded-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
