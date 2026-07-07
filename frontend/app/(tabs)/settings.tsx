import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, TextInput,
  Modal, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { useUserPrefs, SUPPORTED_CURRENCIES } from "@/src/UserPrefsContext";
import { useAuth } from "@/src/AuthContext";

const NOTIF_OPTIONS = [
  { key: "a_plus_ready" as const, label: "A+ Ready Alerts", desc: "Coin hits an A+ setup." },
  { key: "watchlist" as const, label: "Watchlist Alerts", desc: "Big moves on your watchlist." },
  { key: "daily_goal_achieved" as const, label: "Daily Goal Achieved", desc: "Friendly stop-signal at your target." },
  { key: "daily_loss_reached" as const, label: "Daily Loss Limit Reached", desc: "Warning when you hit your risk cap." },
  { key: "daily_summary" as const, label: "Daily Market Summary", desc: "Once-a-day recap of top setups." },
];

const ABOUT_TEXT =
  "Probexa is an intelligent trading assistant that scans the entire perpetual futures market and only surfaces setups when the odds are on your side. It never forces a trade — WAIT is a signal.\n\nAll analysis is rule-based (Trend, Structure, EMA, RSI, MACD, Volume, S/R, R:R). AI is used only internally to verify A+ candidates. You always see the final conclusion, never a chatbot.";

const PRIVACY_TEXT =
  "We store only what's necessary: your name (used for greetings), currency preference, notification choices, watchlist symbols, and trade journal entries you create. No exchange keys or wallet access is required.\n\nMarket data is served through public exchange APIs. We do not sell, share or advertise on your data. You may delete your account at any time by signing out and asking support to purge your records.\n\nTerms: Probexa is a research and education tool, not financial advice. Trading crypto futures involves substantial risk of loss. Always trade with capital you can afford to lose.";

