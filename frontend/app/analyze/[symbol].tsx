import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { TradeCard } from "@/src/TradeCard";
import { TradingViewChart } from "@/src/TradingViewChart";

const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h", "1d"];

export default function AnalyzeSymbol() {
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol: string; timeframe?: string }>();
  const symbol = (params.symbol || "BTCUSDT").toString().toUpperCase();
  const [timeframe, setTimeframe] = useState<string>((params.timeframe || "1h").toString());
  const [setup, setSetup] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inWatchlist, setInWatchlist] = useState(false);

  const load = useCallback(async (tf: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await api.setup(symbol, tf);
      setSetup(r);
    } catch (e: any) {
      setError(e.message || "Failed to load setup");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(timeframe); }, [timeframe, load]);

  useEffect(() => {
    (async () => {
      try {
        const w = await api.watchlist();
        setInWatchlist(w.items?.some((x: any) => x.symbol === symbol) || false);
      } catch {}
    })();
  }, [symbol]);

  const toggleWatch = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    try {
      if (inWatchlist) { await api.delWatchlist(symbol); setInWatchlist(false); }
      else { await api.addWatchlist(symbol); setInWatchlist(true); }
    } catch (e) { console.warn(e); }
  };

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

        <TradingViewChart symbol={symbol} interval={timeframe} exchange="BINANCE" />

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
          <TradeCard setup={setup} timeframe={timeframe} />
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
});
