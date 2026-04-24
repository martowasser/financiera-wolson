const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

function getRefreshToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )refreshToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setRefreshToken(token: string | null) {
  if (typeof document === 'undefined') return;
  if (token) {
    document.cookie = `refreshToken=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
  } else {
    document.cookie = 'refreshToken=; path=/; max-age=0';
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) {
      setRefreshToken(null);
      return null;
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
};

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = opts;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ) : undefined,
  });

  // If 401, try refresh
  if (res.status === 401 && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ) : undefined,
      });
    }
  }

  if (!res.ok) {
    let errorData: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try { errorData = await res.json(); } catch { /* empty */ }
    throw new ApiError(
      res.status,
      errorData.error?.code || 'UNKNOWN',
      errorData.error?.message || `Request failed with status ${res.status}`,
      errorData.error?.details,
    );
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
