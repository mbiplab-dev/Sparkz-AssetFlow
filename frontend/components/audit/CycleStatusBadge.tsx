import { cn } from "@/lib/utils";
import { CYCLE_STATUS_LABELS, type AuditCycleStatus } from "@/lib/api/audits";

const TINTS: Record<AuditCycleStatus, string> = {
  open: "border-primary/25 bg-primary/10 text-primary",
  closed: "border-accent-green/30 bg-accent-green/10 text-accent-green",
};

export function CycleStatusBadge({ status }: { status: AuditCycleStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium",
        TINTS[status],
      )}
    >
      {CYCLE_STATUS_LABELS[status]}
    </span>
  );
}
