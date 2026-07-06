import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/AuthContext";
import { theme } from "@/src/theme";

export default function LoginScreen() {
  const { signIn, loading } = useAuth();
  const [busy, setBusy] = React.useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch (e) {
      console.warn(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="login-screen">
      <LinearGradient
        colors={["#0B0E14", "#131722", "#0B0E14"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.top}>
        <View style={styles.logoRing}>
          <Ionicons name="trending-up" size={44} color={theme.color.brand} />
        </View>
        <Text style={styles.brand}>A+ Crypto Futures AI</Text>
        <Text style={styles.tag}>A+ setups only. Never guess. Capital first.</Text>
      </View>

      <View style={styles.middle}>
        {[
          { icon: "flash-outline", txt: "Live OKX futures data" },
          { icon: "analytics-outline", txt: "AI-graded A+ trade setups" },
          { icon: "shield-checkmark-outline", txt: "Beginner-friendly explanations" },
        ].map((f) => (
          <View key={f.icon} style={styles.feature}>
            <Ionicons name={f.icon as any} size={20} color={theme.color.brand} />
            <Text style={styles.featureTxt}>{f.txt}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bottom}>
        <Pressable
          testID="google-signin-button"
          onPress={handleSignIn}
          disabled={busy || loading}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          {busy ? (
            <ActivityIndicator color="#002233" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#002233" />
              <Text style={styles.ctaText}>Continue with Google</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.legal}>By continuing you accept trading risk disclosure.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface, paddingHorizontal: 24 },
  top: { alignItems: "center", marginTop: 40 },
  logoRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: theme.color.brand,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16, backgroundColor: theme.color.surfaceSecondary,
  },
  brand: { color: theme.color.onSurface, fontSize: 26, fontWeight: "800", letterSpacing: 0.5 },
  tag: { color: theme.color.onSurfaceSecondary, fontSize: 14, marginTop: 8, textAlign: "center" },
  middle: { flex: 1, justifyContent: "center", gap: 16 },
  feature: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.border, borderWidth: 1,
    padding: 16, borderRadius: 12,
  },
  featureTxt: { color: theme.color.onSurface, fontSize: 15 },
  bottom: { paddingBottom: Platform.OS === "ios" ? 24 : 32, gap: 12 },
  cta: {
    backgroundColor: theme.color.brand,
    paddingVertical: 16, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  ctaText: { color: "#002233", fontSize: 16, fontWeight: "700" },
  legal: { color: theme.color.onSurfaceSecondary, textAlign: "center", fontSize: 12 },
});
