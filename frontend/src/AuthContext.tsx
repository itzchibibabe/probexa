import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import { storage } from "@/src/utils/storage";
import { api, AUTH_TOKEN_KEY } from "@/src/api";

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
};

type AuthState = {
  loading: boolean;
  user: AuthUser | null;
  signIn: () => Promise<void>;
  processSessionId: (sessionId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const bootstrap = useCallback(async () => {
    // Web: process session_id from URL fragment/query first
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      let sid = "";
      if (hash.includes("session_id=")) {
        sid = new URLSearchParams(hash.replace(/^#/, "")).get("session_id") || "";
      } else if (search.includes("session_id=")) {
        sid = new URLSearchParams(search).get("session_id") || "";
      }
      if (sid) {
        try {
          const resp = await api.authSession(sid);
          await storage.secureSet(AUTH_TOKEN_KEY, resp.session_token);
          setUser(resp.user);
          window.history.replaceState(null, "", window.location.pathname);
          setLoading(false);
          return;
        } catch (e) {
          console.warn("session process failed", e);
        }
      }
    }

    const token = await storage.secureGet<string>(AUTH_TOKEN_KEY, "");
    if (token) {
      try {
        const me = await api.me();
        setUser(me.user);
      } catch {
        await storage.secureRemove(AUTH_TOKEN_KEY);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  // Register push after auth (native only, real devices)
  useEffect(() => {
    if (!user || Platform.OS === "web" || !Device.isDevice) return;
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const tok = await Notifications.getDevicePushTokenAsync();
        await api.registerPush(user.user_id, Platform.OS, tok.data);
      } catch (e) {
        console.warn("push register failed", e);
      }
    })();
  }, [user]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const processSessionId = useCallback(async (sessionId: string) => {
    const resp = await api.authSession(sessionId);
    await storage.secureSet(AUTH_TOKEN_KEY, resp.session_token);
    setUser(resp.user);
  }, []);

  const signIn = useCallback(async () => {
    // Determine redirect URL based on platform
    let redirectUrl: string;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      redirectUrl = window.location.origin + "/";
    } else {
      redirectUrl = Linking.createURL("auth");
    }
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    const WebBrowser = await import("expo-web-browser");
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const url = result.url;
      let sid = "";
      const hashIdx = url.indexOf("#");
      if (hashIdx >= 0) {
        sid = new URLSearchParams(url.substring(hashIdx + 1)).get("session_id") || "";
      }
      if (!sid && url.includes("session_id=")) {
        const q = url.split("?")[1] || "";
        sid = new URLSearchParams(q.split("#")[0]).get("session_id") || "";
      }
      if (sid) {
        await processSessionId(sid);
      }
    }
  }, [processSessionId]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await storage.secureRemove(AUTH_TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, user, signIn, processSessionId, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
