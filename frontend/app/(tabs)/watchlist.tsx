import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme, gradeColor, actionColor } from "@/src/theme";
import { api } from "@/src/api";

const TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d"];

export default function Watchlist() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pairs, setPairs] = useState<string[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [timeframe, setTimeframe] = useState("1h");
  const [adding, setAdding] = useState<string>("");

  const load = useCallback(async (tf: string) => {
    setLoading(true);
    try {
      const r = await api.watchlistDetails(tf);
      setItems(r.items || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(timeframe); }, [timeframe, load]);

  const openAdd = async () => {
    setAddOpen(true);
    setQuery("");
    if (!pairs.length) {
      setPairsLoading(true);
      try {
        const r = await api.pairs();
        setPairs(r.pairs || []);
      } catch {}
      finally { setPairsLoading(false); }
    }
  };

  const filteredPairs = useMemo(() => {
    const already = new Set(items.map((x) => x.symbol));
    const q = query.trim().toUpperCase();
    const universe = pairs.filter((p) => !already.has(p));
    if (!q) return universe.slice(0, 100);
    return universe.filter((p) => p.includes(q)).slice(0, 200);
  }, [query, pairs, items]);

  const refresh = async () => {
    setRefreshing(true);
    await load(timeframe);
    setRefreshing(false);
  };

  const addSymbol = async (sym: string) => {
    if (!sym) return;
    setAdding(sym);
    try {
      await api.addWatchlist(sym);
      setAddOpen(false);
      setQuery("");
      await load(timeframe);
    } catch (e) { console.warn(e); }
    finally { setAdding(""); }
  };

  const remove = async (s: string) => {
    await api.delWatchlist(s);
    await load(timeframe);
  };

  const openDetail = (symbol: string) => {
    router.push({ pathname: "/analyze/[symbol]", params: { symbol, timeframe } });
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="watchlist-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <Pressable testID="add-symbol-btn" onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#002233" />
        </Pressable>
      </View>

      <View style={styles.tfWrap}>
        <FlatList
          horizontal
          data={TIMEFRAMES}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          keyExtractor={(x) => x}
          renderItem={({ item: tf }) => {
            const active = timeframe === tf;
            return (
              <Pressable onPress={() => setTimeframe(tf)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tf.toUpperCase()}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading && !items.length ? (
        <View style={styles.centered}><ActivityIndicator color={theme.color.brand} /></View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="bookmark-outline" size={48} color={theme.color.onSurfaceSecondary} />
          <Text style={styles.emptyText}>No pairs yet. Tap + to add.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.symbol}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.color.brand} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const ac = actionColor(item.action);
            const gc = gradeColor(item.trade_grade);
            const pos = (item.change_pct || 0) >= 0;
            return (
              <Pressable
                testID={`wl-${item.symbol}`}
                onPress={() => openDetail(item.symbol)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardSymbol}>{item.symbol}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <Text style={styles.cardPrice}>{item.price != null ? `$${Number(item.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "-"}</Text>
                      <Text style={[styles.cardChange, { color: pos ? theme.color.brandSecondary : theme.color.error }]}>
                        {item.change_pct != null ? `${pos ? "+" : ""}${Number(item.change_pct).toFixed(2)}%` : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.gradeBadge, { borderColor: gc }]}>
                    <Text style={[styles.gradeBadgeText, { color: gc }]}>{item.trade_grade || "-"}</Text>
                  </View>
                  <Pressable onPress={() => remove(item.symbol)} testID={`remove-${item.symbol}`} hitSlop={12} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={22} color={theme.color.onSurfaceSecondary} />
                  </Pressable>
                </View>

                <View style={styles.cardBottom}>
                  <Stat k="Signal">
                    <View style={[styles.actionPill, { backgroundColor: ac + "22", borderColor: ac }]}>
                      <Text style={[styles.actionPillText, { color: ac }]}>{item.action}</Text>
                    </View>
                  </Stat>
                  <StatText k="Score" v={`${item.ai_score || 0}`} color={theme.color.brand} />
                  <StatText k="Confidence" v={`${item.confidence || 0}%`} color={ac} />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Add pair modal — autocomplete from live pair list */}
      <Modal visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <SafeAreaView edges={["top"]} style={styles.root}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <TextInput
                testID="watchlist-search-input"
                value={query}
                onChangeText={setQuery}
                placeholder="Search futures pair (BTC, ETH, SOL…)"
                placeholderTextColor={theme.color.onSurfaceSecondary}
                autoCapitalize="characters"
                autoFocus
                style={styles.input}
              />
              <Pressable onPress={() => setAddOpen(false)} testID="watchlist-close-btn">
                <Text style={{ color: theme.color.brand, fontWeight: "700" }}>Close</Text>
              </Pressable>
            </View>
            {pairsLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color={theme.color.brand} />
                <Text style={{ color: theme.color.onSurfaceSecondary, marginTop: 8 }}>Loading available pairs…</Text>
              </View>
            ) : filteredPairs.length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: theme.color.onSurfaceSecondary }}>No matching pairs</Text>
              </View>
            ) : (
              <FlatList
                data={filteredPairs}
                keyExtractor={(x) => x}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    testID={`pair-add-${item}`}
                    onPress={() => addSymbol(item)}
                    disabled={adding === item}
                    style={styles.pairOption}
                  >
                    <View style={styles.pairIcon}>
                      <Text style={styles.pairIconText}>{item.slice(0, 2)}</Text>
                    </View>
                    <Text style={styles.pairOptText}>{item}</Text>
                    {adding === item ? (
                      <ActivityIndicator color={theme.color.brand} />
                    ) : (
                      <Ionicons name="add-circle" size={22} color={theme.color.brand} />
                    )}
                  </Pressable>
                )}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ k, children }: any) {
  return (<View style={{ flex: 1 }}><Text style={styles.statK}>{k}</Text><View style={{ marginTop: 4 }}>{children}</View></View>);
}
function StatText({ k, v, color }: any) {
  return (<View style={{ flex: 1 }}><Text style={styles.statK}>{k}</Text><Text style={[styles.statV, { color }]}>{v}</Text></View>);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center" },
  tfWrap: { paddingBottom: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceSecondary, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#002233" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyText: { color: theme.color.onSurfaceSecondary, fontSize: 14 },
  card: { backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1, padding: 14, borderRadius: 12, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardSymbol: { color: theme.color.onSurface, fontSize: 16, fontWeight: "800" },
  cardPrice: { color: theme.color.onSurface, fontSize: 13, fontWeight: "600" },
  cardChange: { fontSize: 12, fontWeight: "700" },
  gradeBadge: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 44, alignItems: "center" },
  gradeBadgeText: { fontSize: 15, fontWeight: "900" },
  cardBottom: { flexDirection: "row", gap: 12 },
  statK: { color: theme.color.onSurfaceSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  statV: { fontSize: 15, fontWeight: "800" },
  actionPill: { alignSelf: "flex-start", borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  actionPillText: { fontSize: 12, fontWeight: "800" },
  modalHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: theme.color.border, borderBottomWidth: 1 },
  input: { flex: 1, color: theme.color.onSurface, fontSize: 16, backgroundColor: theme.color.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  pairOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pairIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  pairIconText: { color: theme.color.brand, fontSize: 13, fontWeight: "800" },
  pairOptText: { flex: 1, color: theme.color.onSurface, fontSize: 15, fontWeight: "600" },
});
