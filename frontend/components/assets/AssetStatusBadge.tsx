import { cn } from "@/lib/utils";
import { ASSET_STATUS_LABELS, type AssetStatus } from "@/lib/api/assets";

const STATUS_TINTS: Record<AssetStatus, string> = {
  available: "border-accent-green/30 bg-accent-green/10 text-accent-green",
  allocated: "border-accent-sky/30 bg-accent-sky/15 text-accent-sky",
  reserved: "border-accent-teal/30 bg-accent-teal/15 text-accent-teal",
  under_maintenance: "border-accent-orange/30 bg-accent-orange/15 text-accent-orange",
  lost: "border-destructive/30 bg-destructive/10 text-destructive",
  retired: "border-border bg-muted text-ink-muted",
  disposed: "border-border bg-muted text-ink-faint",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium",
        STATUS_TINTS[status],
      )}
    >
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}
