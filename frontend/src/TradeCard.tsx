import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, gradeColor, actionColor } from "@/src/theme";

type Setup = {
  symbol: string;
  trend: string;
  market_structure?: string;
  support: number;
  resistance: number;
  entry: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3?: number;
  risk_reward: number;
  ai_score: number;
  trade_grade: string;
  action: string;
  confidence: number;
  price?: number;
  display_checklist?: Record<string, boolean>;
  checklist_reasons?: Record<string, string>;
};

const CHECKLIST_KEYS = [
  "Trend Confirmed",
  "EMA Alignment",
  "Support Holding",
  "Volume Confirmation",
  "Breakout Confirmed",
  "Retest Complete",
];

/** These are the ONLY cards that get an eye toggle. */
const TOGGLEABLE = new Set(["Support", "Resistance", "Entry", "Stop Loss", "Take Profit 1", "Take Profit 2"]);

const RR_OPTIONS: (number | "AUTO")[] = ["AUTO", 1.5, 2, 2.5, 3];

type Props = {
  setup: Setup;
  timeframe?: string;
  activeLevels?: Set<string>;
  onToggleLevel?: (key: string, price: number) => void;
  rr?: number | "AUTO";
  onChangeRR?: (rr: number | "AUTO") => void;
};

export function TradeCard({ setup, timeframe, activeLevels, onToggleLevel, rr, onChangeRR }: Props) {
  const isWait = setup.action === "WAIT" || setup.confidence < 85;
  const cl = setup.display_checklist || {};
  const allTrue = CHECKLIST_KEYS.every((k) => cl[k]);
  const currentRR = rr ?? "AUTO";
  const displayRR = (setup.risk_reward || 2).toFixed(1);

  return (
    <View style={styles.card} testID="trade-card">
      {/* Header */}
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

      {/* Action + Confidence */}
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
      ) : allTrue ? (
        <View style={styles.readyPill}>
          <Text style={styles.readyText}>A+ READY</Text>
        </View>
      ) : null}

      {/* Metric grid */}
      <View style={styles.grid}>
        <Kv label="Trend" value={cap(setup.trend)} />
        <Kv label="Market Structure" value={setup.market_structure || "-"} />
        <Kv label="Support" value={fmt(setup.support)} price={setup.support} active={activeLevels?.has("Support")} onToggle={onToggleLevel} />

        <Kv label="Resistance" value={fmt(setup.resistance)} price={setup.resistance} active={activeLevels?.has("Resistance")} onToggle={onToggleLevel} />
        <Kv label="Entry" value={fmt(setup.entry)} accent={theme.color.brand} price={setup.entry} active={activeLevels?.has("Entry")} onToggle={onToggleLevel} />
        <Kv label="Stop Loss" value={fmt(setup.stop_loss)} accent={theme.color.error} price={setup.stop_loss} active={activeLevels?.has("Stop Loss")} onToggle={onToggleLevel} />

        <Kv label="Take Profit 1" value={fmt(setup.take_profit_1)} accent={theme.color.brandSecondary} price={setup.take_profit_1} active={activeLevels?.has("Take Profit 1")} onToggle={onToggleLevel} />
        <Kv label="Take Profit 2" value={fmt(setup.take_profit_2)} accent={theme.color.brandSecondary} price={setup.take_profit_2} active={activeLevels?.has("Take Profit 2")} onToggle={onToggleLevel} />

        {/* Risk : Reward dropdown */}
        <View style={styles.rrCell}>
          <Text style={styles.kvKey}>Risk : Reward · {currentRR === "AUTO" ? `AUTO (1:${displayRR})` : `1:${currentRR}`}</Text>
          <View style={styles.rrRow}>
            {RR_OPTIONS.map((r) => {
              const active = currentRR === r;
              const label = r === "AUTO" ? "AUTO" : `1:${r}`;
              return (
                <Pressable
                  key={String(r)}
                  testID={`rr-${r}`}
                  onPress={() => onChangeRR?.(r)}
                  style={[styles.rrChip, active && styles.rrChipActive]}
                >
                  <Text style={[styles.rrChipText, active && styles.rrChipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Kv label="Entry Quality" value={(setup as any).entry_quality_label || "-"} accent={
          (setup as any).entry_quality_score >= 85 ? theme.color.brandSecondary :
          (setup as any).entry_quality_score >= 70 ? theme.color.brand :
          (setup as any).entry_quality_score >= 50 ? theme.color.warning : theme.color.error
        } />
        <Kv label="Score" value={`${setup.ai_score}/100`} accent={theme.color.brand} />
        <Kv label="Confidence" value={`${setup.confidence}%`} accent={actionColor(setup.action)} />
        <Kv label="Grade" value={setup.trade_grade} accent={gradeColor(setup.trade_grade)} />
      </View>

      {/* Live checklist */}
      <Text style={styles.sectionLabel}>Live Checklist</Text>
      <View style={styles.checklist}>
        {CHECKLIST_KEYS.map((k) => {
          const ok = !!cl[k];
          const reason = setup.checklist_reasons?.[k];
          return (
            <View key={k} style={styles.checkRow} testID={`check-${k}`}>
              <Ionicons
                name={ok ? "checkmark-circle" : "close-circle"}
                size={20}
                color={ok ? theme.color.brandSecondary : theme.color.onSurfaceSecondary}
              />
              <View style={styles.checkTextWrap}>
                <Text style={[styles.checkText, ok ? { color: theme.color.onSurface } : { color: theme.color.onSurfaceSecondary }]}>
                  {k}
                </Text>
                {reason ? (
                  <Text
                    style={[styles.checkReason, ok ? styles.checkReasonOk : styles.checkReasonFail]}
                    numberOfLines={2}
                    testID={`reason-${k}`}
                  >
                    {ok ? "✓ " : "· "}{reason}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Kv({ label, value, accent, price, active, onToggle }: {
  label: string; value: any; accent?: string;
  price?: number; active?: boolean; onToggle?: (key: string, price: number) => void;
}) {
  const canToggle = TOGGLEABLE.has(label) && onToggle && price !== undefined;
  const activeStyle = canToggle && active ? styles.kvActive : null;
  return (
    <View style={[styles.kv, activeStyle]} testID={`kv-${label}`}>
      <View style={styles.kvHead}>
        <Text style={styles.kvKey} numberOfLines={1}>{label}</Text>
        {canToggle ? (
          <Pressable
            testID={`eye-${label}`}
            onPress={() => onToggle!(label, price as number)}
            hitSlop={8}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={active ? "eye" : "eye-outline"}
              size={14}
              color={active ? theme.color.brand : theme.color.onSurfaceSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.kvVal, accent ? { color: accent } : null]} numberOfLines={1}>{value ?? "-"}</Text>
    </View>
  );
}

function fmt(n: any) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (isNaN(num)) return String(n);
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
    borderRadius: 10, padding: 10, gap: 4,
    borderWidth: 1, borderColor: "transparent",
  },
  kvActive: {
    borderColor: theme.color.brand,
    backgroundColor: theme.color.brandTertiary,
  },
  kvHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kvKey: { color: theme.color.onSurfaceSecondary, fontSize: 11, flex: 1 },
  kvVal: { color: theme.color.onSurface, fontSize: 13, fontWeight: "700" },
  eyeBtn: { padding: 2 },
  rrCell: {
    width: "65.5%", backgroundColor: theme.color.surfaceTertiary,
    borderRadius: 10, padding: 10, gap: 6,
  },
  rrRow: { flexDirection: "row", gap: 6 },
  rrChip: {
    flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 999,
    borderWidth: 1, borderColor: theme.color.border,
    alignItems: "center", justifyContent: "center",
  },
  rrChipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  rrChipText: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  rrChipTextActive: { color: "#002233" },
  sectionLabel: {
    color: theme.color.onSurfaceSecondary, fontSize: 11,
    textTransform: "uppercase", letterSpacing: 1, marginTop: 4,
  },
  checklist: {
    backgroundColor: theme.color.surfaceTertiary, borderRadius: 12, padding: 12, gap: 10,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkTextWrap: { flex: 1 },
  checkText: { fontSize: 14, fontWeight: "600" },
  checkReason: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  checkReasonOk: { color: theme.color.brandSecondary },
  checkReasonFail: { color: theme.color.onSurfaceSecondary },
});