export default function SettingsTab() {
  const { signOut, user } = useAuth();
  const { prefs, setName, setCurrency, setNotification, ratesUpdatedAt, formatMoney, currencySymbol } = useUserPrefs();
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(prefs.display_name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const currentCurr = SUPPORTED_CURRENCIES.find((c) => c.code === prefs.currency) || SUPPORTED_CURRENCIES[0];

  const saveName = async () => {
    if (nameDraft.trim()) {
      await setName(nameDraft.trim());
      setEditName(false);
    }
  };

  const setAdvanced = async (_key: "liquidity_sweep_detection" | "higher_timeframe_confirmation", _v: boolean) => {
    // handled via server-side prefs — for now UI shows local, save via savePrefs
    const nextAdvanced = { ...(prefs as any).advanced, [_key]: _v };
    (prefs as any).advanced = nextAdvanced;
    const { api } = await import("@/src/api");
    try { await api.savePrefs({ advanced: { [_key]: _v } }); } catch {}
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="settings-tab">
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* PROFILE */}
        <Section title="Profile">
          <View style={styles.row}>
            <Ionicons name="person-circle-outline" size={20} color={theme.color.onSurfaceSecondary} />
            <Text style={styles.rowLabel}>Name</Text>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              {editName ? (
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TextInput
                    testID="settings-name-input"
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    onSubmitEditing={saveName}
                    style={styles.nameInput}
                    autoFocus
                    placeholder="Name"
                    placeholderTextColor={theme.color.onSurfaceSecondary}
                  />
                  <Pressable testID="save-name-btn" onPress={saveName} style={styles.saveTick}>
                    <Ionicons name="checkmark" size={18} color="#002233" />
                  </Pressable>
                </View>
              ) : (
                <Pressable testID="edit-name-btn" onPress={() => { setNameDraft(prefs.display_name); setEditName(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.rowValue}>{prefs.display_name || "Set name"}</Text>
                  <Ionicons name="create-outline" size={16} color={theme.color.brand} />
                </Pressable>
              )}
            </View>
          </View>
        </Section>

        {/* CURRENCY */}
        <Section title="Currency Preference" caption="Applied to all money values (balance, goals, calculator).">
          <Pressable testID="currency-picker-open" onPress={() => setPickerOpen(true)} style={styles.currencyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Currency</Text>
              <Text style={styles.currencyVal}>{currentCurr.symbol} · {currentCurr.code} · {currentCurr.label}</Text>
              <Text style={styles.caption}>Example: {formatMoney(1000)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.color.onSurfaceSecondary} />
          </Pressable>
          {ratesUpdatedAt ? <Text style={styles.caption}>Rates updated: {new Date(ratesUpdatedAt).toLocaleString()}</Text> : null}
        </Section>

        {/* NOTIFICATIONS */}
        <Section title="Notification Preferences" caption="Pick what pings you. Others are silent.">
          {NOTIF_OPTIONS.map((o) => (
            <View key={o.key} style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{o.label}</Text>
                <Text style={styles.caption}>{o.desc}</Text>
              </View>
              <Switch
                testID={`settings-notif-${o.key}`}
                value={prefs.notifications[o.key]}
                onValueChange={(v) => setNotification(o.key, v)}
                trackColor={{ true: theme.color.brand, false: theme.color.surfaceTertiary }}
                thumbColor={prefs.notifications[o.key] ? "#002233" : theme.color.onSurfaceSecondary}
              />
            </View>
          ))}
        </Section>

        {/* ADVANCED ANALYSIS */}
        <Section title="Advanced Analysis" caption="Optional filters that improve setup quality.">
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Liquidity Sweep Detection</Text>
              <Text style={styles.caption}>Detects fake breakouts and liquidity grabs.</Text>
            </View>
            <Switch
              testID="adv-liq-sweep"
              value={!!(prefs as any).advanced?.liquidity_sweep_detection}
              onValueChange={(v) => setAdvanced("liquidity_sweep_detection", v)}
              trackColor={{ true: theme.color.brand, false: theme.color.surfaceTertiary }}
              thumbColor={(prefs as any).advanced?.liquidity_sweep_detection ? "#002233" : theme.color.onSurfaceSecondary}
            />
          </View>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Higher Timeframe Confirmation</Text>
              <Text style={styles.caption}>A+ only if the next higher timeframe agrees.</Text>
            </View>
            <Switch
              testID="adv-htf"
              value={!!(prefs as any).advanced?.higher_timeframe_confirmation}
              onValueChange={(v) => setAdvanced("higher_timeframe_confirmation", v)}
              trackColor={{ true: theme.color.brand, false: theme.color.surfaceTertiary }}
              thumbColor={(prefs as any).advanced?.higher_timeframe_confirmation ? "#002233" : theme.color.onSurfaceSecondary}
            />
          </View>
        </Section>

        {/* ACCOUNT */}
        <Section title="Account Information">
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color={theme.color.onSurfaceSecondary} />
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={[styles.rowValue, { flex: 1, textAlign: "right" }]} numberOfLines={1}>{user?.email || "-"}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="finger-print" size={20} color={theme.color.onSurfaceSecondary} />
            <Text style={styles.rowLabel}>User ID</Text>
            <Text style={[styles.rowValue, { flex: 1, textAlign: "right" }]} numberOfLines={1}>{user?.user_id || "-"}</Text>
          </View>
        </Section>

        {/* ABOUT + PRIVACY */}
        <Section title="Support & Legal">
          <Pressable testID="about-row" onPress={() => setAboutOpen(true)} style={styles.linkRow}>
            <Ionicons name="information-circle-outline" size={20} color={theme.color.onSurfaceSecondary} />
            <Text style={styles.rowLabel}>About Probexa</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.color.onSurfaceSecondary} />
          </Pressable>
          <Pressable testID="privacy-row" onPress={() => setPrivacyOpen(true)} style={styles.linkRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.color.onSurfaceSecondary} />
            <Text style={styles.rowLabel}>Privacy Policy & Terms</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.color.onSurfaceSecondary} />
          </Pressable>
        </Section>

        {/* LOGOUT */}
        <Pressable testID="logout-row" onPress={() => setConfirmSignOut(true)} style={styles.logoutRow}>
          <Ionicons name="log-out-outline" size={20} color={theme.color.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={styles.footer}>Probexa v1.0 · Only High-Probability Setups.</Text>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Currency picker */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <Pressable onPress={() => setPickerOpen(false)}><Ionicons name="close" size={22} color={theme.color.onSurfaceSecondary} /></Pressable>
            </View>
            <ScrollView>
              {SUPPORTED_CURRENCIES.map((c) => {
                const active = c.code === prefs.currency;
                return (
                  <Pressable
                    key={c.code}
                    testID={`currency-option-${c.code}`}
                    onPress={async () => { await setCurrency(c.code); setPickerOpen(false); }}
                    style={[styles.currencyOption, active && styles.currencyOptionActive]}
                  >
                    <View style={styles.currBadge}><Text style={styles.currBadgeText}>{c.symbol}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.currOptCode}>{c.code}</Text>
                      <Text style={styles.currOptLabel}>{c.label}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={theme.color.brand} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* About */}
      <TextSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} title="About Probexa" body={ABOUT_TEXT} />
      {/* Privacy */}
      <TextSheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy Policy & Terms" body={PRIVACY_TEXT} />

      {/* Confirm sign-out */}
      <Modal visible={confirmSignOut} animationType="fade" transparent onRequestClose={() => setConfirmSignOut(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Ionicons name="log-out-outline" size={36} color={theme.color.error} />
            <Text style={styles.confirmTitle}>Log out of Probexa?</Text>
            <Text style={styles.confirmSub}>Your data stays saved. You can sign back in anytime.</Text>
            <View style={{ flexDirection: "row", gap: 8, width: "100%", marginTop: 4 }}>
              <Pressable style={[styles.confirmBtn, { backgroundColor: theme.color.surfaceTertiary }]} onPress={() => setConfirmSignOut(false)}>
                <Text style={{ color: theme.color.onSurface, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable testID="confirm-signout-btn" style={[styles.confirmBtn, { backgroundColor: theme.color.error }]} onPress={async () => { setConfirmSignOut(false); await signOut(); }}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>Log Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, caption, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function TextSheet({ visible, onClose, title, body }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: "80%" }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.color.onSurfaceSecondary} /></Pressable>
          </View>
          <ScrollView>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800" },
  scroll: { padding: 16, gap: 8 },
  section: { gap: 6, marginBottom: 12 },
  sectionTitle: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 4 },
  sectionBody: { backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  caption: { color: theme.color.onSurfaceSecondary, fontSize: 11, paddingHorizontal: 4, marginTop: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { color: theme.color.onSurface, fontSize: 14, fontWeight: "600" },
  rowValue: { color: theme.color.onSurfaceSecondary, fontSize: 14 },
  nameInput: { backgroundColor: theme.color.surfaceTertiary, color: theme.color.onSurface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, minWidth: 140 },
  saveTick: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center" },
  currencyRow: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  currencyVal: { color: theme.color.brand, fontSize: 14, fontWeight: "700", marginTop: 2 },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth },
  logoutRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.error + "66", borderWidth: 1,
    borderRadius: 12, padding: 14, marginTop: 8,
  },
  logoutText: { color: theme.color.error, fontSize: 15, fontWeight: "800" },
  footer: { color: theme.color.onSurfaceSecondary, fontSize: 11, textAlign: "center", marginTop: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.color.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, gap: 8, maxHeight: "70%" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 6 },
  modalTitle: { color: theme.color.onSurface, fontSize: 17, fontWeight: "800" },
  body: { color: theme.color.onSurface, fontSize: 14, lineHeight: 22, padding: 10 },
  currencyOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, marginBottom: 4 },
  currencyOptionActive: { backgroundColor: theme.color.brandTertiary },
  currBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.color.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  currBadgeText: { color: theme.color.brand, fontSize: 16, fontWeight: "800" },
  currOptCode: { color: theme.color.onSurface, fontSize: 15, fontWeight: "700" },
  currOptLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 24 },
  confirmCard: { backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 10 },
  confirmTitle: { color: theme.color.onSurface, fontSize: 17, fontWeight: "800", textAlign: "center" },
  confirmSub: { color: theme.color.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
});
