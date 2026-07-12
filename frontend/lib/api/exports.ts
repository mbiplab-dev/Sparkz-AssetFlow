import { toast } from "sonner";
import { API_BASE_URL, ApiError } from "@/lib/api/http";
import { getAccessToken } from "@/lib/auth/tokenStorage";

export type ExportResource =
  | "departments"
  | "categories"
  | "employees"
  | "assets"
  | "holdings"
  | "bookings"
  | "maintenance";

/**
 * Download a server-generated CSV for the given resource.
 * Uses raw fetch (not JSON client) so we can save the blob attachment.
 */
export async function downloadCsv(resource: ExportResource | string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/dashboard/export/${resource}/`, {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // non-JSON body
    }
    throw new ApiError(response.status, data);
  }

  const blob = await response.blob();
  const filename = filenameFromResponse(response) ?? `assetflow-${resource}.csv`;
  triggerBlobDownload(blob, filename);
}

/** Toast-wrapped download for button handlers. */
export async function downloadCsvWithToast(resource: ExportResource | string): Promise<void> {
  try {
    await downloadCsv(resource);
    toast.success(`Downloaded ${resource} CSV`);
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : "Download failed";
    toast.error("Export failed", { description: msg });
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function filenameFromResponse(response: Response): string | null {
  const header = response.headers.get("Content-Disposition");
  if (!header) return null;
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? null;
}

/** Build a CSV string client-side from rows and trigger download. */
export function downloadClientCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerBlobDownload(blob, filename);
}

/**
 * Open a print-friendly window so the user can "Save as PDF" from the browser.
 * Avoids adding a PDF library dependency.
 */
export function printReportAsPdf(title: string, htmlBody: string): void {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    toast.error("Pop-up blocked", { description: "Allow pop-ups to export PDF." });
    return;
  }
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; color: #191918; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #e6e6e6; padding-bottom: 4px; }
    p.meta { color: #615d59; font-size: 12px; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
    th { color: #615d59; font-weight: 600; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Generated ${new Date().toLocaleString()} · AssetFlow</p>
  ${htmlBody}
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`);
  win.document.close();
}
