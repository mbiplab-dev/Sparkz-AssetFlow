import { cn } from "@/lib/utils";
import { VERDICT_LABELS, type AuditVerdict } from "@/lib/api/audits";

const TINTS: Record<AuditVerdict, string> = {
  pending: "border-border bg-muted text-ink-muted",
  verified: "border-accent-green/30 bg-accent-green/10 text-accent-green",
  missing: "border-destructive/30 bg-destructive/10 text-destructive",
  damaged: "border-accent-orange/30 bg-accent-orange/15 text-accent-orange",
};

export function VerdictBadge({ verdict }: { verdict: AuditVerdict }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium",
        TINTS[verdict],
      )}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}
