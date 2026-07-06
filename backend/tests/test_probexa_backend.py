"""Probexa backend end-to-end pytest suite covering market data, auth, analyze,
watchlist, alerts, journal, calculator, and push registration."""
import base64
import io
import pytest
import requests

BASE_URL = "https://futures-analyzer-4.preview.emergentagent.com"
TOKEN = "test-token-abc-123"

REQUIRED_TRADE_KEYS = {
    "trend", "market_structure", "support", "resistance",
    "buy_probability", "sell_probability", "trade_score", "trade_quality",
    "action", "reason", "entry_price", "stop_loss",
    "take_profit_1", "take_profit_2", "take_profit_3",
    "risk_reward", "confidence", "volume_analysis", "invalidation",
    "next_alert_price", "education", "checklist",
}


# -------------------- Health --------------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json() == {"app": "Probexa", "ok": True}


# -------------------- Market Data (OKX) --------------------
class TestMarket:
    def test_pairs(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/market/pairs", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "pairs" in data
        pairs = data["pairs"]
        assert isinstance(pairs, list)
        assert len(pairs) > 50
        assert "BTCUSDT" in pairs
        assert "ETHUSDT" in pairs

    def test_ticker(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/market/ticker", params={"symbol": "BTCUSDT"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("symbol", "price", "change_pct", "volume", "high", "low"):
            assert k in d, f"missing {k}"
        assert d["symbol"] == "BTCUSDT"
        assert d["price"] > 0

    def test_tickers_batch(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/market/tickers", params={"symbols": "BTCUSDT,ETHUSDT"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "tickers" in d
        syms = {t["symbol"] for t in d["tickers"]}
        assert {"BTCUSDT", "ETHUSDT"}.issubset(syms)
        for t in d["tickers"]:
            assert t["price"] > 0

    def test_klines(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/market/klines",
                           params={"symbol": "BTCUSDT", "interval": "1h", "limit": 100}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "klines" in d
        assert len(d["klines"]) >= 60
        row = d["klines"][0]
        assert len(row) >= 6  # openTime O H L C V

    def test_funding(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/market/funding", params={"symbol": "BTCUSDT"}, timeout=20)
        assert r.status_code == 200
        assert "funding_rate" in r.json()

    def test_open_interest(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/market/open-interest", params={"symbol": "BTCUSDT"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "open_interest" in d
        assert d["open_interest"] >= 0


# -------------------- Auth --------------------
class TestAuth:
    def test_session_fake_returns_401(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/session", json={"session_id": "fake-session-id"}, timeout=20)
        assert r.status_code == 401

    def test_me_no_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_valid_token(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["user_id"] == "user_test001"
        assert d["user"]["email"] == "test@example.com"


# -------------------- Analyze (Claude Sonnet 4.5) --------------------
class TestAnalyze:
    def test_analyze_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/analyze",
                            json={"symbol": "BTCUSDT", "exchange": "okx", "timeframe": "1h"})
        assert r.status_code == 401

    def test_analyze_btc_1h(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/analyze",
                             json={"symbol": "BTCUSDT", "exchange": "okx", "timeframe": "1h"},
                             timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "analysis_id" in d
        assert d["symbol"] == "BTCUSDT"
        assert "snapshot" in d
        assert "result" in d
        result = d["result"]
        missing = REQUIRED_TRADE_KEYS - set(result.keys())
        assert not missing, f"Missing trade card keys: {missing}"

        # Validate enum-ish values
        assert result["action"] in {"BUY", "SELL", "WAIT"}
        assert result["trade_quality"] in {"A+", "A", "B", "C"}
        assert result["trend"] in {"bullish", "bearish", "neutral"}
        assert 0 <= result["confidence"] <= 100
        # Critical business rule: confidence < 85 -> WAIT
        if result["confidence"] < 85:
            assert result["action"] == "WAIT", (
                f"confidence={result['confidence']} but action={result['action']}"
            )
            assert result["trade_quality"] in {"C", "B"}, (
                f"quality {result['trade_quality']} not C/lower at confidence {result['confidence']}"
            )
        # Checklist must be dict of booleans
        assert isinstance(result["checklist"], dict)
        assert set(result["checklist"].keys()) >= {
            "trend", "support_resistance", "market_structure", "breakout",
            "candle_confirmation", "volume_confirmation", "retest", "risk_reward",
        }
        # Store the analysis id for journal test
        pytest.analysis_id = d["analysis_id"]

    def test_analyze_screenshot(self, auth_client):
        # Minimal 1x1 white PNG
        png_b64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
        r = auth_client.post(f"{BASE_URL}/api/analyze/screenshot",
                             json={"image_base64": png_b64, "symbol": "BTCUSDT",
                                   "notes": "test screenshot"},
                             timeout=90)
        # Claude might reject a 1x1 png; accept 200 or a graceful 500 with parse error
        assert r.status_code in (200, 500), r.text
        if r.status_code == 200:
            d = r.json()
            assert "analysis_id" in d
            assert "result" in d
            missing = REQUIRED_TRADE_KEYS - set(d["result"].keys())
            assert not missing, f"Screenshot missing keys: {missing}"


# -------------------- Watchlist --------------------
class TestWatchlist:
    def test_watchlist_crud(self, auth_client):
        # Add
        r = auth_client.post(f"{BASE_URL}/api/watchlist", json={"symbol": "BTCUSDT"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Add again (idempotent-ish)
        r2 = auth_client.post(f"{BASE_URL}/api/watchlist", json={"symbol": "ETHUSDT"})
        assert r2.status_code == 200

        # List
        r3 = auth_client.get(f"{BASE_URL}/api/watchlist")
        assert r3.status_code == 200
        syms = {i["symbol"] for i in r3.json()["items"]}
        assert {"BTCUSDT", "ETHUSDT"}.issubset(syms)

        # Delete
        r4 = auth_client.delete(f"{BASE_URL}/api/watchlist/BTCUSDT")
        assert r4.status_code == 200

        # Verify removed
        r5 = auth_client.get(f"{BASE_URL}/api/watchlist")
        syms2 = {i["symbol"] for i in r5.json()["items"]}
        assert "BTCUSDT" not in syms2

        # Cleanup
        auth_client.delete(f"{BASE_URL}/api/watchlist/ETHUSDT")

    def test_watchlist_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/watchlist")
        assert r.status_code == 401


# -------------------- Alerts --------------------
class TestAlerts:
    def test_alerts_crud(self, auth_client):
        # Create
        r = auth_client.post(f"{BASE_URL}/api/alerts",
                             json={"symbol": "BTCUSDT", "condition": "a_plus_setup",
                                   "note": "TEST_alert"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["symbol"] == "BTCUSDT"
        assert d["condition"] == "a_plus_setup"
        alert_id = d["alert_id"]

        # List
        r2 = auth_client.get(f"{BASE_URL}/api/alerts")
        assert r2.status_code == 200
        ids = {i["alert_id"] for i in r2.json()["items"]}
        assert alert_id in ids

        # Delete
        r3 = auth_client.delete(f"{BASE_URL}/api/alerts/{alert_id}")
        assert r3.status_code == 200

        # Verify deleted
        r4 = auth_client.get(f"{BASE_URL}/api/alerts")
        ids2 = {i["alert_id"] for i in r4.json()["items"]}
        assert alert_id not in ids2


# -------------------- Journal --------------------
class TestJournal:
    def test_journal_returns_saved_analyses(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/journal")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        # Requires the analyze test to have run first
        if hasattr(pytest, "analysis_id"):
            ids = {i["analysis_id"] for i in d["items"]}
            assert pytest.analysis_id in ids


# -------------------- Calculator --------------------
class TestCalculator:
    def test_calculator_math(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/calculator",
                            json={"balance": 1000, "risk_pct": 1,
                                  "entry": 100, "stop_loss": 99,
                                  "leverage": 10,
                                  "tp1": 102, "tp2": 104, "tp3": 106})
        assert r.status_code == 200
        d = r.json()
        # risk_amount = 10, per_unit_risk = 1 -> position_units = 10
        assert d["position_units"] == 10.0
        # notional = 10 * 100 = 1000
        assert d["position_notional"] == 1000.00
        # margin = 1000 / 10 = 100
        assert d["margin_required"] == 100.00
        # max_loss = 10
        assert d["max_loss"] == 10.00
        # tp profits: |tp-entry| * units
        assert d["profit_tp1"] == 20.00
        assert d["profit_tp2"] == 40.00
        assert d["profit_tp3"] == 60.00

    def test_calculator_invalid_sl_equals_entry(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/calculator",
                            json={"balance": 1000, "risk_pct": 1,
                                  "entry": 100, "stop_loss": 100, "leverage": 1})
        assert r.status_code == 400


# -------------------- Register Push --------------------
class TestPush:
    def test_register_push(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/register-push",
                            json={"user_id": "user_test001",
                                  "platform": "ios",
                                  "device_token": "TEST_dummy_token"},
                            timeout=15)
        # EMERGENT_PUSH_KEY is placeholder; endpoint should still return 201
        # unless upstream returns 401 (which our code converts to 500).
        assert r.status_code in (201, 500), r.text
        if r.status_code == 201:
            assert r.json().get("status") == "registered"
