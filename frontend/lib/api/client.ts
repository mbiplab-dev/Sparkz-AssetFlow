import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/tokenStorage";
import { ApiError, request } from "./http";

function withAuthHeader(options: RequestInit, token: string | null): RequestInit {
  if (!token) return options;
  return { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } };
}

/** Silently exchanges the refresh cookie for a new access token, or null on failure. */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const data = (await request("/api/auth/refresh/", { method: "POST" })) as { access: string };
    setAccessToken(data.access);
    return data.access;
  } catch {
    return null;
  }
}

/**
 * JSON request that attaches the current access token and, if the server
 * rejects it as expired (401), refreshes once via the httpOnly cookie and
 * retries the request before giving up.
 */
export async function authRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  try {
    return await request(path, withAuthHeader(options, getAccessToken()));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request(path, withAuthHeader(options, newToken));
      }
      clearAccessToken();
    }
    throw error;
  }
}

export { refreshAccessToken };
