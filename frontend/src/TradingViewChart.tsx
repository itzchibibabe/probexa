import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "@/src/theme";

export type ChartLevel = { label: string; price: number; color: string };

type Props = { symbol: string; interval: string; exchange?: string; levels?: ChartLevel[] };

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1", "5m": "5", "15m": "15", "30m": "30",
  "1h": "60", "4h": "240", "1d": "D",
};

/**
 * TradingView chart with a client-drawn level legend overlay.
 * The free TradingView widget doesn't expose an API for drawing shapes, so we
 * render toggled Support / Resistance / Entry / SL / TP prices as pill overlays
 * on top of the chart so the trader always sees which levels are being watched.
 */
export function TradingViewChart({ symbol, interval, exchange = "BINANCE", levels = [] }: Props) {
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

  return (
    <View style={styles.wrap}>
      {Platform.OS === "web"
        ? React.createElement("iframe" as any, {
            srcDoc: html,
            style: { width: "100%", height: "100%", border: 0, borderRadius: 12 },
          })
        : (
          <WebView
            source={{ html }}
            originWhitelist={["*"]}
            style={{ backgroundColor: theme.color.surface }}
            javaScriptEnabled
            domStorageEnabled
          />
        )
      }

      {levels.length > 0 && (
        <View pointerEvents="none" style={styles.overlay} testID="chart-levels-overlay">
          {levels.map((lv) => (
            <View
              key={lv.label}
              style={[styles.pill, { borderColor: lv.color, backgroundColor: lv.color + "22" }]}
            >
              <View style={[styles.pillDash, { backgroundColor: lv.color }]} />
              <Text style={[styles.pillText, { color: lv.color }]} numberOfLines={1}>
                {lv.label} · {fmt(lv.price)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function fmt(n: number) {
  if (!n && n !== 0) return "-";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

const styles = StyleSheet.create({
  wrap: {
    height: 340,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
    position: "relative",
  },
  overlay: {
    position: "absolute",
    top: 8, left: 8, right: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
  },
  pillDash: { width: 12, height: 2, borderRadius: 1 },
  pillText: { fontSize: 11, fontWeight: "700" },
});
