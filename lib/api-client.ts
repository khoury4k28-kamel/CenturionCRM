// Thin fetch wrapper used by BackendDataProvider for all API calls.
//
// API calls only happen in local dev mode — production (static export to
// GitHub Pages) excludes app/api at build time and routes mutations through
// Liveblocks instead. So API_BASE is just "/api" with no basePath dance.

const API_BASE = "/api";

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function apiCall<T>(path: string, opts?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let message = `API error: ${res.status}`;
      try {
        const parsed = JSON.parse(body);
        if (parsed.error) message = parsed.error;
      } catch {
        if (body) message = body;
      }
      return { ok: false, error: message };
    }

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return { ok: true };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: message };
  }
}
