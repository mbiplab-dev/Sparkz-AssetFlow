/**
 * Resolve the API origin used by the browser.
 *
 * - Explicit `NEXT_PUBLIC_API_URL` wins (including empty string = same-origin)
 * - On public hosts (Cloudflare tunnel), force same-origin so we don't hit
 *   the visitor's localhost:8000
 * - Local default: Django on http://localhost:8000
 */
export function getApiBaseUrl(): string {
  if (typeof process.env.NEXT_PUBLIC_API_URL === "string") {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return "";
    }
  }
  return "http://localhost:8000";
}

/** @deprecated Prefer getApiBaseUrl() — kept for existing imports. */
export const API_BASE_URL = getApiBaseUrl();

/** Thrown for any non-2xx response, carrying the status and parsed body. */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(errorMessageFrom(data));
    this.status = status;
    this.data = data;
  }
}

function errorMessageFrom(data: unknown): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (Array.isArray(record.non_field_errors) && record.non_field_errors.length > 0) {
      return String(record.non_field_errors[0]);
    }
    for (const [key, value] of Object.entries(record)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
        return key === "non_field_errors" ? value[0] : `${key}: ${value[0]}`;
      }
      if (typeof value === "string") return value;
    }
  }
  return "Something went wrong. Please try again.";
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 200) };
  }
}

/** Ensure Django-style trailing slash on relative API paths. */
function withTrailingSlash(path: string): string {
  if (path.startsWith("http") || path.includes("?")) {
    // absolute or query — only fix path segment before ?
    const [p, q] = path.split("?");
    if (!p) return path;
    const fixed = p.endsWith("/") ? p : `${p}/`;
    return q !== undefined ? `${fixed}?${q}` : fixed;
  }
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * Low-level JSON request. Always sends/receives cookies (needed for the
 * httpOnly refresh token) and throws ApiError on a non-2xx response.
 */
export async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const base = getApiBaseUrl();
  const normalized = path.startsWith("http") ? path : withTrailingSlash(path);
  const url = normalized.startsWith("http") ? normalized : `${base}${normalized}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, data);
  }
  return data;
}
