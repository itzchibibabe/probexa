import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

export default function Watchlist() {
  const [items, setItems] = useState<any[]>([]);
  const [tickers, setTickers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.watchlist();
      setItems(r.items || []);
      if ((r.items || []).length) {
        const t = await api.tickers(r.items.map((x: any) => x.symbol));
        const map: Record<string, any> = {};
        t.tickers.forEach((tk: any) => { map[tk.symbol] = tk; });
        setTickers(map);
      } else {
        setTickers({});
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addSymbol = async () => {
    const s = newSymbol.trim().toUpperCase();
    if (!s) return;
    try {
      await api.addWatchlist(s);
      setNewSymbol("");
      setAddOpen(false);
      await load();
    } catch (e) {
      console.warn(e);
    }
  };

  const remove = async (s: string) => {
    await api.delWatchlist(s);
    await load();
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="watchlist-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <Pressable testID="add-symbol-btn" onPress={() => setAddOpen(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#002233" />
        </Pressable>
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
            const t = tickers[item.symbol];
            const pos = t?.change_pct >= 0;
            return (
              <View style={styles.row} testID={`wl-${item.symbol}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowSymbol}>{item.symbol}</Text>
                  <Text style={styles.rowSub}>Vol: {t ? Number(t.volume).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-"}</Text>
                </View>
                <View style={{ alignItems: "flex-end", marginRight: 12 }}>
                  <Text style={styles.rowPrice}>{t ? `$${Number(t.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "-"}</Text>
                  <Text style={[styles.rowChange, { color: pos ? theme.color.brandSecondary : theme.color.error }]}>
                    {t ? `${pos ? "+" : ""}${Number(t.change_pct).toFixed(2)}%` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => remove(item.symbol)} testID={`remove-${item.symbol}`} hitSlop={12}>
                  <Ionicons name="trash-outline" size={20} color={theme.color.onSurfaceSecondary} />
                </Pressable>
              </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyText: { color: theme.color.onSurfaceSecondary, fontSize: 14 },
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    padding: 14, borderRadius: 12,
  },
  rowSymbol: { color: theme.color.onSurface, fontSize: 16, fontWeight: "800" },
  rowSub: { color: theme.color.onSurfaceSecondary, fontSize: 11, marginTop: 2 },
  rowPrice: { color: theme.color.onSurface, fontSize: 14, fontWeight: "700" },
  rowChange: { fontSize: 12, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  modalTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: theme.color.surfaceTertiary, color: theme.color.onSurface,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
});
