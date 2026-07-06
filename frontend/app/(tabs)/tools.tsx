import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

/**
 * Smart Position Calculator.
 *
 * User enters: Wallet Balance, Risk %, Leverage.
 * Trade setup (Entry, Stop Loss, Take Profit) can be pre-filled from URL params (from analyze detail).
 * Auto-computes: Recommended Margin, Position Size, Max Loss, Expected Profit, Risk:Reward.
 */
export default function Tools() {
  const params = useLocalSearchParams<{
    symbol?: string; entry?: string; sl?: string;
    tp1?: string; tp2?: string; tp3?: string;
  }>();

  const [symbol, setSymbol] = useState((params.symbol || "").toString());
  const [balance, setBalance] = useState("1000");
  const [risk, setRisk] = useState("1");
  const [leverage, setLeverage] = useState("10");
  const [entry, setEntry] = useState((params.entry || "").toString());
  const [sl, setSl] = useState((params.sl || "").toString());
  const [tp1, setTp1] = useState((params.tp1 || "").toString());
  const [tp2, setTp2] = useState((params.tp2 || "").toString());
  const [tp3, setTp3] = useState((params.tp3 || "").toString());

  // Update fields when URL params change (navigating from detail page)
  useEffect(() => {
    if (params.entry) setEntry(String(params.entry));
    if (params.sl) setSl(String(params.sl));
    if (params.tp1) setTp1(String(params.tp1));
    if (params.tp2) setTp2(String(params.tp2));
    if (params.tp3) setTp3(String(params.tp3));
    if (params.symbol) setSymbol(String(params.symbol));
  }, [params.entry, params.sl, params.tp1, params.tp2, params.tp3, params.symbol]);

  // Client-side calculation for instant response
  const calc = useMemo(() => {
    const bal = parseFloat(balance) || 0;
    const rPct = parseFloat(risk) || 0;
    const lev = Math.max(parseFloat(leverage) || 1, 1);
    const e = parseFloat(entry) || 0;
    const s = parseFloat(sl) || 0;
    const t1 = parseFloat(tp1) || 0;
    const t2 = parseFloat(tp2) || 0;
    const t3 = parseFloat(tp3) || 0;
    if (bal <= 0 || rPct <= 0 || e <= 0 || s <= 0 || e === s) {
      return null;
    }
    const riskAmount = bal * (rPct / 100);
    const perUnit = Math.abs(e - s);
    const units = riskAmount / perUnit;
    const notional = units * e;
    const margin = notional / lev;
    const maxLoss = riskAmount;
    const rr = t1 > 0 ? Math.abs(t1 - e) / perUnit : 0;
    const profit = (tp: number) => (tp > 0 ? Math.round(Math.abs(tp - e) * units * 100) / 100 : null);
    return {
      units: round(units, 6),
      notional: round(notional, 2),
      margin: round(margin, 2),
      maxLoss: round(maxLoss, 2),
      rr: round(rr, 2),
      profit1: profit(t1),
      profit2: profit(t2),
      profit3: profit(t3),
      expected: profit(t1),
    };
  }, [balance, risk, leverage, entry, sl, tp1, tp2, tp3]);

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="tools-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Smart Position Calculator</Text>
        {symbol ? <Text style={styles.subtitle}>{symbol}</Text> : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Account inputs */}
          <SectionHeader label="Your Account" />
          <View style={styles.grid}>
            <Field label="Wallet Balance ($)" value={balance} onChange={setBalance} testID="calc-balance" />
            <Field label="Risk %" value={risk} onChange={setRisk} testID="calc-risk" />
            <Field label="Leverage" value={leverage} onChange={setLeverage} testID="calc-lev" />
          </View>

          {/* Trade setup inputs */}
          <SectionHeader label="Trade Setup" caption={symbol ? "Pre-filled from analysis" : "Enter or open from a coin"} />
          <View style={styles.grid}>
            <Field label="Entry" value={entry} onChange={setEntry} testID="calc-entry" />
            <Field label="Stop Loss" value={sl} onChange={setSl} testID="calc-sl" />
            <Field label="TP1" value={tp1} onChange={setTp1} testID="calc-tp1" />
            <Field label="TP2" value={tp2} onChange={setTp2} testID="calc-tp2" />
            <Field label="TP3" value={tp3} onChange={setTp3} testID="calc-tp3" />
          </View>

          {/* Result card */}
          <SectionHeader label="Result" />
          {calc ? (
            <View style={styles.result} testID="calc-result">
              <ResultRow k="Recommended Margin" v={`$${calc.margin}`} accent={theme.color.brand} highlight />
              <ResultRow k="Position Size (units)" v={calc.units.toString()} />
              <ResultRow k="Position Notional" v={`$${calc.notional}`} />
              <ResultRow k="Maximum Loss" v={`$${calc.maxLoss}`} accent={theme.color.error} highlight />
              {calc.expected != null && <ResultRow k="Expected Profit (TP1)" v={`$${calc.expected}`} accent={theme.color.brandSecondary} highlight />}
              <ResultRow k="Risk : Reward" v={calc.rr ? `1 : ${calc.rr}` : "-"} />

              {(calc.profit2 != null || calc.profit3 != null) && <View style={styles.divider} />}
              {calc.profit2 != null && <ResultRow k="Profit at TP2" v={`$${calc.profit2}`} accent={theme.color.brandSecondary} />}
              {calc.profit3 != null && <ResultRow k="Profit at TP3" v={`$${calc.profit3}`} accent={theme.color.brandSecondary} />}
            </View>
          ) : (
            <View style={styles.emptyResult}>
              <Ionicons name="calculator-outline" size={28} color={theme.color.onSurfaceSecondary} />
              <Text style={styles.emptyText}>Fill in balance, risk %, entry and stop loss.</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionHeader({ label, caption }: { label: string; caption?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {caption ? <Text style={styles.sectionCap}>{caption}</Text> : null}
    </View>
  );
}

function Field({ label, value, onChange, testID }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={theme.color.onSurfaceSecondary}
        keyboardType="decimal-pad"
        style={styles.input}
      />
    </View>
  );
}

function ResultRow({ k, v, accent, highlight }: { k: string; v: string; accent?: string; highlight?: boolean }) {
  return (
    <View style={[styles.resRow, highlight && styles.resRowHi]}>
      <Text style={styles.resK}>{k}</Text>
      <Text style={[styles.resV, accent ? { color: accent } : null]}>{v}</Text>
    </View>
  );
}

function round(n: number, d: number) {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  title: { color: theme.color.onSurface, fontSize: 20, fontWeight: "800" },
  subtitle: { color: theme.color.brand, fontSize: 12, marginTop: 2, fontWeight: "700" },
  scroll: { padding: 16, gap: 12 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 },
  sectionLabel: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  sectionCap: { color: theme.color.onSurfaceSecondary, fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  field: { width: "48.5%", gap: 4 },
  fieldLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12 },
  input: {
    backgroundColor: theme.color.surfaceSecondary, color: theme.color.onSurface,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  result: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 14, padding: 14, gap: 2,
  },
  resRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10,
  },
  resRowHi: {
    backgroundColor: theme.color.surfaceTertiary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 10,
  },
  resK: { color: theme.color.onSurfaceSecondary, fontSize: 13 },
  resV: { color: theme.color.onSurface, fontSize: 15, fontWeight: "800" },
  divider: { height: 1, backgroundColor: theme.color.border, marginVertical: 6 },
  emptyResult: {
    alignItems: "center", padding: 24, gap: 8,
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 12,
  },
  emptyText: { color: theme.color.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
});
