import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, TextInput,
  KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

export default function Settings() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { prefs, setName, setCurrency, setNotification, ratesUpdatedAt } = useUserPrefs();
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(prefs.display_name);
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentCurr = SUPPORTED_CURRENCIES.find((c) => c.code === prefs.currency) || SUPPORTED_CURRENCIES[0];

  const saveName = async () => {
    if (nameDraft.trim()) {
      await setName(nameDraft.trim());
      setEditName(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="settings-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <Section title="Profile">
          <Row icon="person-circle-outline" label="Name">
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
          </Row>
          {user?.email ? (
            <Row icon="mail-outline" label="Email">
              <Text style={styles.rowValue} numberOfLines={1}>{user.email}</Text>
            </Row>
          ) : null}
        </Section>

        {/* Currency */}
        <Section title="Currency Preference" caption="Applied to all money values (balance, goals, calculator).">
          <Pressable
            testID="currency-picker-open"
            onPress={() => setPickerOpen(true)}
            style={styles.currencyRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Currency</Text>
              <Text style={styles.currencyVal}>{currentCurr.symbol} · {currentCurr.code} · {currentCurr.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.color.onSurfaceSecondary} />
          </Pressable>
          {ratesUpdatedAt ? (
            <Text style={styles.caption}>Rates updated: {new Date(ratesUpdatedAt).toLocaleString()}</Text>
          ) : null}
        </Section>

        {/* Notifications */}
        <Section title="Notifications" caption="Pick what pings you. Others are silent.">
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

        {/* Account */}
        <Section title="Account">
          <Pressable testID="sign-out-row" onPress={signOut} style={styles.signOutRow}>
            <Ionicons name="log-out-outline" size={20} color={theme.color.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Currency picker modal */}
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
                    <View style={styles.currBadge}>
                      <Text style={styles.currBadgeText}>{c.symbol}</Text>
                    </View>
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

function Row({ icon, label, children }: any) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={theme.color.onSurfaceSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 8,
    borderBottomColor: theme.color.border, borderBottomWidth: 1,
  },
  iconBtn: { padding: 8, minWidth: 40 },
  title: { flex: 1, textAlign: "center", color: theme.color.onSurface, fontSize: 17, fontWeight: "800" },
  scroll: { padding: 16, gap: 8 },
  section: { gap: 6, marginBottom: 12 },
  sectionTitle: { color: theme.color.onSurfaceSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 4 },
  sectionBody: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 12, overflow: "hidden",
  },
  caption: { color: theme.color.onSurfaceSecondary, fontSize: 11, paddingHorizontal: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { color: theme.color.onSurface, fontSize: 14, fontWeight: "600" },
  rowValue: { color: theme.color.onSurfaceSecondary, fontSize: 14 },
  nameInput: {
    backgroundColor: theme.color.surfaceTertiary, color: theme.color.onSurface,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, minWidth: 140,
  },
  saveTick: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: theme.color.brand,
    alignItems: "center", justifyContent: "center",
  },
  currencyRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },
  currencyVal: { color: theme.color.brand, fontSize: 14, fontWeight: "700", marginTop: 2 },
  notifRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  signOutRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  signOutText: { color: theme.color.error, fontSize: 15, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: theme.color.surfaceSecondary,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 12, gap: 8, maxHeight: "70%",
  },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 6 },
  modalTitle: { color: theme.color.onSurface, fontSize: 17, fontWeight: "800" },
  currencyOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 10, marginBottom: 4,
  },
  currencyOptionActive: { backgroundColor: theme.color.brandTertiary },
  currBadge: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: theme.color.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  currBadgeText: { color: theme.color.brand, fontSize: 16, fontWeight: "800" },
  currOptCode: { color: theme.color.onSurface, fontSize: 15, fontWeight: "700" },
  currOptLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
});
