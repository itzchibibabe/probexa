import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

const CONDITIONS = [
  { id: "a_plus_setup", label: "A+ Setup Detected" },
  { id: "price_above", label: "Price Above Target" },
  { id: "price_below", label: "Price Below Target" },
  { id: "breakout_volume", label: "Breakout with Volume" },
  { id: "support_break", label: "Support Broken" },
];

export default function Alerts() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [condition, setCondition] = useState("a_plus_setup");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.alerts();
      setItems(r.items || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!symbol.trim()) return;
    const needsPrice = condition === "price_above" || condition === "price_below";
    try {
      await api.addAlert({
        symbol: symbol.trim().toUpperCase(),
        condition,
        target_price: needsPrice ? parseFloat(price) : undefined,
        note: note.trim(),
      });
      setOpen(false);
      setSymbol(""); setPrice(""); setNote(""); setCondition("a_plus_setup");
      await load();
    } catch (e) { console.warn(e); }
  };

  const del = async (id: string) => {
    await api.delAlert(id);
    await load();
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="alerts-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Smart Alerts</Text>
        <Pressable testID="add-alert-btn" onPress={() => setOpen(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#002233" />
        </Pressable>
      </View>

      {loading && !items.length ? (
        <View style={styles.centered}><ActivityIndicator color={theme.color.brand} /></View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-outline" size={48} color={theme.color.onSurfaceSecondary} />
          <Text style={styles.emptyText}>No active alerts. Tap + to create.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.alert_id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const cLabel = CONDITIONS.find((c) => c.id === item.condition)?.label || item.condition;
            return (
              <View style={styles.row} testID={`alert-${item.alert_id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowSymbol}>{item.symbol}</Text>
                  <Text style={styles.rowSub}>{cLabel}{item.target_price ? ` @ $${item.target_price}` : ""}</Text>
                  {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                </View>
                <Pressable onPress={() => del(item.alert_id)} hitSlop={12} testID={`delete-alert-${item.alert_id}`}>
                  <Ionicons name="trash-outline" size={20} color={theme.color.onSurfaceSecondary} />
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Smart Alert</Text>
            <TextInput
              testID="alert-symbol-input"
              value={symbol}
              onChangeText={setSymbol}
              placeholder="Symbol (BTCUSDT)"
              placeholderTextColor={theme.color.onSurfaceSecondary}
              autoCapitalize="characters"
              style={styles.input}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CONDITIONS.map((c) => {
                const active = condition === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCondition(c.id)}
                    style={[styles.condChip, active && styles.condChipActive]}
                  >
                    <Text style={[styles.condText, active && { color: "#002233" }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {(condition === "price_above" || condition === "price_below") && (
              <TextInput
                testID="alert-price-input"
                value={price}
                onChangeText={setPrice}
                placeholder="Target price"
                placeholderTextColor={theme.color.onSurfaceSecondary}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            )}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional)"
              placeholderTextColor={theme.color.onSurfaceSecondary}
              style={styles.input}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.color.surfaceTertiary }]} onPress={() => setOpen(false)}>
                <Text style={{ color: theme.color.onSurface, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable testID="confirm-create-alert-btn" style={[styles.modalBtn, { backgroundColor: theme.color.brand }]} onPress={create}>
                <Text style={{ color: "#002233", fontWeight: "800" }}>Create</Text>
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
  rowSub: { color: theme.color.brand, fontSize: 12, marginTop: 2 },
  note: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  modalTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: theme.color.surfaceTertiary, color: theme.color.onSurface,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  condChip: {
    height: 36, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: theme.color.surfaceTertiary,
    borderColor: theme.color.border, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  condChipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  condText: { color: theme.color.onSurface, fontSize: 12, fontWeight: "600" },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
});
