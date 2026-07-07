import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { useUserPrefs } from "@/src/UserPrefsContext";

export function GoalCard({ summary, onPress }: { summary: any; onPress: () => void }) {
  const { formatMoney } = useUserPrefs();
  const stats = summary?.stats;
  const goals = summary?.goals;
  const hasGoals = goals && (goals.target_balance > 0 || goals.current_balance > 0);

  if (!hasGoals) {
    return (
      <Pressable testID="goal-card" onPress={onPress} style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Ionicons name="trophy-outline" size={22} color={theme.color.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyTitle}>Set a Growth Goal</Text>
          <Text style={styles.emptySub}>Track profit targets, daily P&L, and win rate.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.color.onSurfaceSecondary} />
      </Pressable>
    );
  }

  const progress = stats?.total_progress_pct || 0;
  const todayPnl = stats?.today_pnl || 0;
  const pnlColor = todayPnl >= 0 ? theme.color.brandSecondary : theme.color.error;

  return (
    <Pressable testID="goal-card" onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Goal Tracker</Text>
          <Text style={styles.subtitle}>
            {formatMoney(stats.current_balance)} / {formatMoney(stats.target_balance)}
          </Text>
        </View>
        <View style={styles.pctBadge}>
          <Text style={styles.pctText}>{Math.round(progress)}%</Text>
        </View>
      </View>

      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
      </View>

      <View style={styles.stats}>
        <Stat k="Today" v={formatMoney(todayPnl, { showSign: true })} accent={pnlColor} />
        <Stat k="Win Rate" v={`${stats.win_rate || 0}%`} accent={theme.color.brand} />
        <Stat k="Trades" v={String(stats.total_trades || 0)} accent={theme.color.onSurface} />
      </View>
    </Pressable>
  );
}

function Stat({ k, v, accent }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statK}>{k}</Text>
      <Text style={[styles.statV, { color: accent }]} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 14, padding: 14, gap: 10,
  },
  emptyCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 14, padding: 14,
  },
  emptyIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: "800" },
  emptySub: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  topRow: { flexDirection: "row", alignItems: "center" },
  title: { color: theme.color.onSurface, fontSize: 15, fontWeight: "800" },
  subtitle: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  pctBadge: {
    borderColor: theme.color.brand, borderWidth: 1.5,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  pctText: { color: theme.color.brand, fontSize: 14, fontWeight: "800" },
  bar: { height: 6, borderRadius: 3, backgroundColor: theme.color.surfaceTertiary, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: theme.color.brandSecondary },
  stats: { flexDirection: "row", gap: 12 },
  statK: { color: theme.color.onSurfaceSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  statV: { fontSize: 15, fontWeight: "800", marginTop: 2 },
});
