import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { Platform } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.onSurfaceSecondary,
        tabBarStyle: {
          backgroundColor: theme.color.surfaceSecondary,
          borderTopColor: theme.color.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Analyze", tabBarIcon: ({ color }) => <Ionicons name="pulse" size={22} color={color} /> }} />
      <Tabs.Screen name="watchlist" options={{ title: "Watchlist", tabBarIcon: ({ color }) => <Ionicons name="list" size={22} color={color} /> }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: ({ color }) => <Ionicons name="notifications" size={22} color={color} /> }} />
      <Tabs.Screen name="journal" options={{ title: "Journal", tabBarIcon: ({ color }) => <Ionicons name="book" size={22} color={color} /> }} />
      <Tabs.Screen name="tools" options={{ title: "Tools", tabBarIcon: ({ color }) => <Ionicons name="calculator" size={22} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <Ionicons name="settings" size={22} color={color} /> }} />
    </Tabs>
  );
}
