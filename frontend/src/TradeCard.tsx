import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme, actionColor, gradeColor } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";

type Result = any;

export function TradeCard({ result, snapshot, symbol, timeframe }: { result: Result; snapshot?: any; symbol: string; timeframe: string }) {
  const isWait = result.action === "WAIT" || (result.confidence ?? 0) < 85;

  return (
    <View style={styles.card} testID="trade-card">
      <View style={styles.header}>
        <View>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.sub}>{timeframe.toUpperCase()} • {result.trend || "-"}</Text>
        </View>
        <View style={[styles.grade, { borderColor: gradeColor(result.trade_quality) }]}>
          <Text style={[styles.gradeText, { color: gradeColor(result.trade_quality) }]}>
            {result.trade_quality || "-"}
          </Text>
        </View>
      </View>

      {isWait ? (
        <View style={styles.waitBox} testID="wait-banner">
          <Ionicons name="pause-circle" size={22} color={theme.color.warning} />
          <Text style={styles.waitText}>WAIT - No A+ setup found.</Text>
        </View>
      ) : (
        <View style={[styles.actionRow, { backgroundColor: actionColor(result.action) + "22", borderColor: actionColor(result.action) }]}>
          <Ionicons
            name={result.action === "BUY" ? "trending-up" : "trending-down"}
            size={22}
            color={actionColor(result.action)}
          />
          <Text style={[styles.actionText, { color: actionColor(result.action) }]}>{result.action}</Text>
          <Text style={styles.confidence}>Confidence {result.confidence}%</Text>
        </View>
      )}

      <View style={styles.probRow}>
        <ProbBar label="Buy" value={result.buy_probability || 0} color={theme.color.brandSecondary} />
        <ProbBar label="Sell" value={result.sell_probability || 0} color={theme.color.error} />
      </View>

      <Text style={styles.reason}>{result.reason}</Text>

      <View style={styles.grid}>
        <Kv k="Trend" v={result.trend} />
        <Kv k="Structure" v={result.market_structure} />
        <Kv k="Support" v={fmt(result.support)} />
        <Kv k="Resistance" v={fmt(result.resistance)} />
        <Kv k="Entry" v={fmt(result.entry_price)} accent={theme.color.brand} />
        <Kv k="Stop Loss" v={fmt(result.stop_loss)} accent={theme.color.error} />
        <Kv k="TP1" v={fmt(result.take_profit_1)} accent={theme.color.brandSecondary} />
        <Kv k="TP2" v={fmt(result.take_profit_2)} accent={theme.color.brandSecondary} />
        <Kv k="TP3" v={fmt(result.take_profit_3)} accent={theme.color.brandSecondary} />
        <Kv k="R:R" v={result.risk_reward ? `1:${Number(result.risk_reward).toFixed(2)}` : "-"} />
        <Kv k="Score" v={`${result.trade_score ?? "-"}/100`} />
        <Kv k="Alert" v={fmt(result.next_alert_price)} />
      </View>

      <Text style={styles.section}>A+ Checklist</Text>
      <View style={styles.checklist}>
        {[
          ["Trend", "trend"],
          ["Support/Resistance", "support_resistance"],
          ["Market Structure", "market_structure"],
          ["Breakout", "breakout"],
          ["Candle Confirmation", "candle_confirmation"],
          ["Volume Confirmation", "volume_confirmation"],
          ["Retest", "retest"],
          ["Risk Reward >= 1:2", "risk_reward"],
        ].map(([label, key]) => {
          const ok = result.checklist?.[key];
          return (
            <View key={key} style={styles.checkRow}>
              <Ionicons
                name={ok ? "checkmark-circle" : "close-circle"}
                size={18}
                color={ok ? theme.color.brandSecondary : theme.color.onSurfaceSecondary}
              />
              <Text style={styles.checkText}>{label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.statusPill}>
        <Text style={[styles.statusText, { color: allTrue(result.checklist) ? theme.color.brandSecondary : theme.color.warning }]}>
          {allTrue(result.checklist) ? "🟢 A+ Setup Ready" : "🟡 Wait for Confirmation"}
        </Text>
      </View>

      <Text style={styles.section}>Volume Analysis</Text>
      <Text style={styles.paragraph}>{result.volume_analysis}</Text>

      <Text style={styles.section}>Invalidation</Text>
      <Text style={styles.paragraph}>{result.invalidation}</Text>

      <Text style={styles.section}>Education</Text>
      <Text style={styles.paragraph}>{result.education}</Text>
    </View>
  );
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.probHead}>
        <Text style={styles.probLabel}>{label}</Text>
        <Text style={[styles.probValue, { color }]}>{value}%</Text>
      </View>
      <View style={styles.probTrack}>
        <View style={[styles.probFill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} />
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
  if (num > 1000) return num.toFixed(2);
  if (num > 1) return num.toFixed(3);
  return num.toFixed(6);
}

function allTrue(cl: any) {
  if (!cl) return false;
  return Object.values(cl).every(Boolean);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  symbol: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800" },
  sub: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  grade: {
    borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, minWidth: 60, alignItems: "center",
  },
  gradeText: { fontSize: 22, fontWeight: "900" },
  waitBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.color.warning + "22", borderColor: theme.color.warning, borderWidth: 1,
    padding: 12, borderRadius: 12,
  },
  waitText: { color: theme.color.warning, fontWeight: "700", fontSize: 15 },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  actionText: { fontSize: 20, fontWeight: "900" },
  confidence: { color: theme.color.onSurfaceSecondary, marginLeft: "auto" },
  probRow: { flexDirection: "row", gap: 12 },
  probHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  probLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12 },
  probValue: { fontSize: 14, fontWeight: "700" },
  probTrack: { height: 6, backgroundColor: theme.color.surfaceTertiary, borderRadius: 3, overflow: "hidden" },
  probFill: { height: "100%" },
  reason: { color: theme.color.onSurface, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kv: {
    width: "31.5%",
    backgroundColor: theme.color.surfaceTertiary,
    borderRadius: 10, padding: 10, gap: 2,
  },
  kvKey: { color: theme.color.onSurfaceSecondary, fontSize: 11 },
  kvVal: { color: theme.color.onSurface, fontSize: 13, fontWeight: "700" },
  section: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 8, textTransform: "uppercase", letterSpacing: 1 },
  checklist: { gap: 8 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { color: theme.color.onSurface, fontSize: 14 },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: theme.color.surfaceTertiary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  statusText: { fontSize: 13, fontWeight: "700" },
  paragraph: { color: theme.color.onSurface, fontSize: 14, lineHeight: 20 },
});
