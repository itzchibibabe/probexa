import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

const POPULAR = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","SUIUSDT","APTUSDT","MATICUSDT","ADAUSDT","DOTUSDT","NEARUSDT","ARBUSDT","OPUSDT","LTCUSDT","INJUSDT","TIAUSDT","TRXUSDT"];

export default function Search() {
  const router = useRouter();
  const params = useLocalSearchParams<{ timeframe?: string }>();
  const timeframe = (params.timeframe || "1h").toString();
  const [pairs, setPairs] = useState<string[]>(POPULAR);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.pairs();
        if (r.pairs?.length) setPairs(r.pairs);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return pairs.slice(0, 100);
    return pairs.filter((p) => p.includes(q)).slice(0, 200);
  }, [query, pairs]);

  const select = (symbol: string) => {
    router.replace({ pathname: "/analyze/[symbol]", params: { symbol, timeframe } });
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="search-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={{ padding: 8 }} testID="search-close-btn">
            <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
          </Pressable>
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search coin (BTC, ETH, SOL…)"
            placeholderTextColor={theme.color.onSurfaceSecondary}
            autoCapitalize="characters"
            autoFocus
            style={styles.input}
          />
        </View>

        {loading && pairs.length === POPULAR.length ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={theme.color.brand} />
          </View>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(x) => x}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              testID={`pair-option-${item}`}
              onPress={() => select(item)}
              style={styles.row}
            >
              <Text style={styles.rowSym}>{item}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.color.onSurfaceSecondary} />
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomColor: theme.color.border, borderBottomWidth: 1,
  },
  input: {
    flex: 1, color: theme.color.onSurface, fontSize: 16,
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomColor: theme.color.border, borderBottomWidth: 1,
  },
  rowSym: { color: theme.color.onSurface, fontSize: 15, fontWeight: "700" },
});
