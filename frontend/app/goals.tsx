import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useUserPrefs } from "@/src/UserPrefsContext";

export default function GoalDashboard() {
  const router = useRouter();
  const { formatMoney } = useUserPrefs();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  // edit form
  const [form, setForm] = useState<Record<string, string>>({});

  // log trade form
  const [tradeSym, setTradeSym] = useState("");
  const [tradePnl, setTradePnl] = useState("");
  const [tradeSide, setTradeSide] = useState("BUY");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.goalsSummary();
      setSummary(s);
      setForm({
        current_balance: String(s.goals.current_balance || ""),
        target_balance: String(s.goals.target_balance || ""),
        daily_profit_goal: String(s.goals.daily_profit_goal || ""),
        weekly_profit_goal: String(s.goals.weekly_profit_goal || ""),
        monthly_profit_goal: String(s.goals.monthly_profit_goal || ""),
        max_daily_loss: String(s.goals.max_daily_loss || ""),
        max_weekly_loss: String(s.goals.max_weekly_loss || ""),
      });
    } catch (e) {
      console.warn(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const saveGoals = async () => {
    try {
      const payload: any = {};
      Object.entries(form).forEach(([k, v]) => { payload[k] = parseFloat(v) || 0; });
      await api.saveGoals(payload);
      setEditOpen(false);
      await load();
    } catch (e) { console.warn(e); }
  };

  const logTrade = async () => {
    const pnl = parseFloat(tradePnl);
    if (!tradeSym.trim() || isNaN(pnl)) return;
    try {
      await api.logTrade({ symbol: tradeSym.trim().toUpperCase(), side: tradeSide, pnl });
      setLogOpen(false);
      setTradeSym(""); setTradePnl("");
      await load();
    } catch (e) { console.warn(e); }
  };

  if (loading && !summary) {
    return (
      <SafeAreaView edges={["top"]} style={styles.root}>
        <View style={styles.centered}><ActivityIndicator color={theme.color.brand} /></View>
      </SafeAreaView>
    );
  }

  const s = summary?.stats || {};
  const g = summary?.goals || {};

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="goal-dashboard">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>Goal Dashboard</Text>
        <Pressable testID="edit-goals-btn" onPress={() => setEditOpen(true)} style={styles.iconBtn}>
          <Ionicons name="create-outline" size={22} color={theme.color.brand} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.color.brand} />}
      >
        {/* Discipline banners */}
        {s.daily_goal_hit && (
          <View style={[styles.banner, { backgroundColor: theme.color.brandSecondary + "22", borderColor: theme.color.brandSecondary }]}>
            <Text style={[styles.bannerText, { color: theme.color.brandSecondary }]}>
              🎉 Daily goal achieved. Consider stopping for today.
            </Text>
          </View>
        )}
        {s.daily_loss_hit && (
          <View style={[styles.banner, { backgroundColor: theme.color.error + "22", borderColor: theme.color.error }]}>
            <Text style={[styles.bannerText, { color: theme.color.error }]}>
              ⚠ Daily loss limit reached. Trading is not recommended.
            </Text>
          </View>
        )}

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{formatMoney(s.current_balance || 0)}</Text>
          <View style={styles.balanceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balSub}>Target</Text>
              <Text style={styles.balSubVal}>{formatMoney(s.target_balance || 0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.balSub}>Remaining</Text>
              <Text style={[styles.balSubVal, { color: theme.color.brand }]}>{formatMoney(s.remaining_to_goal || 0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.balSub}>Progress</Text>
              <Text style={[styles.balSubVal, { color: theme.color.brandSecondary }]}>{s.total_progress_pct || 0}%</Text>
            </View>
          </View>
          <ProgressBar value={s.total_progress_pct || 0} color={theme.color.brandSecondary} />
        </View>

        {/* Goals with progress bars */}
        <SectionTitle text="Profit Goals" />
        <GoalRow
          label="Today's P&L"
          value={formatMoney(s.today_pnl || 0, { showSign: true })}
          progress={s.daily_progress_pct || 0}
          target={formatMoney(g.daily_profit_goal || 0)}
          color={(s.today_pnl || 0) >= 0 ? theme.color.brandSecondary : theme.color.error}
        />
        <GoalRow
          label="This Week"
          value={formatMoney(s.week_pnl || 0, { showSign: true })}
          progress={s.weekly_progress_pct || 0}
          target={formatMoney(g.weekly_profit_goal || 0)}
          color={(s.week_pnl || 0) >= 0 ? theme.color.brandSecondary : theme.color.error}
        />
        <GoalRow
          label="This Month"
          value={formatMoney(s.month_pnl || 0, { showSign: true })}
          progress={s.monthly_progress_pct || 0}
          target={formatMoney(g.monthly_profit_goal || 0)}
          color={(s.month_pnl || 0) >= 0 ? theme.color.brandSecondary : theme.color.error}
        />

        <SectionTitle text="Risk Limits" />
        <GoalRow
          label="Daily Loss Limit"
          value={formatMoney(Math.max(0, -(s.today_pnl || 0)))}
          progress={s.daily_loss_pct || 0}
          target={formatMoney(g.max_daily_loss || 0)}
          color={theme.color.error}
        />
        <GoalRow
          label="Weekly Loss Limit"
          value={formatMoney(Math.max(0, -(s.week_pnl || 0)))}
          progress={s.weekly_loss_pct || 0}
          target={formatMoney(g.max_weekly_loss || 0)}
          color={theme.color.error}
        />

        <SectionTitle text="Performance" />
        <View style={styles.perfGrid}>
          <PerfCard label="Win Rate" value={`${s.win_rate || 0}%`} color={theme.color.brand} />
          <PerfCard label="Total Trades" value={String(s.total_trades || 0)} color={theme.color.onSurface} />
          <PerfCard label="Consec Wins" value={String(s.consecutive_wins || 0)} color={theme.color.brandSecondary} />
          <PerfCard label="Consec Losses" value={String(s.consecutive_losses || 0)} color={theme.color.error} />
        </View>

        <Pressable testID="log-trade-btn" onPress={() => setLogOpen(true)} style={styles.logBtn}>
          <Ionicons name="add-circle" size={22} color="#002233" />
          <Text style={styles.logBtnText}>Log a Trade Result</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Set Goals</Text>
              <Pressable onPress={() => setEditOpen(false)}>
                <Ionicons name="close" size={22} color={theme.color.onSurfaceSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <GoalInput label="Current Balance ($)" value={form.current_balance} onChange={(v) => setForm({ ...form, current_balance: v })} testID="input-current" />
              <GoalInput label="Target Balance ($)" value={form.target_balance} onChange={(v) => setForm({ ...form, target_balance: v })} testID="input-target" />
              <GoalInput label="Daily Profit Goal ($)" value={form.daily_profit_goal} onChange={(v) => setForm({ ...form, daily_profit_goal: v })} testID="input-daily" />
              <GoalInput label="Weekly Profit Goal ($)" value={form.weekly_profit_goal} onChange={(v) => setForm({ ...form, weekly_profit_goal: v })} testID="input-weekly" />
              <GoalInput label="Monthly Profit Goal ($)" value={form.monthly_profit_goal} onChange={(v) => setForm({ ...form, monthly_profit_goal: v })} testID="input-monthly" />
              <GoalInput label="Max Daily Loss ($)" value={form.max_daily_loss} onChange={(v) => setForm({ ...form, max_daily_loss: v })} testID="input-max-daily" />
              <GoalInput label="Max Weekly Loss ($)" value={form.max_weekly_loss} onChange={(v) => setForm({ ...form, max_weekly_loss: v })} testID="input-max-weekly" />
            </ScrollView>
            <Pressable testID="save-goals-btn" onPress={saveGoals} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Goals</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Log trade modal */}
      <Modal visible={logOpen} animationType="slide" transparent onRequestClose={() => setLogOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Log Trade Result</Text>
              <Pressable onPress={() => setLogOpen(false)}>
                <Ionicons name="close" size={22} color={theme.color.onSurfaceSecondary} />
              </Pressable>
            </View>
            <GoalInput label="Symbol" value={tradeSym} onChange={setTradeSym} testID="log-symbol" caps />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {["BUY", "SELL"].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setTradeSide(s)}
                  style={[styles.sideBtn, tradeSide === s && { backgroundColor: s === "BUY" ? theme.color.brandSecondary : theme.color.error, borderColor: s === "BUY" ? theme.color.brandSecondary : theme.color.error }]}
                >
                  <Text style={[styles.sideBtnText, tradeSide === s && { color: "#002233" }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <GoalInput label="P&L ($, use minus for loss)" value={tradePnl} onChange={setTradePnl} testID="log-pnl" />
            <Pressable testID="submit-trade-btn" onPress={logTrade} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Trade</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ text }: any) { return <Text style={styles.sectionTitle}>{text}</Text>; }

function GoalRow({ label, value, progress, target, color }: any) {
  return (
    <View style={styles.goalRow}>
      <View style={styles.goalRowTop}>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={[styles.goalValue, { color }]}>{value}</Text>
      </View>
      <View style={styles.goalRowBot}>
        <ProgressBar value={progress} color={color} />
      </View>
      <View style={styles.goalRowTop}>
        <Text style={styles.goalSub}>{Math.round(progress)}%</Text>
        <Text style={styles.goalSub}>Target {target}</Text>
      </View>
    </View>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const w = Math.min(100, Math.max(0, value));
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${w}%`, backgroundColor: color }]} />
    </View>
  );
}

function PerfCard({ label, value, color }: any) {
  return (
    <View style={styles.perfCard}>
      <Text style={styles.perfK}>{label}</Text>
      <Text style={[styles.perfV, { color }]}>{value}</Text>
    </View>
  );
}

function GoalInput({ label, value, onChange, testID, caps }: any) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType={caps ? "default" : "decimal-pad"}
        autoCapitalize={caps ? "characters" : "none"}
        placeholder="0"
        placeholderTextColor={theme.color.onSurfaceSecondary}
        style={styles.input}
      />
    </View>
  );
}

function fmtMoney(n: number) {
  const num = Number(n) || 0;
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return num.toFixed(2);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 8,
    borderBottomColor: theme.color.border, borderBottomWidth: 1,
  },
  iconBtn: { padding: 8, minWidth: 40 },
  title: { flex: 1, textAlign: "center", color: theme.color.onSurface, fontSize: 17, fontWeight: "800" },
  scroll: { padding: 16, gap: 10 },
  banner: {
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 4,
  },
  bannerText: { fontSize: 14, fontWeight: "700" },
  balanceCard: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 16, padding: 16, gap: 10,
  },
  balanceLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  balanceValue: { color: theme.color.onSurface, fontSize: 32, fontWeight: "900" },
  balanceRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  balSub: { color: theme.color.onSurfaceSecondary, fontSize: 11 },
  balSubVal: { color: theme.color.onSurface, fontSize: 14, fontWeight: "700", marginTop: 2 },
  sectionTitle: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 12 },
  goalRow: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 12, padding: 12, gap: 6,
  },
  goalRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalRowBot: {},
  goalLabel: { color: theme.color.onSurface, fontSize: 14, fontWeight: "700" },
  goalValue: { fontSize: 15, fontWeight: "800" },
  goalSub: { color: theme.color.onSurfaceSecondary, fontSize: 11 },
  bar: { height: 6, borderRadius: 3, backgroundColor: theme.color.surfaceTertiary, overflow: "hidden" },
  barFill: { height: "100%" },
  perfGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  perfCard: {
    width: "48.5%", backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 12, padding: 12, gap: 4,
  },
  perfK: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  perfV: { fontSize: 22, fontWeight: "800" },
  logBtn: {
    marginTop: 12, backgroundColor: theme.color.brand,
    padding: 14, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  logBtnText: { color: "#002233", fontWeight: "800", fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: theme.color.surfaceSecondary,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, gap: 10, maxHeight: "85%",
  },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { color: theme.color.onSurface, fontSize: 17, fontWeight: "800" },
  inputLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: theme.color.surfaceTertiary, color: theme.color.onSurface,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  saveBtn: {
    backgroundColor: theme.color.brand, padding: 14, borderRadius: 12,
    alignItems: "center", marginTop: 6,
  },
  saveBtnText: { color: "#002233", fontWeight: "800", fontSize: 15 },
  sideBtn: {
    flex: 1, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceTertiary, borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  sideBtnText: { color: theme.color.onSurface, fontWeight: "700" },
});
