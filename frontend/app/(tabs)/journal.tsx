import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme, gradeColor, actionColor } from "@/src/theme";
import { api } from "@/src/api";

export default function Journal() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.journal();
      setItems(r.items || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="journal-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Trade Journal</Text>
        <Text style={styles.count}>{items.length} entries</Text>
      </View>

      {loading && !items.length ? (
        <View style={styles.centered}><ActivityIndicator color={theme.color.brand} /></View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="book-outline" size={48} color={theme.color.onSurfaceSecondary} />
          <Text style={styles.emptyText}>Your journal is empty. Run your first analysis.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.analysis_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.color.brand} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const r = item.result || {};
            const open = expanded === item.analysis_id;
            return (
              <Pressable
                onPress={() => setExpanded(open ? null : item.analysis_id)}
                style={styles.card}
                testID={`journal-${item.analysis_id}`}
              >
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.sym}>{item.symbol}</Text>
                    <Text style={styles.meta}>{item.timeframe?.toUpperCase()} • {new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <View style={[styles.pill, { backgroundColor: actionColor(r.action) + "22", borderColor: actionColor(r.action) }]}>
                      <Text style={[styles.pillText, { color: actionColor(r.action) }]}>{r.action || "-"}</Text>
                    </View>
                    <View style={[styles.pill, { borderColor: gradeColor(r.trade_quality) }]}>
                      <Text style={[styles.pillText, { color: gradeColor(r.trade_quality) }]}>{r.trade_quality || "-"}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.reason} numberOfLines={open ? undefined : 2}>{r.reason}</Text>
                {open && (
                  <View style={styles.details}>
                    <D k="Entry" v={r.entry_price} />
                    <D k="SL" v={r.stop_loss} />
                    <D k="TP1" v={r.take_profit_1} />
                    <D k="TP2" v={r.take_profit_2} />
                    <D k="TP3" v={r.take_profit_3} />
                    <D k="R:R" v={r.risk_reward ? `1:${Number(r.risk_reward).toFixed(2)}` : "-"} />
                    <D k="Confidence" v={`${r.confidence ?? "-"}%`} />
                    <D k="Score" v={`${r.trade_score ?? "-"}/100`} />
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function D({ k, v }: { k: string; v: any }) {
  return (
    <View style={styles.dRow}>
      <Text style={styles.dK}>{k}</Text>
      <Text style={styles.dV}>{v ?? "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800" },
  count: { color: theme.color.onSurfaceSecondary, fontSize: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyText: { color: theme.color.onSurfaceSecondary, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    padding: 14, borderRadius: 12, gap: 8,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sym: { color: theme.color.onSurface, fontSize: 16, fontWeight: "800" },
  meta: { color: theme.color.onSurfaceSecondary, fontSize: 11, marginTop: 2 },
  pill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: "800" },
  reason: { color: theme.color.onSurface, fontSize: 13, lineHeight: 18 },
  details: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  dRow: {
    width: "31.5%", backgroundColor: theme.color.surfaceTertiary, borderRadius: 8,
    padding: 8,
  },
  dK: { color: theme.color.onSurfaceSecondary, fontSize: 11 },
  dV: { color: theme.color.onSurface, fontSize: 13, fontWeight: "700", marginTop: 2 },
});
