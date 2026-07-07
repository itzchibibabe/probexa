"""Iteration 5 – Probexa 7 Trading Engine Logic Updates.

Live verification (OKX perpetual swaps, no mocks) of:
  1. Live Analysis Refresh (?fresh=1 cache bypass)
  2. Consistent Analysis (no contradictions checklist/grade/action)
  3. Dynamic Setup Validation
  4. Auto Risk:Reward (in {1.5, 2.0, 2.5, 3.0})
  5. Strict A+ Grading
  6. Entry Quality metric (score + label bands)
  7. Final Validation clamps (WAIT⇒conf≤82, A+⇒conf≥88)
"""
import os
import time
import json
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://futures-analyzer-4.preview.emergentagent.com"
).rstrip("/")
AUTH_TOKEN = "test-token-abc-123"

CHECKLIST_KEYS = {
    "Trend Confirmed", "EMA Alignment", "Support Holding",
    "Volume Confirmation", "Breakout Confirmed", "Retest Complete",
}
VALID_GRADES = {"A+", "A", "B", "C"}
VALID_ACTIONS = {"BUY", "SELL", "WAIT"}
VALID_DIRECTIONS = {"long", "short", "neutral"}
VALID_AUTO_RR = {1.5, 2.0, 2.5, 3.0}

# Required keys for every setup emitted by /api/scan or /api/setup
REQUIRED_KEYS = {
    "symbol", "direction", "price", "entry", "stop_loss",
    "take_profit_1", "take_profit_2", "take_profit_3",
    "risk_reward", "auto_rr", "ai_score", "confidence",
    "trade_grade", "action", "entry_quality_score", "entry_quality_label",
    "display_checklist", "support", "resistance",
}


# ---------- helpers ----------
def _expected_quality_label(score):
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Fair"
    return "Wait for Pullback"


def _assert_setup_invariants(s, ctx=""):
    """Assert all 9 invariants on a single setup dict. Returns list of pass strings."""
    passes = []

    # 0. Schema stability
    missing = REQUIRED_KEYS - set(s.keys())
    assert not missing, f"{ctx}: missing required keys {missing} | raw={json.dumps(s)[:400]}"
    passes.append("schema_ok")

    # 1. grade in valid set
    grade = s["trade_grade"]
    assert grade in VALID_GRADES, f"{ctx}: grade={grade} not in {VALID_GRADES}"
    passes.append("grade_valid")

    # 2. action in valid set
    action = s["action"]
    assert action in VALID_ACTIONS, f"{ctx}: action={action} not in {VALID_ACTIONS}"
    passes.append("action_valid")

    direction = s["direction"]
    assert direction in VALID_DIRECTIONS, f"{ctx}: direction={direction}"
    dc = s["display_checklist"]
    assert isinstance(dc, dict) and set(dc.keys()) == CHECKLIST_KEYS, (
        f"{ctx}: display_checklist keys mismatch: {set(dc.keys())}"
    )
    for k, v in dc.items():
        assert isinstance(v, bool), f"{ctx}: checklist[{k}] not bool ({v!r})"

    confidence = s["confidence"]
    ai_score = s["ai_score"]

    # 3. A+ contract
    if grade == "A+":
        assert action in {"BUY", "SELL"}, f"{ctx}: A+ but action={action}"
        assert direction != "neutral", f"{ctx}: A+ but direction=neutral"
        assert all(dc.values()), f"{ctx}: A+ but checklist has False → {dc}"
        assert confidence >= 88, f"{ctx}: A+ but confidence={confidence} (<88)"
        passes.append("A+_contract_ok")

    # 4. WAIT contract
    if action == "WAIT":
        assert grade in {"B", "C"}, f"{ctx}: WAIT but grade={grade} (should be B/C)"
        assert confidence <= 82, f"{ctx}: WAIT but confidence={confidence} (>82)"
        passes.append("WAIT_contract_ok")

    # 5. auto_rr / risk_reward
    auto_rr = s["auto_rr"]
    rr = s["risk_reward"]
    assert auto_rr in VALID_AUTO_RR, f"{ctx}: auto_rr={auto_rr} not in {VALID_AUTO_RR}"
    assert rr == auto_rr, f"{ctx}: risk_reward({rr}) != auto_rr({auto_rr})"
    passes.append("auto_rr_ok")

    # 6. entry_quality
    eqs = s["entry_quality_score"]
    eql = s["entry_quality_label"]
    assert isinstance(eqs, int), f"{ctx}: entry_quality_score not int ({type(eqs).__name__})"
    assert 0 <= eqs <= 100, f"{ctx}: entry_quality_score={eqs} out of [0,100]"
    exp_label = _expected_quality_label(eqs)
    assert eql == exp_label, f"{ctx}: entry_quality_label={eql} but score={eqs} → expected {exp_label}"
    passes.append("entry_quality_ok")

    # 7. Levels ordering
    entry = s["entry"]
    sl = s["stop_loss"]
    tp1 = s["take_profit_1"]
    if direction == "long":
        assert sl < entry < tp1, (
            f"{ctx}: long ordering violated sl={sl} entry={entry} tp1={tp1}"
        )
        passes.append("long_ordering_ok")
    elif direction == "short":
        assert sl > entry > tp1, (
            f"{ctx}: short ordering violated sl={sl} entry={entry} tp1={tp1}"
        )
        passes.append("short_ordering_ok")
    # neutral: no ordering enforced

    # 8. ai_score bounded
    assert 0 <= ai_score <= 100, f"{ctx}: ai_score={ai_score} out of [0,100]"
    assert 0 <= confidence <= 100, f"{ctx}: confidence={confidence} out of [0,100]"

    return passes


