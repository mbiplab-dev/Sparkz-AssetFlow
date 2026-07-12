import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrgStatus } from "@/lib/api/organization";

export function StatusBadge({ status }: { status: OrgStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full font-medium",
        status === "active"
          ? "border-accent-green/30 bg-accent-green/10 text-accent-green"
          : "border-border bg-muted text-ink-muted",
      )}
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
