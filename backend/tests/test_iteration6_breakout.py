"""Iteration 6 – Redesigned Breakout Confirmed logic + iteration_5 regression.

Live verification (OKX perpetual swaps, no mocks) of:
  (A) breakout_analysis present on every non-neutral setup.
  (B) breakout_analysis schema (confirmed/reason/criteria/retest_held) with 6 criteria keys.
  (C) display_checklist["Breakout Confirmed"] == breakout_analysis.confirmed
  (D) confirmed==True → all 6 criteria True.
  (E) confirmed==False → reason non-empty.
  (F) checklist_reasons["Breakout Confirmed"] == breakout_analysis.reason
  (G) All iteration_5 invariants still hold.
  (H) grade=='A+' → display_checklist["Breakout Confirmed"] == True.
  (I) neutral direction may have null breakout_analysis.
"""
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://futures-analyzer-4.preview.emergentagent.com"
).rstrip("/")

CHECKLIST_KEYS = {
    "Trend Confirmed", "EMA Alignment", "Support Holding",
    "Volume Confirmation", "Breakout Confirmed", "Retest Complete",
}
BREAKOUT_CRITERIA_KEYS = {
    "body_close_beyond_level", "volume_above_average", "strong_momentum_candle",
    "structure_confirms", "price_still_accepted", "htf_aligned",
}
VALID_GRADES = {"A+", "A", "B", "C"}
VALID_ACTIONS = {"BUY", "SELL", "WAIT"}
VALID_DIRECTIONS = {"long", "short", "neutral"}
VALID_AUTO_RR = {1.5, 2.0, 2.5, 3.0}

REQUIRED_KEYS = {
    "symbol", "direction", "price", "entry", "stop_loss",
    "take_profit_1", "take_profit_2", "take_profit_3",
    "risk_reward", "auto_rr", "ai_score", "confidence",
    "trade_grade", "action", "entry_quality_score", "entry_quality_label",
    "display_checklist", "support", "resistance",
}


def _expected_quality_label(score):
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Fair"
    return "Wait for Pullback"


# ---------- shared setup invariant ----------
def _check_iter5(s, ctx):
    """Iteration 5 invariants (1–9). Returns list of failure strings."""
    fails = []
    missing = REQUIRED_KEYS - set(s.keys())
    if missing:
        fails.append(f"{ctx}: missing keys {missing}")
        return fails

    grade = s["trade_grade"]
    action = s["action"]
    direction = s["direction"]
    dc = s.get("display_checklist", {})
    conf = s["confidence"]

    if grade not in VALID_GRADES:
        fails.append(f"{ctx}: grade={grade}")
    if action not in VALID_ACTIONS:
        fails.append(f"{ctx}: action={action}")
    if direction not in VALID_DIRECTIONS:
        fails.append(f"{ctx}: direction={direction}")
    if set(dc.keys()) != CHECKLIST_KEYS:
        fails.append(f"{ctx}: dc keys={set(dc.keys())}")
    for k, v in dc.items():
        if not isinstance(v, bool):
            fails.append(f"{ctx}: dc[{k}] not bool")

    if grade == "A+":
        if action not in {"BUY", "SELL"}:
            fails.append(f"{ctx}: A+ action={action}")
        if direction == "neutral":
            fails.append(f"{ctx}: A+ neutral")
        if not all(dc.values()):
            fails.append(f"{ctx}: A+ but checklist has False → {dc}")
        if conf < 88:
            fails.append(f"{ctx}: A+ conf={conf}<88")

    if action == "WAIT":
        if grade not in {"B", "C"}:
            fails.append(f"{ctx}: WAIT grade={grade}")
        if conf > 82:
            fails.append(f"{ctx}: WAIT conf={conf}>82")

    auto_rr = s["auto_rr"]
    rr = s["risk_reward"]
    if auto_rr not in VALID_AUTO_RR:
        fails.append(f"{ctx}: auto_rr={auto_rr}")
    if rr != auto_rr:
        fails.append(f"{ctx}: rr({rr})!=auto_rr({auto_rr})")

    eqs = s["entry_quality_score"]
    eql = s["entry_quality_label"]
    if not (isinstance(eqs, int) and 0 <= eqs <= 100):
        fails.append(f"{ctx}: eqs={eqs}")
    if eql != _expected_quality_label(eqs):
        fails.append(f"{ctx}: eql={eql} eqs={eqs}")

    entry = s["entry"]
    sl = s["stop_loss"]
    tp1 = s["take_profit_1"]
    if direction == "long" and not (sl < entry < tp1):
        fails.append(f"{ctx}: long ord sl={sl} entry={entry} tp1={tp1}")
    if direction == "short" and not (sl > entry > tp1):
        fails.append(f"{ctx}: short ord sl={sl} entry={entry} tp1={tp1}")

    return fails


