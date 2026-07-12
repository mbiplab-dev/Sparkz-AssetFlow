export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
        return value[0];
      }
    }
  }
  return "Something went wrong. Please try again.";
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Low-level JSON request. Always sends/receives cookies (needed for the
 * httpOnly refresh token) and throws ApiError on a non-2xx response.
 */
export async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
