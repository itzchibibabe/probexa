import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";

/**
 * Supported currencies. Add here → shows up in the picker automatically.
 * Locale is used for correct number formatting (Indian grouping for INR, etc.).
 */
export const SUPPORTED_CURRENCIES: { code: string; label: string; symbol: string; locale: string }[] = [
  { code: "USD", label: "US Dollar",       symbol: "$",   locale: "en-US" },
  { code: "INR", label: "Indian Rupee",    symbol: "₹",   locale: "en-IN" },
  { code: "EUR", label: "Euro",            symbol: "€",   locale: "en-IE" },
  { code: "GBP", label: "British Pound",   symbol: "£",   locale: "en-GB" },
  { code: "JPY", label: "Japanese Yen",    symbol: "¥",   locale: "ja-JP" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$",  locale: "en-CA" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { code: "AED", label: "UAE Dirham",      symbol: "AED", locale: "en-AE" },
  { code: "CNY", label: "Chinese Yuan",    symbol: "¥",   locale: "zh-CN" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", locale: "en-HK" },
];

/** Auto-detect currency from device locale (region code). Falls back to USD. */
function detectCurrency(): string {
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions() as any;
    const locale: string = opts.locale || "en-US";
    const region = locale.split("-")[1]?.toUpperCase();
    const tz: string = opts.timeZone || "";
    // Region-code based detection
    const regionMap: Record<string, string> = {
      IN: "INR", US: "USD", GB: "GBP", IE: "EUR", DE: "EUR", FR: "EUR", ES: "EUR",
      IT: "EUR", NL: "EUR", PT: "EUR", GR: "EUR", AT: "EUR", BE: "EUR", FI: "EUR",
      JP: "JPY", AU: "AUD", CA: "CAD", SG: "SGD", AE: "AED", CN: "CNY", HK: "HKD",
    };
    if (region && regionMap[region]) return regionMap[region];
    // Timezone fallback (only handful of common cases)
    if (tz.includes("Kolkata") || tz.includes("Calcutta")) return "INR";
    if (tz.includes("London")) return "GBP";
    if (tz.startsWith("Europe/")) return "EUR";
    if (tz.includes("Tokyo")) return "JPY";
    if (tz.includes("Sydney")) return "AUD";
    if (tz.includes("Singapore")) return "SGD";
    if (tz.includes("Dubai")) return "AED";
    if (tz.includes("Hong_Kong")) return "HKD";
    if (tz.includes("Shanghai")) return "CNY";
    if (tz.includes("Toronto")) return "CAD";
  } catch {}
  return "USD";
}

const RATES_KEY = "currency_rates_v1";
const RATES_TTL_MS = 12 * 3600 * 1000;
const PREFS_KEY = "user_prefs_v1";

export type Prefs = {
  display_name: string;
  currency: string;
  notifications: {
    a_plus_ready: boolean;
    watchlist: boolean;
    daily_goal_achieved: boolean;
    daily_loss_reached: boolean;
    daily_summary: boolean;
  };
};

type PrefsCtx = {
  ready: boolean;
  prefs: Prefs;
  setName: (name: string) => Promise<void>;
  setCurrency: (code: string) => Promise<void>;
  setNotification: (key: keyof Prefs["notifications"], v: boolean) => Promise<void>;
  formatMoney: (usd: number, opts?: { decimals?: number; showSign?: boolean }) => string;
  currencySymbol: string;
  rate: number;
  ratesUpdatedAt?: string | null;
};

const defaultPrefs: Prefs = {
  display_name: "",
  currency: detectCurrency(),
  notifications: {
    a_plus_ready: true,
    watchlist: true,
    daily_goal_achieved: true,
    daily_loss_reached: true,
    daily_summary: false,
  },
};

const Ctx = createContext<PrefsCtx | undefined>(undefined);

export function UserPrefsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Bootstrap: load local prefs, then merge server prefs on login
  useEffect(() => {
    (async () => {
      const cached = await storage.getItem<string>(PREFS_KEY, "");
      if (cached) {
        try { setPrefs({ ...defaultPrefs, ...JSON.parse(String(cached)) }); } catch {}
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) { setReady(true); return; }
    (async () => {
      try {
        const server = await api.prefs();
        const merged: Prefs = {
          display_name: server.display_name || prefs.display_name || user.name || "",
          currency: server.currency || prefs.currency || "USD",
          notifications: { ...defaultPrefs.notifications, ...server.notifications },
        };
        setPrefs(merged);
        await storage.setItem(PREFS_KEY, JSON.stringify(merged));
      } catch {}
      finally { setReady(true); }
    })();
  }, [user?.user_id]);

  // Fetch/refresh rates (12h cache)
  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string>(RATES_KEY, "");
      if (raw) {
        try {
          const parsed = JSON.parse(String(raw));
          if (parsed && parsed.rates && parsed.at && Date.now() - parsed.at < RATES_TTL_MS) {
            setRates(parsed.rates);
            setRatesUpdatedAt(parsed.updated_at || null);
            return;
          }
        } catch {}
      }
      try {
        const data = await api.currencyRates();
        setRates(data.rates || { USD: 1 });
        setRatesUpdatedAt(data.updated_at || null);
        await storage.setItem(RATES_KEY, JSON.stringify({ rates: data.rates, updated_at: data.updated_at, at: Date.now() }));
      } catch {
        // silent fail — keep USD only
      }
    })();
  }, []);

  const persist = useCallback(async (p: Prefs, serverPayload?: any) => {
    setPrefs(p);
    await storage.setItem(PREFS_KEY, JSON.stringify(p));
    if (user && serverPayload) {
      try { await api.savePrefs(serverPayload); } catch {}
    }
  }, [user?.user_id]);

  const setName = useCallback(async (name: string) => {
    const next = { ...prefs, display_name: name };
    await persist(next, { display_name: name });
  }, [prefs, persist]);

  const setCurrency = useCallback(async (code: string) => {
    const next = { ...prefs, currency: code.toUpperCase() };
    await persist(next, { currency: code.toUpperCase() });
  }, [prefs, persist]);

  const setNotification = useCallback(async (key: keyof Prefs["notifications"], v: boolean) => {
    const next = { ...prefs, notifications: { ...prefs.notifications, [key]: v } };
    await persist(next, { notifications: { [key]: v } });
  }, [prefs, persist]);

  const currencyMeta = SUPPORTED_CURRENCIES.find((c) => c.code === prefs.currency) || SUPPORTED_CURRENCIES[0];
  const rate = rates[prefs.currency] || 1;

  const formatMoney = useCallback((usd: number, opts?: { decimals?: number; showSign?: boolean }) => {
    if (usd === null || usd === undefined || isNaN(usd)) return "-";
    const converted = usd * rate;
    const abs = Math.abs(converted);
    // Default: no decimals for large amounts, 2 for smaller
    const decimals = opts?.decimals ?? (abs >= 1000 ? 0 : 2);
    let formatted: string;
    try {
      formatted = new Intl.NumberFormat(currencyMeta.locale, {
        style: "currency",
        currency: prefs.currency,
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      }).format(converted);
    } catch {
      formatted = `${currencyMeta.symbol}${abs.toFixed(decimals)}`;
      if (converted < 0) formatted = `-${formatted}`;
    }
    if (opts?.showSign && converted > 0) formatted = "+" + formatted;
    return formatted;
  }, [rate, prefs.currency, currencyMeta]);

  const value = useMemo(() => ({
    ready,
    prefs,
    setName,
    setCurrency,
    setNotification,
    formatMoney,
    currencySymbol: currencyMeta.symbol,
    rate,
    ratesUpdatedAt,
  }), [ready, prefs, setName, setCurrency, setNotification, formatMoney, currencyMeta, rate, ratesUpdatedAt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserPrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUserPrefs must be inside UserPrefsProvider");
  return ctx;
}
