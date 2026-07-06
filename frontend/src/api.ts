import { storage } from "@/src/utils/storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const AUTH_TOKEN_KEY = "auth_session_token";

async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(AUTH_TOKEN_KEY, "");
}

async function request<T = any>(
  path: string,
  opts: RequestInit = {},
  authed = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (authed) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BACKEND_URL}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export const api = {
  authSession: (session_id: string) =>
    request("/auth/session", { method: "POST", body: JSON.stringify({ session_id }) }, false),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),

  pairs: () => request<{ pairs: string[] }>("/market/pairs", {}, false),
  ticker: (symbol: string) => request<any>(`/market/ticker?symbol=${symbol}`, {}, false),
  tickers: (symbols: string[]) =>
    request<{ tickers: any[] }>(`/market/tickers?symbols=${symbols.join(",")}`, {}, false),

  scan: (timeframe: string) => request<any>(`/scan?timeframe=${timeframe}`, {}, false),
  setup: (symbol: string, timeframe: string) => request<any>(`/setup/${symbol}?timeframe=${timeframe}`, {}, false),

  analyze: (symbol: string, exchange: string, timeframe: string) =>
    request("/analyze", { method: "POST", body: JSON.stringify({ symbol, exchange, timeframe }) }),
  analyzeScreenshot: (image_base64: string, symbol?: string, notes?: string) =>
    request("/analyze/screenshot", {
      method: "POST",
      body: JSON.stringify({ image_base64, symbol, notes }),
    }),

  watchlist: () => request<{ items: any[] }>("/watchlist"),
  addWatchlist: (symbol: string) =>
    request("/watchlist", { method: "POST", body: JSON.stringify({ symbol }) }),
  delWatchlist: (symbol: string) => request(`/watchlist/${symbol}`, { method: "DELETE" }),

  alerts: () => request<{ items: any[] }>("/alerts"),
  addAlert: (payload: any) =>
    request("/alerts", { method: "POST", body: JSON.stringify(payload) }),
  delAlert: (id: string) => request(`/alerts/${id}`, { method: "DELETE" }),

  journal: () => request<{ items: any[] }>("/journal"),

  calculator: (payload: any) =>
    request("/calculator", { method: "POST", body: JSON.stringify(payload) }, false),

  registerPush: (user_id: string, platform: string, device_token: string) =>
    request("/register-push", {
      method: "POST",
      body: JSON.stringify({ user_id, platform, device_token }),
    }, false),
};