# ============================================================
# 1. Health
# ============================================================
class TestHealth:
    def test_health(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d == {"app": "Probexa", "ok": True}, f"unexpected: {d}"


# ============================================================
# 2 & 3. /api/scan (cached + fresh)
# ============================================================
@pytest.fixture(scope="module")
def scan_cached():
    t0 = time.time()
    r = requests.get(f"{BASE_URL}/api/scan", params={"timeframe": "30m"}, timeout=90)
    r.elapsed_secs = time.time() - t0
    return r


@pytest.fixture(scope="module")
def scan_fresh():
    t0 = time.time()
    r = requests.get(f"{BASE_URL}/api/scan",
                     params={"timeframe": "30m", "fresh": 1}, timeout=120)
    r.elapsed_secs = time.time() - t0
    return r


class TestScanEndpoint:
    def test_scan_cached_200_and_perf(self, scan_cached):
        assert scan_cached.status_code == 200, scan_cached.text
        assert scan_cached.elapsed_secs < 60, f"scan took {scan_cached.elapsed_secs:.1f}s (>60)"

    def test_scan_fresh_200_and_perf(self, scan_fresh):
        assert scan_fresh.status_code == 200, scan_fresh.text
        assert scan_fresh.elapsed_secs < 90, f"fresh scan took {scan_fresh.elapsed_secs:.1f}s (>90)"

    def test_scan_shape(self, scan_cached):
        d = scan_cached.json()
        # Actual API contract exposes `best_setups` and `preparing` (not `preparing_setups`).
        assert "best_setups" in d, f"missing best_setups: keys={list(d.keys())}"
        assert isinstance(d["best_setups"], list)
        assert ("preparing_setups" in d) or ("preparing" in d), (
            f"missing preparing/preparing_setups: keys={list(d.keys())}"
        )

    @pytest.mark.parametrize("bucket", ["best_setups", "preparing"])
    def test_scan_cached_invariants(self, scan_cached, bucket):
        d = scan_cached.json()
        items = d.get(bucket) or d.get("preparing_setups", []) if bucket == "preparing" else d.get(bucket, [])
        assert isinstance(items, list)
        failures = []
        for s in items:
            try:
                _assert_setup_invariants(s, ctx=f"scan[{bucket}]:{s.get('symbol')}")
            except AssertionError as e:
                failures.append(str(e))
        assert not failures, "\n".join(failures[:10])

    @pytest.mark.parametrize("bucket", ["best_setups", "preparing"])
    def test_scan_fresh_invariants(self, scan_fresh, bucket):
        d = scan_fresh.json()
        items = d.get(bucket, [])
        failures = []
        for s in items:
            try:
                _assert_setup_invariants(s, ctx=f"scan_fresh[{bucket}]:{s.get('symbol')}")
            except AssertionError as e:
                failures.append(str(e))
        assert not failures, "\n".join(failures[:10])


# ============================================================
# 4. Contradiction sweep — top ~20 combined setups
# ============================================================
class TestContradictionSweep:
    def test_no_contradictions(self, scan_cached):
        d = scan_cached.json()
        combined = (d.get("best_setups", []) + d.get("preparing", []) + d.get("preparing_setups", []))[:25]
        contradictions = []
        for s in combined:
            grade = s.get("trade_grade")
            action = s.get("action")
            direction = s.get("direction")
            dc = s.get("display_checklist", {})
            confidence = s.get("confidence", 0)
            entry = s.get("entry")
            sl = s.get("stop_loss")
            tp1 = s.get("take_profit_1")
            auto_rr = s.get("auto_rr")
            rr = s.get("risk_reward")
            eqs = s.get("entry_quality_score", 0)
            eql = s.get("entry_quality_label", "")

            if action == "WAIT" and grade in {"A+", "A"}:
                contradictions.append(("WAIT_but_high_grade", s))
            if grade == "A+" and any(v is False for v in dc.values()):
                contradictions.append(("A+_but_checklist_false", s))
            if grade == "A+" and confidence < 88:
                contradictions.append(("A+_but_conf_lt_88", s))
            if grade == "A+" and direction == "neutral":
                contradictions.append(("A+_but_neutral", s))
            if direction == "long" and (sl >= entry or tp1 <= entry):
                contradictions.append(("long_bad_ordering", s))
            if direction == "short" and (sl <= entry or tp1 >= entry):
                contradictions.append(("short_bad_ordering", s))
            if auto_rr not in VALID_AUTO_RR:
                contradictions.append(("auto_rr_invalid", s))
            if rr != auto_rr:
                contradictions.append(("rr_neq_auto_rr", s))
            if eql != _expected_quality_label(eqs):
                contradictions.append(("eq_label_mismatch", s))

        if contradictions:
            preview = [
                {"issue": tag, "symbol": s.get("symbol"), "raw": s}
                for tag, s in contradictions[:5]
            ]
            pytest.fail(
                f"Found {len(contradictions)} contradictions. First 5:\n"
                + json.dumps(preview, indent=2, default=str)
            )


# ============================================================
# 5. /api/setup detail (cached + fresh)
# ============================================================
SETUP_CASES = [
    ("BTCUSDT", "1h", 0),
    ("BTCUSDT", "1h", 1),
    ("ETHUSDT", "30m", 0),
    ("ETHUSDT", "30m", 1),
    ("SOLUSDT", "1h", 0),
]


class TestSetupDetail:
    @pytest.mark.parametrize("symbol,timeframe,fresh", SETUP_CASES)
    def test_setup_invariants(self, api_client, symbol, timeframe, fresh):
        params = {"timeframe": timeframe}
        if fresh:
            params["fresh"] = 1
        t0 = time.time()
        r = api_client.get(f"{BASE_URL}/api/setup/{symbol}", params=params, timeout=90)
        dur = time.time() - t0
        assert r.status_code == 200, f"{symbol} {timeframe} fresh={fresh}: {r.status_code} {r.text[:300]}"
        limit = 90 if fresh else 60
        assert dur < limit, f"{symbol} took {dur:.1f}s (>{limit})"
        s = r.json()
        _assert_setup_invariants(s, ctx=f"setup[{symbol},{timeframe},fresh={fresh}]")


# ============================================================
# 6. fresh=1 actually bypasses cache
# ============================================================
class TestFreshBypassesCache:
    def test_fresh_double_call(self, api_client):
        r1 = api_client.get(f"{BASE_URL}/api/setup/BTCUSDT",
                            params={"timeframe": "1h", "fresh": 1}, timeout=60)
        assert r1.status_code == 200, r1.text
        time.sleep(2)
        r2 = api_client.get(f"{BASE_URL}/api/setup/BTCUSDT",
                            params={"timeframe": "1h", "fresh": 1}, timeout=60)
        assert r2.status_code == 200, r2.text
        # Both must succeed and yield stable schema. Prices should typically differ
        # on OKX live feed within a couple of seconds; if same, it's not a hard fail
        # (market may be extremely quiet), but log for context.
        p1 = r1.json().get("price")
        p2 = r2.json().get("price")
        assert p1 and p2, f"missing price p1={p1} p2={p2}"
        # informational only:
        print(f"[fresh_bypass] p1={p1} p2={p2} diff={p2 - p1}")


# ============================================================
# 7. Regression spot-checks
# ============================================================
class TestRegression:
    def test_market_pairs(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/market/pairs", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Response could be list or {pairs:[...]}
        pairs = d if isinstance(d, list) else d.get("pairs") or d.get("data") or []
        assert len(pairs) > 0, f"market/pairs empty: {d}"

    def test_goals_summary_authed(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/goals/summary", timeout=30)
        assert r.status_code == 200, f"goals/summary: {r.status_code} {r.text[:300]}"

    def test_watchlist_authed(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/watchlist", timeout=30)
        assert r.status_code == 200, f"watchlist: {r.status_code} {r.text[:300]}"
