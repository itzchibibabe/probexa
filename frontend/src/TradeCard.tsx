import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, gradeColor, actionColor } from "@/src/theme";

type Setup = {
  symbol: string;
  trend: string;
  support: number;
  resistance: number;
  entry: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
  risk_reward: number;
  ai_score: number;
  trade_grade: string;
  action: string;
  confidence: number;
  price?: number;
};

/** Minimal analysis card — only the numbers, no AI prose. */
export function TradeCard({ setup, timeframe }: { setup: Setup; timeframe?: string }) {
  const isWait = setup.action === "WAIT" || setup.confidence < 85;
  return (
    <View style={styles.card} testID="trade-card">
      <View style={styles.header}>
        <View>
          <Text style={styles.symbol}>{setup.symbol}</Text>
          {timeframe && <Text style={styles.tf}>{timeframe.toUpperCase()} · Perpetual</Text>}
        </View>
        <View style={[styles.grade, { borderColor: gradeColor(setup.trade_grade) }]}>
          <Text style={[styles.gradeText, { color: gradeColor(setup.trade_grade) }]}>
            {setup.trade_grade}
          </Text>
        </View>
      </View>

      <View style={[styles.actionBox, { backgroundColor: actionColor(setup.action) + "22", borderColor: actionColor(setup.action) }]}>
        <Ionicons
          name={setup.action === "BUY" ? "trending-up" : setup.action === "SELL" ? "trending-down" : "pause"}
          size={22}
          color={actionColor(setup.action)}
        />
        <Text style={[styles.actionText, { color: actionColor(setup.action) }]}>{setup.action}</Text>
        <View style={{ marginLeft: "auto", alignItems: "flex-end" }}>
          <Text style={styles.confLabel}>Confidence</Text>
          <Text style={[styles.confValue, { color: actionColor(setup.action) }]}>{setup.confidence}%</Text>
        </View>
      </View>

      {isWait ? (
        <View style={styles.waitPill} testID="wait-banner">
          <Text style={styles.waitText}>WAIT · No A+ setup found.</Text>
        </View>
      ) : (
        <View style={styles.readyPill}>
          <Text style={styles.readyText}>A+ READY</Text>
        </View>
      )}

      <View style={styles.grid}>
        <Kv k="Trend" v={cap(setup.trend)} />
        <Kv k="AI Score" v={`${setup.ai_score}/100`} accent={theme.color.brand} />
        <Kv k="R : R" v={setup.risk_reward ? `1 : ${Number(setup.risk_reward).toFixed(2)}` : "-"} />

        <Kv k="Support" v={fmt(setup.support)} />
        <Kv k="Resistance" v={fmt(setup.resistance)} />
        <Kv k="Entry" v={fmt(setup.entry)} accent={theme.color.brand} />

        <Kv k="Stop Loss" v={fmt(setup.stop_loss)} accent={theme.color.error} />
        <Kv k="Take Profit 1" v={fmt(setup.take_profit_1)} accent={theme.color.brandSecondary} />
        <Kv k="Take Profit 2" v={fmt(setup.take_profit_2)} accent={theme.color.brandSecondary} />

        <Kv k="Take Profit 3" v={fmt(setup.take_profit_3)} accent={theme.color.brandSecondary} />
        <Kv k="Grade" v={setup.trade_grade} accent={gradeColor(setup.trade_grade)} />
        <Kv k="Status" v={setup.action} accent={actionColor(setup.action)} />
      </View>
    </View>
  );
}

function Kv({ k, v, accent }: { k: string; v: any; accent?: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, accent ? { color: accent } : null]}>{v ?? "-"}</Text>
    </View>
  );
}

function fmt(n: any) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (isNaN(num)) return String(n);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 1) return num.toFixed(3);
  return num.toFixed(6);
}

function cap(s?: string) {
  if (!s) return "-";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 16, padding: 16, gap: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  symbol: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800" },
  tf: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  grade: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, minWidth: 60, alignItems: "center" },
  gradeText: { fontSize: 22, fontWeight: "900" },
  actionBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  actionText: { fontSize: 22, fontWeight: "900" },
  confLabel: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  confValue: { fontSize: 20, fontWeight: "800" },
  waitPill: {
    backgroundColor: theme.color.warning + "22", borderColor: theme.color.warning, borderWidth: 1,
    borderRadius: 10, padding: 10, alignItems: "center",
  },
  waitText: { color: theme.color.warning, fontWeight: "700", fontSize: 13 },
  readyPill: {
    backgroundColor: theme.color.brandSecondary + "22", borderColor: theme.color.brandSecondary, borderWidth: 1,
    borderRadius: 10, padding: 10, alignItems: "center",
  },
  readyText: { color: theme.color.brandSecondary, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kv: {
    width: "31.5%", backgroundColor: theme.color.surfaceTertiary,
    borderRadius: 10, padding: 10, gap: 2,
  },
  kvKey: { color: theme.color.onSurfaceSecondary, fontSize: 11 },
  kvVal: { color: theme.color.onSurface, fontSize: 13, fontWeight: "700" },
});
