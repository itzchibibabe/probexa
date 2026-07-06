import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "@/src/theme";

type Props = { symbol: string; interval: string; exchange?: string };

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1", "5m": "5", "15m": "15", "30m": "30",
  "1h": "60", "4h": "240", "1d": "D",
};

export function TradingViewChart({ symbol, interval, exchange = "OKX" }: Props) {
  const tvInterval = INTERVAL_MAP[interval] || "60";
  const tvSymbol = `${exchange}:${symbol}.P`;
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#c{margin:0;padding:0;height:100%;background:#0B0E14;}</style></head><body><div id="c"><div id="tv_chart_container" style="height:100%"></div></div><script src="https://s3.tradingview.com/tv.js"></script><script>
try {
  new TradingView.widget({
    autosize: true,
    symbol: "${tvSymbol}",
    interval: "${tvInterval}",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    toolbar_bg: "#0B0E14",
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    container_id: "tv_chart_container",
    studies: ["MASimple@tv-basicstudies","RSI@tv-basicstudies","Volume@tv-basicstudies"]
  });
} catch(e){ document.body.innerText="Chart failed: "+e.message; }
</script></body></html>`;

  if (Platform.OS === "web") {
    return (
      <View style={styles.wrap}>
        {React.createElement("iframe" as any, {
          srcDoc: html,
          style: { width: "100%", height: "100%", border: 0, borderRadius: 12 },
        })}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        style={{ backgroundColor: theme.color.surface }}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 340,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
});
