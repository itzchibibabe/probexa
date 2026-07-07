"""Iteration 4 – Probexa backend tests.

Covers:
  * Rewritten A+ logic in build_setup() – grade/action tied to display_checklist.
  * /api/setup/{symbol} advanced toggles: hi_tf_confirm & liq_sweep.
  * /api/scan – full-market scan (universe_size & scanned_count) + hi_tf_confirm propagation.
  * /api/watchlist/details – enrichment.
  * /api/prefs – new `advanced` field persists.
  * /api/auth/session – invalid session_id returns 401 (upsert fix must not crash).
"""
import pytest
import requests

BASE_URL = "https://futures-analyzer-4.preview.emergentagent.com"
TOKEN = "test-token-abc-123"

CHECKLIST_KEYS = {
    "Trend Confirmed", "EMA Alignment", "Support Holding",
    "Volume Confirmation", "Breakout Confirmed", "Retest Complete",
}


# ---------- helpers ----------
def _assert_grade_action_consistency(setup: dict, ctx: str = ""):
    """Business rule: grade/action must match display_checklist + direction."""
    dc = setup.get("display_checklist")
    assert isinstance(dc, dict), f"{ctx}: display_checklist missing/not dict"
    assert set(dc.keys()) == CHECKLIST_KEYS, f"{ctx}: unexpected keys {dc.keys()}"
    for k, v in dc.items():
        assert isinstance(v, bool), f"{ctx}: checklist[{k}] not bool"

    direction = setup["direction"]
    grade = setup["trade_grade"]
    action = setup["action"]
    score = setup["ai_score"]
    passed = sum(1 for v in dc.values() if v)

    if direction == "neutral":
        assert grade in {"B", "C"}, f"{ctx}: neutral must be B/C got {grade}"
        assert action == "WAIT", f"{ctx}: neutral must WAIT got {action}"
        return

    # Advanced demotions (htf unconfirmed / possible_sweep) can lower A+ → A / A→B.
    htf = setup.get("htf_status")
    liq = setup.get("liquidity_sweep_status")
    demoted_by_htf = htf == "unconfirmed"
    demoted_by_liq = liq == "possible_sweep"

    if passed == 6 and not demoted_by_htf and not demoted_by_liq:
        assert grade == "A+", f"{ctx}: 6/6 checklist should be A+ got {grade}"
        assert score >= 90, f"{ctx}: A+ score must be >=90 got {score}"
        assert action in {"BUY", "SELL"}, f"{ctx}: A+ action must be BUY/SELL got {action}"
        expected = "BUY" if direction == "long" else "SELL"
        assert action == expected, f"{ctx}: direction {direction} → action {expected} got {action}"
    elif passed == 5 and not demoted_by_liq:
        # 5/6 → A (unless HTF demoted from A+ to A already: same outcome)
        assert grade in {"A", "B"}, f"{ctx}: 5/6 should be A (or B after demotion) got {grade}"
        if grade == "A":
            assert action in {"BUY", "SELL"}
    elif passed <= 4:
        assert grade in {"B", "C"}, f"{ctx}: <=4/6 must be B/C got {grade} passed={passed}"
        assert action == "WAIT", f"{ctx}: <=4/6 must WAIT got {action}"


# ---------- 1. /api/setup consistency ----------
class TestSetupConsistency:
    @pytest.mark.parametrize("sym", ["BTCUSDT", "ETHUSDT", "SOLUSDT"])
    def test_setup_grade_matches_checklist(self, api_client, sym):
        r = api_client.get(f"{BASE_URL}/api/setup/{sym}", params={"timeframe": "1h"}, timeout=30)
        assert r.status_code == 200, r.text
        s = r.json()
        # Required response keys
        for k in ("display_checklist", "liquidity_sweep_status", "htf_status",
                  "trade_grade", "action", "direction", "ai_score", "confidence"):
            assert k in s, f"{sym}: missing {k}"
        # Defaults with no toggles: liq should be None (masked), htf should be None
        assert s["htf_status"] is None, f"{sym}: hi_tf_confirm=0 → htf_status must be null"
        assert s["liquidity_sweep_status"] is None, f"{sym}: liq_sweep=0 → status must be null"
        _assert_grade_action_consistency(s, ctx=sym)


# ---------- 2. advanced toggles ----------
class TestAdvancedToggles:
    def test_setup_with_htf_confirm(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/setup/BTCUSDT",
                           params={"timeframe": "1h", "hi_tf_confirm": 1, "liq_sweep": 1},
                           timeout=45)
        assert r.status_code == 200, r.text
        s = r.json()
        # htf_status may be None if HTF data missing, but usually should be set on BTC.
        assert "htf_status" in s
        if s["htf_status"] is not None:
            assert s["htf_status"] in {"confirmed", "unconfirmed"}
        # liq_sweep flag → field must be present (may be None if no wick condition)
        assert "liquidity_sweep_status" in s
        if s["liquidity_sweep_status"] is not None:
            assert s["liquidity_sweep_status"] in {"possible_sweep", "real_breakout"}

    def test_setup_without_htf_confirm(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/setup/ETHUSDT",
                           params={"timeframe": "1h", "hi_tf_confirm": 0}, timeout=30)
        assert r.status_code == 200
        assert r.json()["htf_status"] is None