def _check_breakout(s, ctx):
    """Invariants (A)-(F), (H), (I). Returns list of failure strings."""
    fails = []
    direction = s.get("direction")
    ba = s.get("breakout_analysis")
    dc = s.get("display_checklist", {})
    cr = s.get("checklist_reasons", {}) or {}
    grade = s.get("trade_grade")

    # (I) Neutral may have null breakout_analysis — skip A-F on neutral if null.
    if direction == "neutral" and ba is None:
        return fails

    # (A) present on every non-neutral
    if ba is None:
        fails.append(f"{ctx}(A): breakout_analysis is null but direction={direction}")
        return fails
    if not isinstance(ba, dict):
        fails.append(f"{ctx}(A): breakout_analysis not dict → {type(ba).__name__}")
        return fails

    # (B) schema
    expected_top = {"confirmed", "reason", "criteria", "retest_held"}
    top = set(ba.keys())
    if not expected_top.issubset(top):
        fails.append(f"{ctx}(B): missing top keys, have={top}")
    if "confirmed" in ba and not isinstance(ba["confirmed"], bool):
        fails.append(f"{ctx}(B): confirmed not bool → {ba.get('confirmed')!r}")
    if "reason" in ba and not isinstance(ba["reason"], str):
        fails.append(f"{ctx}(B): reason not str → {type(ba.get('reason')).__name__}")
    if "retest_held" in ba and not isinstance(ba["retest_held"], bool):
        fails.append(f"{ctx}(B): retest_held not bool → {ba.get('retest_held')!r}")
    criteria = ba.get("criteria")
    if not isinstance(criteria, dict):
        fails.append(f"{ctx}(B): criteria not dict")
    else:
        missing = BREAKOUT_CRITERIA_KEYS - set(criteria.keys())
        if missing:
            fails.append(f"{ctx}(B): criteria missing {missing}")
        for k, v in criteria.items():
            if k in BREAKOUT_CRITERIA_KEYS and not isinstance(v, bool):
                fails.append(f"{ctx}(B): criteria[{k}] not bool → {v!r}")

    confirmed = ba.get("confirmed")
    reason = ba.get("reason", "")

    # (C) display_checklist single source of truth
    dc_val = dc.get("Breakout Confirmed")
    if dc_val is not confirmed:
        fails.append(f"{ctx}(C): dc['Breakout Confirmed']={dc_val} != confirmed={confirmed}")

    # (D) confirmed True → all 6 criteria True
    if confirmed is True and isinstance(criteria, dict):
        false_ones = [k for k in BREAKOUT_CRITERIA_KEYS if criteria.get(k) is not True]
        if false_ones:
            fails.append(f"{ctx}(D): confirmed=True but criteria false → {false_ones}")

    # (E) confirmed False → reason non-empty
    if confirmed is False and (not isinstance(reason, str) or not reason.strip()):
        fails.append(f"{ctx}(E): confirmed=False but reason empty → {reason!r}")

    # (F) checklist_reasons["Breakout Confirmed"] == reason
    # spec: they should be equal. If confirmed=True, reason may still be present.
    cr_val = cr.get("Breakout Confirmed")
    # Only enforce equality when cr has the key (main agent stated they added it).
    if cr_val is not None and cr_val != reason:
        fails.append(f"{ctx}(F): checklist_reasons['Breakout Confirmed']={cr_val!r} != reason={reason!r}")
    if confirmed is False and cr_val is None:
        # If confirmed False and no reason surfaced in checklist_reasons, flag it (spec F).
        fails.append(f"{ctx}(F): confirmed=False but checklist_reasons missing 'Breakout Confirmed'")

    # (H) A+ → Breakout Confirmed must be True (via display_checklist)
    if grade == "A+" and dc_val is not True:
        fails.append(f"{ctx}(H): grade=A+ but Breakout Confirmed={dc_val}")

    return fails


# ---------- API fixtures ----------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def scan_1h(api_client):
    t0 = time.time()
    r = api_client.get(f"{BASE_URL}/api/scan", params={"timeframe": "1h"}, timeout=120)
    r.elapsed_secs = time.time() - t0
    return r


