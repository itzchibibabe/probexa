import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { TradeCard } from "@/src/TradeCard";
import { TradingViewChart } from "@/src/TradingViewChart";

const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h", "1d"];
const DEFAULT_PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "TAOUSDT", "SUIUSDT"];

export default function Home() {
  const { user, signOut } = useAuth();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [exchange] = useState("OKX");
  const [ticker, setTicker] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pairs, setPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [pairsLoaded, setPairsLoaded] = useState(false);
  const [query, setQuery] = useState("");

  const filteredPairs = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return pairs.slice(0, 100);
    return pairs.filter((p) => p.includes(q)).slice(0, 200);
  }, [query, pairs]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.ticker(symbol);
        setTicker(r);
      } catch {
        setTicker(null);
      }
    })();
  }, [symbol]);

  const loadPairs = async () => {
    if (pairsLoaded) return;
    try {
      const r = await api.pairs();
      setPairs(r.pairs);
      setPairsLoaded(true);
    } catch {}
  };

  const runAnalyze = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    setError("");
    setAnalysis(null);
    try {
      const r = await api.analyze(symbol, "binance", timeframe);
      setAnalysis(r);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = async () => {
    try {
      await api.addWatchlist(symbol);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const uploadScreenshot = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Photo permission denied. Enable it in Settings to upload chart screenshots.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      setLoading(true);
      setError("");
      setAnalysis(null);
      const r = await api.analyzeScreenshot(res.assets[0].base64, symbol);
      // Wrap into same shape as analyze
      setAnalysis({ result: r.result, symbol: `${symbol} (screenshot)`, timeframe: "n/a" });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || "Screenshot analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="home-screen">
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.hello}>Hey, {user?.name?.split(" ")[0] || "Trader"}</Text>
          <Text style={styles.subhead}>A+ setups only. Never guess.</Text>
        </View>
        <Pressable testID="signout-button" onPress={signOut} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={22} color={theme.color.onSurfaceSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Pair selector */}
        <Pressable testID="pair-selector" onPress={() => { setSearchOpen(true); loadPairs(); }} style={styles.pairCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pairLabel}>Pair · {exchange}</Text>
            <Text style={styles.pairSymbol}>{symbol}</Text>
            {ticker && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Text style={styles.price}>${Number(ticker.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}</Text>
                <Text style={[styles.change, { color: ticker.change_pct >= 0 ? theme.color.brandSecondary : theme.color.error }]}>
                  {ticker.change_pct >= 0 ? "+" : ""}{Number(ticker.change_pct).toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
          <Ionicons name="search" size={22} color={theme.color.brand} />
        </Pressable>

        {/* Timeframes */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tfRow}>
          {TIMEFRAMES.map((tf) => {
            const active = timeframe === tf;
            return (
              <Pressable
                key={tf}
                testID={`tf-${tf}`}
                onPress={() => {
                  setTimeframe(tf);
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tf.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Chart */}
        <TradingViewChart symbol={symbol} interval={timeframe} exchange="OKX" />

        {/* Secondary actions */}
        <View style={styles.actionsRow}>
          <Pressable testID="add-watchlist-btn" style={styles.secondary} onPress={addToWatchlist}>
            <Ionicons name="bookmark-outline" size={18} color={theme.color.brand} />
            <Text style={styles.secondaryText}>Add to Watchlist</Text>
          </Pressable>
          <Pressable testID="screenshot-analyze-btn" style={styles.secondary} onPress={uploadScreenshot}>
            <Ionicons name="image-outline" size={18} color={theme.color.brandSecondary} />
            <Text style={styles.secondaryText}>Analyze Screenshot</Text>
          </Pressable>
        </View>

        {/* Analyze CTA */}
        <Pressable
          testID="analyze-button"
          onPress={runAnalyze}
          disabled={loading}
          style={({ pressed }) => [styles.analyzeBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#002233" />
              <Text style={styles.analyzeText}>Analyzing {symbol}...</Text>
            </>
          ) : (
            <>
              <Ionicons name="flash" size={22} color="#002233" />
              <Text style={styles.analyzeText}>Analyze {symbol}</Text>
            </>
          )}
        </Pressable>

        {error ? (
          <View style={styles.errorBox} testID="analyze-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {analysis && (
          <TradeCard
            result={analysis.result}
            snapshot={analysis.snapshot}
            symbol={analysis.symbol}
            timeframe={analysis.timeframe}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Search Modal */}
      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.color.surface }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHead}>
              <TextInput
                testID="pair-search-input"
                value={query}
                onChangeText={setQuery}
                placeholder="Search pair (BTCUSDT, ETH...)"
                placeholderTextColor={theme.color.onSurfaceSecondary}
                autoCapitalize="characters"
                autoFocus
                style={styles.searchInput}
              />
              <Pressable onPress={() => setSearchOpen(false)}>
                <Text style={{ color: theme.color.brand, fontWeight: "700" }}>Close</Text>
              </Pressable>
            </View>
            <FlatList
              data={filteredPairs}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  testID={`pair-option-${item}`}
                  style={styles.pairOption}
                  onPress={() => {
                    setSymbol(item);
                    setSearchOpen(false);
                    setQuery("");
                  }}
                >
                  <Text style={styles.pairOptionText}>{item}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.color.onSurfaceSecondary} />
                </Pressable>
              )}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  hello: { color: theme.color.onSurface, fontSize: 20, fontWeight: "800" },
  subhead: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 8 },
  scroll: { padding: 16, gap: 14 },
  pairCard: {
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 14, padding: 16,
    flexDirection: "row", alignItems: "center",
  },
  pairLabel: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  pairSymbol: { color: theme.color.onSurface, fontSize: 24, fontWeight: "800", marginTop: 4 },
  price: { color: theme.color.onSurface, fontSize: 16, fontWeight: "700" },
  change: { fontSize: 13, fontWeight: "700" },
  tfRow: { gap: 8, paddingVertical: 2 },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceSecondary, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#002233" },
  actionsRow: { flexDirection: "row", gap: 8 },
  secondary: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  secondaryText: { color: theme.color.onSurface, fontWeight: "600", fontSize: 13 },
  analyzeBtn: {
    backgroundColor: theme.color.brand,
    paddingVertical: 18, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  analyzeText: { color: "#002233", fontSize: 17, fontWeight: "800" },
  errorBox: {
    backgroundColor: theme.color.error + "22",
    borderColor: theme.color.error, borderWidth: 1,
    padding: 12, borderRadius: 10,
  },
  errorText: { color: theme.color.error, fontSize: 13 },
  modalHead: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomColor: theme.color.border, borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1, color: theme.color.onSurface, fontSize: 16,
    backgroundColor: theme.color.surfaceSecondary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pairOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomColor: theme.color.border, borderBottomWidth: 1,
  },
  pairOptionText: { color: theme.color.onSurface, fontSize: 15, fontWeight: "600" },
});
