import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

type Tab = "calc" | "edu";

const EDU = [
  { q: "What is Entry Price?", a: "The exact price at which you plan to open the trade. Wait for confirmation (like a retest) before entering." },
  { q: "What is Stop Loss (SL)?", a: "The price where you exit the trade to prevent bigger losses. It protects your capital when the market goes against you." },
  { q: "What are Take Profits (TP1/TP2/TP3)?", a: "Levels where you scale out of the trade to lock in gains gradually. TP1 secures a quick win, TP3 targets extended moves." },
  { q: "What is Risk to Reward (R:R)?", a: "It compares how much you risk to how much you can gain. A minimum 1:2 is required for A+ setups: risk $1 to make $2+." },
  { q: "What is Market Structure (HH-HL / LH-LL)?", a: "Bullish structure = Higher Highs + Higher Lows. Bearish = Lower Highs + Lower Lows. Trade in the direction of structure." },
  { q: "What is BOS and CHOCH?", a: "BOS (Break of Structure) confirms trend continuation. CHOCH (Change of Character) signals a possible trend reversal." },
  { q: "What is a Retest?", a: "After price breaks a level, it often returns to test that level. Entering on a successful retest gives better R:R and confirmation." },
  { q: "Why is Volume important?", a: "Breakouts with high volume are more reliable. Low-volume moves often reverse (fake breakouts)." },
];

export default function Tools() {
  const [tab, setTab] = useState<Tab>("calc");
  const [balance, setBalance] = useState("1000");
  const [risk, setRisk] = useState("1");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp1, setTp1] = useState("");
  const [tp2, setTp2] = useState("");
  const [tp3, setTp3] = useState("");
  const [lev, setLev] = useState("10");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const calc = async () => {
    setBusy(true);
    try {
      const r = await api.calculator({
        balance: parseFloat(balance) || 0,
        risk_pct: parseFloat(risk) || 0,
        entry: parseFloat(entry) || 0,
        stop_loss: parseFloat(sl) || 0,
        leverage: parseFloat(lev) || 1,
        tp1: tp1 ? parseFloat(tp1) : null,
        tp2: tp2 ? parseFloat(tp2) : null,
        tp3: tp3 ? parseFloat(tp3) : null,
      });
      setResult(r);
    } catch (e) { console.warn(e); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="tools-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Tools</Text>
      </View>

      <View style={styles.seg}>
        <Pressable testID="tab-calc" onPress={() => setTab("calc")} style={[styles.segBtn, tab === "calc" && styles.segActive]}>
          <Text style={[styles.segText, tab === "calc" && styles.segTextActive]}>Calculator</Text>
        </Pressable>
        <Pressable testID="tab-edu" onPress={() => setTab("edu")} style={[styles.segBtn, tab === "edu" && styles.segActive]}>
          <Text style={[styles.segText, tab === "edu" && styles.segTextActive]}>Education</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {tab === "calc" ? (
            <>
              <View style={styles.grid}>
                <Field label="Balance ($)" value={balance} onChange={setBalance} testID="calc-balance" />
                <Field label="Risk (%)" value={risk} onChange={setRisk} testID="calc-risk" />
                <Field label="Leverage" value={lev} onChange={setLev} testID="calc-lev" />
                <Field label="Entry" value={entry} onChange={setEntry} testID="calc-entry" />
                <Field label="Stop Loss" value={sl} onChange={setSl} testID="calc-sl" />
                <Field label="TP1" value={tp1} onChange={setTp1} testID="calc-tp1" />
                <Field label="TP2" value={tp2} onChange={setTp2} testID="calc-tp2" />
                <Field label="TP3" value={tp3} onChange={setTp3} testID="calc-tp3" />
              </View>
              <Pressable testID="calc-btn" onPress={calc} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
                <Ionicons name="calculator" size={20} color="#002233" />
                <Text style={styles.ctaText}>Calculate Position</Text>
              </Pressable>
              {result && (
                <View style={styles.resultCard}>
                  <R k="Position Size (units)" v={result.position_units} />
                  <R k="Position Notional ($)" v={result.position_notional} />
                  <R k="Margin Required ($)" v={result.margin_required} />
                  <R k="Max Loss ($)" v={result.max_loss} accent={theme.color.error} />
                  <R k="Profit at TP1 ($)" v={result.profit_tp1} accent={theme.color.brandSecondary} />
                  <R k="Profit at TP2 ($)" v={result.profit_tp2} accent={theme.color.brandSecondary} />
                  <R k="Profit at TP3 ($)" v={result.profit_tp3} accent={theme.color.brandSecondary} />
                </View>
              )}
            </>
          ) : (
            <View style={{ gap: 10 }}>
              {EDU.map((e, i) => (
                <View key={i} style={styles.eduCard}>
                  <Text style={styles.eduQ}>{e.q}</Text>
                  <Text style={styles.eduA}>{e.a}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

function R({ k, v, accent }: { k: string; v: any; accent?: string }) {
  return (
    <View style={styles.rRow}>
      <Text style={styles.rK}>{k}</Text>
      <Text style={[styles.rV, accent ? { color: accent } : null]}>{v ?? "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800" },
  seg: {
    marginHorizontal: 16, marginBottom: 8,
    flexDirection: "row", backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1, borderRadius: 10, padding: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  segActive: { backgroundColor: theme.color.brand },
  segText: { color: theme.color.onSurfaceSecondary, fontWeight: "700" },
  segTextActive: { color: "#002233" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  field: { width: "48.5%", gap: 4 },
  fieldLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12 },
  input: {
    backgroundColor: theme.color.surfaceSecondary, color: theme.color.onSurface,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  cta: {
    backgroundColor: theme.color.brand, padding: 14, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4,
  },
  ctaText: { color: "#002233", fontWeight: "800", fontSize: 15 },
  resultCard: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 12, padding: 14, gap: 6,
  },
  rRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rK: { color: theme.color.onSurfaceSecondary, fontSize: 13 },
  rV: { color: theme.color.onSurface, fontSize: 14, fontWeight: "700" },
  eduCard: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 12, padding: 14, gap: 6,
  },
  eduQ: { color: theme.color.brand, fontSize: 14, fontWeight: "700" },
  eduA: { color: theme.color.onSurface, fontSize: 13, lineHeight: 19 },
});
