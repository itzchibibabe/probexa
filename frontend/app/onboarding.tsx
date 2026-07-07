import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useUserPrefs } from "@/src/UserPrefsContext";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";

const NOTIF_OPTIONS = [
  { key: "a_plus_ready" as const, label: "A+ Ready Alerts", desc: "When a scanned coin hits an A+ setup." },
  { key: "watchlist" as const, label: "Watchlist Alerts", desc: "Big moves on coins you're watching." },
  { key: "daily_goal_achieved" as const, label: "Daily Goal Achieved", desc: "A friendly stop-signal when you hit your target." },
  { key: "daily_loss_reached" as const, label: "Daily Loss Limit Reached", desc: "Warning when you hit your risk cap." },
  { key: "daily_summary" as const, label: "Daily Market Summary", desc: "Once-a-day recap of top setups." },
];

type Step = "name" | "notifications";

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { setName, prefs, setNotification } = useUserPrefs();
  const [step, setStep] = useState<Step>("name");
  const [name, setLocalName] = useState(user?.name?.split(" ")[0] || "");
  const [busy, setBusy] = useState(false);

  const goNext = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await setName(trimmed);
      setStep("notifications");
    } finally { setBusy(false); }
  };

  const requestPushAndFinish = async () => {
    setBusy(true);
    try {
      if (Platform.OS !== "web") {
        const perm = await Notifications.getPermissionsAsync();
        let status = perm.status;
        if (status !== "granted" && perm.canAskAgain !== false) {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status === "granted") {
          try {
            const tokenResp = await Notifications.getDevicePushTokenAsync();
            if (user) {
              await api.registerPush(user.user_id, Platform.OS, tokenResp.data);
            }
          } catch {}
        }
      }
      router.replace("/(tabs)");
    } finally { setBusy(false); }
  };

  const skipPush = () => router.replace("/(tabs)");

  return (
    <SafeAreaView style={styles.root} testID="onboarding-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {step === "name" ? (
          <View style={styles.container}>
            <View style={styles.hero}>
              <View style={styles.logoRing}>
                <Ionicons name="hand-right" size={40} color={theme.color.brand} />
              </View>
              <Text style={styles.title}>What should we call you?</Text>
              <Text style={styles.subtitle}>Probexa will greet you and use your name in important alerts.</Text>
            </View>
            <View style={styles.form}>
              <TextInput
                testID="onboarding-name-input"
                value={name}
                onChangeText={setLocalName}
                placeholder="Your first name"
                placeholderTextColor={theme.color.onSurfaceSecondary}
                autoFocus
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={goNext}
              />
              <Pressable
                testID="onboarding-name-continue"
                onPress={goNext}
                disabled={!name.trim() || busy}
                style={[styles.cta, (!name.trim() || busy) && { opacity: 0.5 }]}
              >
                <Text style={styles.ctaText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#002233" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.container}>
            <View style={styles.hero}>
              <View style={styles.logoRing}>
                <Ionicons name="notifications" size={40} color={theme.color.brand} />
              </View>
              <Text style={styles.title}>Stay ahead, {prefs.display_name} 👋</Text>
              <Text style={styles.subtitle}>Get pinged only for what matters. You can change these anytime in Settings.</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
              {NOTIF_OPTIONS.map((o) => (
                <View key={o.key} style={styles.notifRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifLabel}>{o.label}</Text>
                    <Text style={styles.notifDesc}>{o.desc}</Text>
                  </View>
                  <Switch
                    testID={`notif-${o.key}`}
                    value={prefs.notifications[o.key]}
                    onValueChange={(v) => setNotification(o.key, v)}
                    trackColor={{ true: theme.color.brand, false: theme.color.surfaceTertiary }}
                    thumbColor={prefs.notifications[o.key] ? "#002233" : theme.color.onSurfaceSecondary}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={{ gap: 8 }}>
              <Pressable testID="onboarding-enable-push" onPress={requestPushAndFinish} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
                <Ionicons name="notifications" size={18} color="#002233" />
                <Text style={styles.ctaText}>Enable Notifications</Text>
              </Pressable>
              <Pressable testID="onboarding-skip-push" onPress={skipPush} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Not now</Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  container: { flex: 1, padding: 24, gap: 20 },
  hero: { alignItems: "center", gap: 12, marginTop: 16 },
  logoRing: {
    width: 72, height: 72, borderRadius: 36,
    borderColor: theme.color.brand, borderWidth: 2,
    backgroundColor: theme.color.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { color: theme.color.onSurfaceSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },
  form: { flex: 1, justifyContent: "center", gap: 14 },
  input: {
    backgroundColor: theme.color.surfaceSecondary, borderColor: theme.color.border, borderWidth: 1,
    color: theme.color.onSurface, borderRadius: 12, padding: 16, fontSize: 18,
  },
  cta: {
    backgroundColor: theme.color.brand, borderRadius: 12, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  ctaText: { color: "#002233", fontSize: 16, fontWeight: "800" },
  ghostBtn: { padding: 12, alignItems: "center" },
  ghostText: { color: theme.color.onSurfaceSecondary, fontSize: 14 },
  notifRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    borderRadius: 12, padding: 14,
  },
  notifLabel: { color: theme.color.onSurface, fontSize: 15, fontWeight: "700" },
  notifDesc: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
});
