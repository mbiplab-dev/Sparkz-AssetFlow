"use client";

import { formatDistanceToNow } from "date-fns";
import { Play, Stethoscope, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MaintenanceRequest } from "@/lib/api/maintenance";

import { PriorityBadge } from "./PriorityBadge";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relative(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

type KanbanCardProps = {
  request: MaintenanceRequest;
  canManage: boolean;
  onDiagnose: (r: MaintenanceRequest) => void;
  onApprove: (r: MaintenanceRequest) => void;
  onReject: (r: MaintenanceRequest) => void;
  onStart: (r: MaintenanceRequest) => void;
  onResolve: (r: MaintenanceRequest) => void;
  actionPending?: number | null;
};

export function KanbanCard({
  request,
  canManage,
  onDiagnose,
  onApprove,
  onReject,
  onStart,
  onResolve,
  actionPending,
}: KanbanCardProps) {
  const isBusy = actionPending === request.id;
  const s = request.status;

  return (
    <Card className="border-border/70 bg-card hover:border-border flex flex-col gap-2 rounded-lg border p-3 shadow-none transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-ink font-mono text-sm font-semibold">{request.asset_tag}</div>
          <div className="text-ink-faint mt-0.5 text-[10px] font-medium tracking-wider uppercase">
            {request.category_name}
          </div>
        </div>
        <PriorityBadge priority={request.priority} />
      </div>

      <p className="text-ink-secondary line-clamp-3 text-sm leading-snug">
        {request.issue_description}
      </p>

      <div className="flex items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback className="text-[10px]">
            {initials(request.raised_by_name || request.raised_by_email || "?")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-ink truncate text-xs font-medium">{request.raised_by_name}</div>
          <div className="text-ink-faint text-[11px]">{relative(request.created_at)}</div>
        </div>
      </div>

      {request.technician_name && (
        <div className="text-ink-muted flex items-center gap-1.5 text-[11px]">
          <Wrench className="size-3" />
          <span className="truncate">Technician: {request.technician_name}</span>
        </div>
      )}

      {(request.estimated_cost || request.actual_cost) && (
        <div className="flex flex-wrap gap-1.5">
          {request.estimated_cost && (
            <span className="bg-muted text-ink-muted inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium">
              Est ${request.estimated_cost}
            </span>
          )}
          {request.actual_cost && (
            <span className="bg-accent-green/10 text-accent-green inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium">
              Actual ${request.actual_cost}
            </span>
          )}
        </div>
      )}

      {request.resolution_notes && s === "resolved" && (
        <div className="border-accent-green/40 bg-accent-green/5 rounded-md border-l-2 px-2 py-1.5 text-[11px]">
          <div className="text-accent-green font-medium">Resolution</div>
          <div className="text-ink-muted line-clamp-2">{request.resolution_notes}</div>
        </div>
      )}

      {request.rejection_reason && s === "rejected" && (
        <div className="border-destructive/40 bg-destructive/5 rounded-md border-l-2 px-2 py-1.5 text-[11px]">
          <div className="text-destructive font-medium">Reason</div>
          <div className="text-ink-muted line-clamp-2">{request.rejection_reason}</div>
        </div>
      )}

      <div className="border-border/60 mt-1 flex flex-wrap gap-1.5 border-t pt-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          onClick={() => onDiagnose(request)}
          disabled={isBusy}
        >
          <Stethoscope className="size-3" />
          Diagnose
        </Button>
        {canManage && s === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-7 px-2 text-[11px]",
                "border-accent-green/40 text-accent-green hover:bg-accent-green/10",
              )}
              onClick={() => onApprove(request)}
              disabled={isBusy}
            >
              <ThumbsUp className="size-3" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 border-destructive/40 h-7 px-2 text-[11px]"
              onClick={() => onReject(request)}
              disabled={isBusy}
            >
              <ThumbsDown className="size-3" />
              Reject
            </Button>
          </>
        )}
        {canManage && (s === "approved" || s === "assigned") && (
          <Button
            size="sm"
            variant="outline"
            className="border-accent-sky/40 text-accent-sky hover:bg-accent-sky/10 h-7 px-2 text-[11px]"
            onClick={() => onStart(request)}
            disabled={isBusy}
          >
            <Play className="size-3" />
            Start Work
          </Button>
        )}
        {canManage && s === "in_progress" && (
          <Button
            size="sm"
            variant="outline"
            className="border-accent-green/40 text-accent-green hover:bg-accent-green/10 h-7 px-2 text-[11px]"
            onClick={() => onResolve(request)}
            disabled={isBusy}
          >
            <Wrench className="size-3" />
            Resolve
          </Button>
        )}
      </div>
    </Card>
  );
}
