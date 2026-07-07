import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, View, ActivityIndicator } from "react-native";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/AuthContext";
import { UserPrefsProvider, useUserPrefs } from "@/src/UserPrefsContext";
import { theme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

// Prewarm splash for icon fonts
SplashScreen.preventAutoHideAsync();

// Push notifications — module scope
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function AuthGate() {
  const { loading, user } = useAuth();
  const { ready: prefsReady, prefs } = useUserPrefs();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "login";
    const inOnboarding = segments[0] === "onboarding";
    if (!user && !inAuth) {
      router.replace("/login");
      return;
    }
    if (user) {
      if (inAuth) { router.replace("/(tabs)"); return; }
      // Ask for name on first launch after auth
      if (prefsReady && !prefs.display_name && !inOnboarding) {
        router.replace("/onboarding");
      } else if (prefsReady && prefs.display_name && inOnboarding) {
        router.replace("/(tabs)");
      }
    }
  }, [loading, user, prefsReady, prefs.display_name, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.color.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.color.brand} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.surface } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const router = useRouter();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      const url = data.deeplink || data.action_url;
      if (!url) return;
      if (url.startsWith("http")) {
        Linking.openURL(url);
      } else {
        router.push(url);
      }
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data: any = response.notification.request.content.data || {};
      const url = data.deeplink || data.action_url;
      if (url) {
        if (url.startsWith("http")) {
          Linking.openURL(url);
        } else {
          router.push(url);
        }
      }
    });
    return () => { tapSub.remove(); };
  }, [router]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <AuthProvider>
        <UserPrefsProvider>
          <AuthGate />
        </UserPrefsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
