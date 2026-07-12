"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsvWithToast, type ExportResource } from "@/lib/api/exports";
import { useCan } from "@/lib/auth/permissions";

export function ExportButton({
  resource,
  label,
  variant = "outline",
  size = "sm",
  className,
}: {
  resource: ExportResource;
  label?: string;
  variant?: "outline" | "secondary" | "ghost" | "default";
  size?: "sm" | "default" | "icon-sm";
  className?: string;
}) {
  const canExport = useCan("exports.download");
  const [busy, setBusy] = useState(false);

  if (!canExport) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadCsvWithToast(resource);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="size-4" />
      {label ?? (busy ? "Exporting…" : "Export CSV")}
    </Button>
  );
}