# ---------- 3. /api/scan ----------
@pytest.fixture(scope="module")
def scan_payload():
    # First call may take 5-15s to warm the OKX universe cache.
    r = requests.get(f"{BASE_URL}/api/scan", params={"timeframe": "1h"}, timeout=120)
    r.raise_for_status()
    return r.json()


class TestScan:
    def test_universe_and_scanned_counts(self, scan_payload):
        assert scan_payload["universe_size"] > 100, (
            f"universe_size expected >100 (200-300 USDT perps) got {scan_payload['universe_size']}"
        )
        assert scan_payload["scanned_count"] > 20, (
            f"scanned_count should be >>20 got {scan_payload['scanned_count']}"
        )

    def test_best_setups_shape(self, scan_payload):
        for s in scan_payload["best_setups"]:
            for k in ("symbol", "price", "ai_score", "confidence", "trade_grade",
                      "action", "direction", "display_checklist"):
                assert k in s, f"best_setup {s.get('symbol')} missing {k}"
            assert s["price"] > 0
            assert s["action"] in {"BUY", "SELL"}
            assert s["trade_grade"] in {"A+", "A"}

    def test_preparing_shape(self, scan_payload):
        for s in scan_payload["preparing"]:
            for k in ("symbol", "price", "ai_score", "confidence", "trade_grade",
                      "action", "direction", "display_checklist", "missing_conditions"):
                assert k in s, f"preparing {s.get('symbol')} missing {k}"
            assert isinstance(s["missing_conditions"], list)

    def test_a_plus_consistency_across_scan(self, scan_payload):
        """Every A+ in best_setups must have all 6 checklist true & action BUY/SELL."""
        a_plus = [s for s in scan_payload["best_setups"] if s["trade_grade"] == "A+"]
        for s in a_plus:
            dc = s["display_checklist"]
            passed = sum(1 for v in dc.values() if v)
            assert passed == 6, f"A+ {s['symbol']} has only {passed}/6 checklist"
            assert s["action"] in {"BUY", "SELL"}, f"A+ {s['symbol']} action={s['action']}"
            assert s["ai_score"] >= 90, f"A+ {s['symbol']} score={s['ai_score']}"

    def test_scan_hi_tf_confirm_propagates(self):
        r = requests.get(f"{BASE_URL}/api/scan",
                         params={"timeframe": "1h", "hi_tf_confirm": 1}, timeout=180)
        assert r.status_code == 200
        d = r.json()
        for s in d["best_setups"][:5] + d["preparing"][:5]:
            assert "htf_status" in s, f"{s.get('symbol')} missing htf_status when hi_tf_confirm=1"


# ---------- 4. /api/watchlist/details ----------
class TestWatchlistDetails:
    def test_watchlist_details_enriched(self, auth_client):
        # Ensure BTCUSDT in watchlist
        auth_client.post(f"{BASE_URL}/api/watchlist", json={"symbol": "BTCUSDT"})
        r = auth_client.get(f"{BASE_URL}/api/watchlist/details",
                            params={"timeframe": "1h"}, timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d
        btc = next((i for i in d["items"] if i["symbol"] == "BTCUSDT"), None)
        assert btc is not None, "BTCUSDT missing from watchlist details"
        for k in ("symbol", "price", "change_pct", "action",
                  "trade_grade", "ai_score", "confidence", "direction"):
            assert k in btc, f"missing {k}"
        assert isinstance(btc["price"], (int, float)) and btc["price"] > 0
        assert btc["action"] in {"BUY", "SELL", "WAIT"}

    def test_watchlist_details_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/watchlist/details")
        assert r.status_code == 401


# ---------- 5. /api/prefs advanced ----------
class TestPrefsAdvanced:
    def test_put_advanced_persists(self, auth_client):
        payload = {"advanced": {"liquidity_sweep_detection": True,
                                "higher_timeframe_confirmation": True}}
        r = auth_client.put(f"{BASE_URL}/api/prefs", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "advanced" in d, f"advanced not returned: {d}"
        assert d["advanced"]["liquidity_sweep_detection"] is True
        assert d["advanced"]["higher_timeframe_confirmation"] is True

        # Verify persistence via GET
        r2 = auth_client.get(f"{BASE_URL}/api/prefs")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["advanced"]["liquidity_sweep_detection"] is True
        assert d2["advanced"]["higher_timeframe_confirmation"] is True

    def test_put_advanced_partial_merge(self, auth_client):
        # Toggle one off — the other should remain true (merge behavior)
        auth_client.put(f"{BASE_URL}/api/prefs",
                        json={"advanced": {"liquidity_sweep_detection": True,
                                           "higher_timeframe_confirmation": True}})
        r = auth_client.put(f"{BASE_URL}/api/prefs",
                            json={"advanced": {"liquidity_sweep_detection": False}})
        assert r.status_code == 200
        d = r.json()
        assert d["advanced"]["liquidity_sweep_detection"] is False
        assert d["advanced"]["higher_timeframe_confirmation"] is True, (
            "partial update must merge; higher_timeframe_confirmation lost"
        )


# ---------- 6. auth/session upsert error handling ----------
class TestSessionUpsertStability:
    def test_invalid_session_returns_401_not_500(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/session",
                            json={"session_id": "invalid-session-xyz-999"}, timeout=20)
        assert r.status_code == 401, (
            f"expected 401 for invalid session_id, got {r.status_code}: {r.text}"
        )
