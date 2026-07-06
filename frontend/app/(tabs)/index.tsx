import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { theme, gradeColor, actionColor } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";

const TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d"];

export default function Home() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [timeframe, setTimeframe] = useState("1h");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (tf: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await api.scan(tf);
      setData(r);
    } catch (e: any) {
      setError(e.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(timeframe); }, [timeframe, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(timeframe);
    setRefreshing(false);
  };

  const openSetup = (symbol: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.push({ pathname: "/analyze/[symbol]", params: { symbol, timeframe } });
  };

  const openSearch = () => {
    router.push({ pathname: "/search", params: { timeframe } });
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="home-screen">
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.brand}>Probexa</Text>
          <Text style={styles.tag}>Only High-Probability Setups.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable testID="home-search-btn" onPress={openSearch} style={styles.iconBtn}>
            <Ionicons name="search" size={22} color={theme.color.brand} />
          </Pressable>
          <Pressable testID="signout-button" onPress={signOut} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={22} color={theme.color.onSurfaceSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.color.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Timeframe row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tfRow}>
          {TIMEFRAMES.map((tf) => {
            const active = timeframe === tf;
            return (
              <Pressable
                key={tf}
                testID={`tf-${tf}`}
                onPress={() => { setTimeframe(tf); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tf.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && !data ? (
          <View style={styles.centered} testID="scan-loading">
            <ActivityIndicator color={theme.color.brand} size="large" />
            <Text style={styles.loadingText}>Scanning futures markets…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => load(timeframe)} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Today's Best Setups */}
            <SectionHeader
              icon="flash"
              title="Today's Best Setups"
              caption={`${data?.best_setups?.length || 0} A+ / A signals`}
            />
            {data?.best_setups?.length === 0 ? (
              <View style={styles.emptyBest} testID="no-best-setups">
                <Ionicons name="pause-circle-outline" size={28} color={theme.color.warning} />
                <Text style={styles.emptyBestTitle}>WAIT — no A+ setup right now.</Text>
                <Text style={styles.emptyBestSub}>The market is not offering high-probability trades. Pull down to refresh.</Text>
              </View>
            ) : (
              (data?.best_setups || []).map((s: any) => (
                <BestSetupCard key={s.symbol} setup={s} onPress={() => openSetup(s.symbol)} />
              ))
            )}

            {/* Preparing A+ Setups */}
            <SectionHeader
              icon="hourglass"
              title="Preparing A+ Setups"
              caption={`${data?.preparing?.length || 0} candidates`}
            />
            {data?.preparing?.length === 0 ? (
              <Text style={styles.emptySub}>No pairs preparing right now.</Text>
            ) : (
              (data?.preparing || []).map((s: any) => (
                <PreparingCard key={s.symbol} setup={s} onPress={() => openSetup(s.symbol)} />
              ))
            )}

            <Text style={styles.footer}>
              Scanned {data?.scanned_count} pairs · Auto-refresh every minute
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title, caption }: any) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={16} color={theme.color.brand} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionCaption}>{caption}</Text>
    </View>
  );
}

function BestSetupCard({ setup, onPress }: any) {
  const ac = actionColor(setup.action);
  const gc = gradeColor(setup.trade_grade);
  return (
    <Pressable
      testID={`best-setup-${setup.symbol}`}
      onPress={onPress}
      style={({ pressed }) => [styles.bestCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.bestTop}>
        <View>
          <Text style={styles.bestSymbol}>{setup.symbol}</Text>
          <Text style={styles.bestPrice}>${fmtPrice(setup.price)}</Text>
        </View>
        <View style={[styles.gradeBadge, { borderColor: gc }]}>
          <Text style={[styles.gradeBadgeText, { color: gc }]}>{setup.trade_grade}</Text>
        </View>
      </View>
      <View style={styles.bestBottom}>
        <View style={styles.stat}>
          <Text style={styles.statK}>AI Score</Text>
          <Text style={[styles.statV, { color: theme.color.brand }]}>{setup.ai_score}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statK}>Confidence</Text>
          <Text style={[styles.statV, { color: ac }]}>{setup.confidence}%</Text>
        </View>
        <View style={[styles.actionPill, { backgroundColor: ac + "22", borderColor: ac }]}>
          <Ionicons
            name={setup.action === "BUY" ? "trending-up" : setup.action === "SELL" ? "trending-down" : "pause"}
            size={14} color={ac}
          />
          <Text style={[styles.actionPillText, { color: ac }]}>{setup.action}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function PreparingCard({ setup, onPress }: any) {
  const ac = actionColor(setup.direction === "long" ? "BUY" : setup.direction === "short" ? "SELL" : "WAIT");
  const dirLabel = setup.direction === "long" ? "BUY" : setup.direction === "short" ? "SELL" : "SETUP";
  return (
    <Pressable
      testID={`preparing-${setup.symbol}`}
      onPress={onPress}
      style={({ pressed }) => [styles.prepCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.prepTop}>
        <View>
          <Text style={styles.prepSymbol}>{setup.symbol}</Text>
          <Text style={[styles.prepStatus, { color: ac }]}>Preparing {dirLabel}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreVal}>{setup.ai_score}<Text style={styles.scoreMax}>/100</Text></Text>
        </View>
      </View>
      {setup.missing_conditions?.length > 0 && (
        <View style={styles.missingWrap}>
          <Text style={styles.missingLabel}>Missing:</Text>
          {setup.missing_conditions.slice(0, 3).map((m: string) => (
            <View key={m} style={styles.missingRow}>
              <View style={styles.missingDot} />
              <Text style={styles.missingText}>{m}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function fmtPrice(n: any) {
  const num = Number(n) || 0;
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(3);
  return num.toFixed(6);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  brand: { color: theme.color.onSurface, fontSize: 24, fontWeight: "800", letterSpacing: 0.5 },
  tag: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 8 },
  scroll: { padding: 16, gap: 10, paddingBottom: 40 },
  tfRow: { gap: 8, paddingVertical: 2, paddingBottom: 4 },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceSecondary, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#002233" },
  centered: { alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  loadingText: { color: theme.color.onSurfaceSecondary, fontSize: 13 },
  errorBox: {
    backgroundColor: theme.color.error + "22", borderColor: theme.color.error, borderWidth: 1,
    padding: 14, borderRadius: 12, alignItems: "center", gap: 10,
  },
  errorText: { color: theme.color.error, fontSize: 13 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.color.brand, borderRadius: 8 },
  retryText: { color: "#002233", fontWeight: "700" },
  sectionHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, marginBottom: 4,
  },
  sectionTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: "800" },
  sectionCaption: { color: theme.color.onSurfaceSecondary, fontSize: 11 },
  emptyBest: {
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.warning + "66", borderWidth: 1,
    padding: 18, borderRadius: 14, alignItems: "center", gap: 6,
  },
  emptyBestTitle: { color: theme.color.warning, fontSize: 15, fontWeight: "800" },
  emptyBestSub: { color: theme.color.onSurfaceSecondary, fontSize: 12, textAlign: "center" },
  emptySub: { color: theme.color.onSurfaceSecondary, fontSize: 13, padding: 12 },
  bestCard: {
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 14, padding: 14, gap: 12,
  },
  bestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bestSymbol: { color: theme.color.onSurface, fontSize: 18, fontWeight: "800" },
  bestPrice: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  gradeBadge: {
    borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, minWidth: 52, alignItems: "center",
  },
  gradeBadgeText: { fontSize: 18, fontWeight: "900" },
  bestBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  stat: { flex: 1 },
  statK: { color: theme.color.onSurfaceSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  statV: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  actionPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  actionPillText: { fontSize: 13, fontWeight: "800" },
  prepCard: {
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 14, padding: 14, gap: 8,
  },
  prepTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  prepSymbol: { color: theme.color.onSurface, fontSize: 16, fontWeight: "800" },
  prepStatus: { fontSize: 12, marginTop: 3, fontWeight: "700" },
  scoreBox: { alignItems: "flex-end" },
  scoreLabel: { color: theme.color.onSurfaceSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  scoreVal: { color: theme.color.brand, fontSize: 18, fontWeight: "800" },
  scoreMax: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: "500" },
  missingWrap: { gap: 4 },
  missingLabel: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  missingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  missingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.color.warning },
  missingText: { color: theme.color.onSurface, fontSize: 12 },
  footer: { color: theme.color.onSurfaceSecondary, fontSize: 11, textAlign: "center", marginTop: 16 },
});
