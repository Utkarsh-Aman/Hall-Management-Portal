/**
 * API fetch wrapper — handles base URL, auth headers, and token refresh.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Wrapper around fetch that:
 * 1. Prepends the API base URL
 * 2. Attaches Authorization header if we have a token
 * 3. On 401, attempts token refresh once, then retries
 * 4. Always includes credentials for cookie-based refresh tokens
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  if (!skipAuth && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (
    !headers.has("Content-Type") &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE}${path}`;

  let response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include", // send cookies for refresh token
  });

  // On 401, try refreshing the token once
  if (response.status === 401 && !skipAuth && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${accessToken}`);
      response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: "include",
      });
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      errorData.detail || `API error: ${response.status}`
    ) as Error & { status: number; data: unknown };
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  // Handle empty responses (204, etc.)
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response as unknown as T;
}

/**
 * Attempt to refresh the access token using the httpOnly cookie.
 */
async function tryRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) return false;

    const data = await response.json();
    accessToken = data.access_token;
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a blob (e.g., QR code image).
 */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch blob: ${response.status}`);
  }

  return response.blob();
}
