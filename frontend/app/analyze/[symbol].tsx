import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useUserPrefs } from "@/src/UserPrefsContext";
import { TradeCard } from "@/src/TradeCard";
import { TradingViewChart, ChartLevel } from "@/src/TradingViewChart";

const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h", "1d"];

/** Recompute TP1/TP2 from Entry, SL, and target RR (Entry/SL unchanged). */
function computeTPs(entry: number, sl: number, rr: number): { tp1: number; tp2: number } {
  const risk = Math.abs(entry - sl);
  const isLong = entry > sl;
  const dir = isLong ? 1 : -1;
  const tp1 = entry + dir * risk * rr;
  const tp2 = entry + dir * risk * rr * 1.75;
  return { tp1, tp2 };
}

export default function AnalyzeSymbol() {
  const router = useRouter();
  const { prefs } = useUserPrefs();
  const advLiq = !!(prefs as any).advanced?.liquidity_sweep_detection;
  const advHtf = !!(prefs as any).advanced?.higher_timeframe_confirmation;
  const params = useLocalSearchParams<{ symbol: string; timeframe?: string }>();
  const symbol = (params.symbol || "BTCUSDT").toString().toUpperCase();
  const [timeframe, setTimeframe] = useState<string>((params.timeframe || "1h").toString());
  const [rawSetup, setRawSetup] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inWatchlist, setInWatchlist] = useState(false);
  const [rr, setRR] = useState<number | "AUTO">("AUTO");
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set());

  const load = useCallback(async (tf: string) => {
    setLoading(true); setError("");
    try {
      const url = `/setup/${symbol}?timeframe=${tf}&hi_tf_confirm=${advHtf ? 1 : 0}&liq_sweep=${advLiq ? 1 : 0}&fresh=1`;
      const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api${url}`).then((x) => x.ok ? x.json() : Promise.reject(new Error(String(x.status))));
      setRawSetup(r);
      setRR("AUTO");
    } catch (e: any) {
      setError(e.message || "Failed to load setup");
    } finally { setLoading(false); }
  }, [symbol, advHtf, advLiq]);

  useEffect(() => { load(timeframe); }, [timeframe, load]);

  useEffect(() => {
    (async () => {
      try {
        const w = await api.watchlist();
        setInWatchlist(w.items?.some((x: any) => x.symbol === symbol) || false);
      } catch {}
    })();
  }, [symbol]);

  // Setup with RR-adjusted TPs. In AUTO mode we trust the backend-computed TPs.
  const setup = useMemo(() => {
    if (!rawSetup) return null;
    if (rr === "AUTO") return rawSetup;
    const { tp1, tp2 } = computeTPs(rawSetup.entry, rawSetup.stop_loss, rr);
    return { ...rawSetup, take_profit_1: tp1, take_profit_2: tp2, risk_reward: rr };
  }, [rawSetup, rr]);

  // RR warning only when user manually picked an unrealistic RR
  const rrWarning = useMemo(() => {
    if (!setup) return false;
    if (rr === "AUTO") return false;
    if (setup.direction === "long" && setup.take_profit_1 > setup.resistance * 1.005) return true;
    if (setup.direction === "short" && setup.take_profit_1 < setup.support * 0.995) return true;
    return false;
  }, [setup, rr]);

  const toggleLevel = (key: string, _price: number) => {
    setActiveLevels((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const toggleWatch = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    try {
      if (inWatchlist) { await api.delWatchlist(symbol); setInWatchlist(false); }
      else { await api.addWatchlist(symbol); setInWatchlist(true); }
    } catch (e) { console.warn(e); }
  };

  const chartLevels: ChartLevel[] = useMemo(() => {
    if (!setup) return [];
    const map: Record<string, { price: number; color: string }> = {
      Support:         { price: setup.support,      color: "#00D9FF" },
      Resistance:      { price: setup.resistance,   color: "#FFB800" },
      Entry:           { price: setup.entry,        color: "#00D9FF" },
      "Stop Loss":     { price: setup.stop_loss,    color: "#FF3B30" },
      "Take Profit 1": { price: setup.take_profit_1, color: "#00FF88" },
      "Take Profit 2": { price: setup.take_profit_2, color: "#00FF88" },
    };
    return Array.from(activeLevels).map((k) => ({ label: k, price: map[k]?.price, color: map[k]?.color })).filter((l) => l.price);
  }, [activeLevels, setup]);

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID={`analyze-${symbol}-screen`}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>{symbol}</Text>
          <Text style={styles.subtitle}>Perpetual · {timeframe.toUpperCase()}</Text>
        </View>
        <Pressable testID="watch-toggle-btn" onPress={toggleWatch} style={styles.iconBtn}>
          <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={22} color={inWatchlist ? theme.color.brand : theme.color.onSurfaceSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tfRow}>
          {TIMEFRAMES.map((tf) => {
            const active = timeframe === tf;
            return (
              <Pressable
                key={tf}
                testID={`analyze-tf-${tf}`}
                onPress={() => { setTimeframe(tf); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tf.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TradingViewChart symbol={symbol} interval={timeframe} exchange="BINANCE" levels={chartLevels} />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.color.brand} />
            <Text style={styles.loadingText}>Computing setup…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : setup ? (
          <>
            {/* Advanced Analysis badges */}
            {(setup.htf_status || setup.liquidity_sweep_status) && (
              <View style={styles.badgeRow}>
                {setup.htf_status === "confirmed" && (
                  <View style={[styles.badge, { borderColor: theme.color.brandSecondary, backgroundColor: theme.color.brandSecondary + "22" }]}>
                    <Text style={[styles.badgeText, { color: theme.color.brandSecondary }]}>✅ Higher TF Confirmed</Text>
                  </View>
                )}
                {setup.htf_status === "unconfirmed" && (
                  <View style={[styles.badge, { borderColor: theme.color.warning, backgroundColor: theme.color.warning + "22" }]}>
                    <Text style={[styles.badgeText, { color: theme.color.warning }]}>⚠ Higher TF Not Aligned</Text>
                  </View>
                )}
                {setup.liquidity_sweep_status === "real_breakout" && (
                  <View style={[styles.badge, { borderColor: theme.color.brandSecondary, backgroundColor: theme.color.brandSecondary + "22" }]}>
                    <Text style={[styles.badgeText, { color: theme.color.brandSecondary }]}>✅ Real Breakout</Text>
                  </View>
                )}
                {setup.liquidity_sweep_status === "possible_sweep" && (
                  <View style={[styles.badge, { borderColor: theme.color.warning, backgroundColor: theme.color.warning + "22" }]}>
                    <Text style={[styles.badgeText, { color: theme.color.warning }]}>⚠ Possible Liquidity Sweep</Text>
                  </View>
                )}
              </View>
            )}

            {rrWarning && (
              <View style={styles.rrWarning} testID="rr-warning">
                <Ionicons name="warning" size={16} color={theme.color.warning} />
                <Text style={styles.rrWarningText}>
                  Selected 1:{rr} may not be realistic. TP exceeds nearest major {setup.direction === "long" ? "resistance" : "support"}.
                </Text>
              </View>
            )}

            <TradeCard
              setup={setup}
              timeframe={timeframe}
              activeLevels={activeLevels}
              onToggleLevel={toggleLevel}
              rr={rr}
              onChangeRR={setRR}
            />
            <Pressable
              testID="open-calculator-btn"
              onPress={() => router.push({
                pathname: "/(tabs)/tools",
                params: {
                  symbol: setup.symbol,
                  entry: String(setup.entry),
                  sl: String(setup.stop_loss),
                  tp1: String(setup.take_profit_1),
                  tp2: String(setup.take_profit_2),
                },
              })}
              style={styles.calcBtn}
            >
              <Ionicons name="calculator" size={20} color="#002233" />
              <Text style={styles.calcBtnText}>Open Smart Position Calculator</Text>
            </Pressable>
          </>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8,
    borderBottomColor: theme.color.border, borderBottomWidth: 1,
  },
  iconBtn: { padding: 8, minWidth: 40 },
  title: { color: theme.color.onSurface, fontSize: 18, fontWeight: "800" },
  subtitle: { color: theme.color.onSurfaceSecondary, fontSize: 11, marginTop: 2 },
  scroll: { padding: 16, gap: 14 },
  tfRow: { gap: 8, paddingBottom: 4 },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceSecondary, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#002233" },
  centered: { alignItems: "center", padding: 24, gap: 8 },
  loadingText: { color: theme.color.onSurfaceSecondary },
  errorBox: {
    backgroundColor: theme.color.error + "22", borderColor: theme.color.error, borderWidth: 1,
    padding: 14, borderRadius: 12,
  },
  errorText: { color: theme.color.error, fontSize: 13 },
  calcBtn: {
    backgroundColor: theme.color.brand, padding: 14, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4,
  },
  calcBtnText: { color: "#002233", fontWeight: "800", fontSize: 15 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  rrWarning: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.color.warning + "22", borderColor: theme.color.warning, borderWidth: 1,
    padding: 12, borderRadius: 12,
  },
  rrWarningText: { color: theme.color.warning, fontSize: 12, fontWeight: "600", flex: 1 },
});
