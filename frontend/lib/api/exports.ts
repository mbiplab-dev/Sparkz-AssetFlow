import { API_BASE_URL, ApiError } from "@/lib/api/http";
import { getAccessToken } from "@/lib/auth/tokenStorage";

/**
 * Downloads a server-generated CSV for the given resource by hitting
 * `/api/dashboard/export/<resource>/` with the current access token, then
 * turning the response body into a Blob URL and triggering a hidden
 * anchor click so the browser saves it to disk.
 *
 * We `fetch` directly (instead of going through `authRequest`) because the
 * http client only handles JSON — for a text/csv attachment we need the raw
 * Response body and its `Content-Disposition` filename.
 */
export function downloadCsv(resource: string): void {
  void triggerDownload(resource);
}

async function triggerDownload(resource: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/export/${resource}/`,
    {
      method: "GET",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // non-JSON body — leave as null so ApiError falls back to its default message
    }
    throw new ApiError(response.status, data);
  }

  const blob = await response.blob();
  const filename = filenameFromResponse(response) ?? `assetflow-${resource}.csv`;
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