@pytest.fixture(scope="module")
def scan_30m_fresh(api_client):
    t0 = time.time()
    r = api_client.get(f"{BASE_URL}/api/scan",
                       params={"timeframe": "30m", "fresh": 1}, timeout=180)
    r.elapsed_secs = time.time() - t0
    return r


# ---------- Tests ----------
class TestScan1hCached:
    def test_200(self, scan_1h):
        assert scan_1h.status_code == 200, scan_1h.text[:500]

    def test_shape(self, scan_1h):
        d = scan_1h.json()
        assert "best_setups" in d and isinstance(d["best_setups"], list)
        assert "preparing" in d and isinstance(d["preparing"], list)

    @pytest.mark.parametrize("bucket", ["best_setups", "preparing"])
    def test_iter5_invariants(self, scan_1h, bucket):
        d = scan_1h.json()
        items = d.get(bucket, [])
        all_fails = []
        for s in items:
            all_fails.extend(_check_iter5(s, ctx=f"scan1h[{bucket}]:{s.get('symbol')}"))
        assert not all_fails, "\n".join(all_fails[:15])

    @pytest.mark.parametrize("bucket", ["best_setups", "preparing"])
    def test_breakout_invariants(self, scan_1h, bucket):
        d = scan_1h.json()
        items = d.get(bucket, [])
        all_fails = []
        offending = []
        for s in items:
            f = _check_breakout(s, ctx=f"scan1h[{bucket}]:{s.get('symbol')}")
            if f:
                offending.append({"symbol": s.get("symbol"), "raw": s, "fails": f})
            all_fails.extend(f)
        if all_fails:
            pytest.fail(
                "\n".join(all_fails[:15])
                + "\n\nOFFENDING:\n"
                + json.dumps(offending[:3], indent=2, default=str)
            )


class TestScan30mFresh:
    def test_200(self, scan_30m_fresh):
        assert scan_30m_fresh.status_code == 200, scan_30m_fresh.text[:500]

    @pytest.mark.parametrize("bucket", ["best_setups", "preparing"])
    def test_iter5_invariants(self, scan_30m_fresh, bucket):
        d = scan_30m_fresh.json()
        items = d.get(bucket, [])
        all_fails = []
        for s in items:
            all_fails.extend(_check_iter5(s, ctx=f"scan30mF[{bucket}]:{s.get('symbol')}"))
        assert not all_fails, "\n".join(all_fails[:15])

    @pytest.mark.parametrize("bucket", ["best_setups", "preparing"])
    def test_breakout_invariants(self, scan_30m_fresh, bucket):
        d = scan_30m_fresh.json()
        items = d.get(bucket, [])
        all_fails = []
        offending = []
        for s in items:
            f = _check_breakout(s, ctx=f"scan30mF[{bucket}]:{s.get('symbol')}")
            if f:
                offending.append({"symbol": s.get("symbol"), "raw": s, "fails": f})
            all_fails.extend(f)
        if all_fails:
            pytest.fail("\n".join(all_fails[:15]) + "\n\nOFFENDING:\n"
                        + json.dumps(offending[:3], indent=2, default=str))


# ---------- Named-setup checks ----------
NAMED_SETUPS = [
    ("PENDLEUSDT", "1h"),
    ("GOOGLUSDT", "1h"),
    ("BTCUSDT", "1h"),
    ("AIUSDT", "1h"),
]


class TestNamedSetups:
    @pytest.mark.parametrize("symbol,timeframe", NAMED_SETUPS)
    def test_iter5(self, api_client, symbol, timeframe):
        r = api_client.get(f"{BASE_URL}/api/setup/{symbol}",
                           params={"timeframe": timeframe}, timeout=90)
        assert r.status_code == 200, r.text[:300]
        s = r.json()
        fails = _check_iter5(s, ctx=f"{symbol}")
        assert not fails, "\n".join(fails)

    @pytest.mark.parametrize("symbol,timeframe", NAMED_SETUPS)
    def test_breakout(self, api_client, symbol, timeframe):
        r = api_client.get(f"{BASE_URL}/api/setup/{symbol}",
                           params={"timeframe": timeframe}, timeout=90)
        assert r.status_code == 200, r.text[:300]
        s = r.json()
        fails = _check_breakout(s, ctx=f"{symbol}")
        if fails:
            pytest.fail("\n".join(fails) + "\n\nRAW:\n"
                        + json.dumps(s, indent=2, default=str)[:2500])
