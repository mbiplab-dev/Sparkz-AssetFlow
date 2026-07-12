import { cn } from "@/lib/utils";
import { MAINTENANCE_PRIORITY_LABELS, type MaintenancePriority } from "@/lib/api/maintenance";

const PRIORITY_TINTS: Record<MaintenancePriority, string> = {
  low: "border-border bg-muted text-ink-muted",
  medium: "border-accent-sky/30 bg-accent-sky/10 text-accent-sky",
  high: "border-accent-orange/30 bg-accent-orange/10 text-accent-orange",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium tracking-wide uppercase",
        PRIORITY_TINTS[priority],
      )}
    >
      {MAINTENANCE_PRIORITY_LABELS[priority]}
    </span>
  );
}
