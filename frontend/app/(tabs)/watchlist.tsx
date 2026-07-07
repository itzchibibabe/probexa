import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, TextInput, Modal } from "react-native";
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
  const [newSymbol, setNewSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1h");

  const load = useCallback(async (tf: string) => {
    setLoading(true);
    try {
      const r = await api.watchlistDetails(tf);
      setItems(r.items || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(timeframe); }, [timeframe, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(timeframe);
    setRefreshing(false);
  };

  const addSymbol = async () => {
    const s = newSymbol.trim().toUpperCase();
    if (!s) return;
    try {
      await api.addWatchlist(s);
      setNewSymbol("");
      setAddOpen(false);
      await load(timeframe);
    } catch (e) { console.warn(e); }
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
        <Pressable testID="add-symbol-btn" onPress={() => setAddOpen(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#002233" />
        </Pressable>
      </View>

      {/* Timeframe row */}
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

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add pair</Text>
            <TextInput
              testID="new-symbol-input"
              value={newSymbol}
              onChangeText={setNewSymbol}
              autoCapitalize="characters"
              placeholder="BTCUSDT"
              placeholderTextColor={theme.color.onSurfaceSecondary}
              style={styles.input}
              autoFocus
              onSubmitEditing={addSymbol}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.surfaceTertiary }]} onPress={() => setAddOpen(false)}>
                <Text style={{ color: theme.color.onSurface, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable testID="confirm-add-btn" style={[styles.modalBtn, { backgroundColor: theme.color.brand }]} onPress={addSymbol}>
                <Text style={{ color: "#002233", fontWeight: "800" }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ k, children }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statK}>{k}</Text>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}
function StatText({ k, v, color }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statK}>{k}</Text>
      <Text style={[styles.statV, { color }]}>{v}</Text>
    </View>
  );
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
  card: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    padding: 14, borderRadius: 12, gap: 12,
  },
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
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  modalTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: "700" },
  input: { backgroundColor: theme.color.surfaceTertiary, color: theme.color.onSurface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
});
