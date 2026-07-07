"""Rule-based scan engine — no LLM. Scores each pair 0-100 and lists missing conditions."""
from typing import Dict, List, Any, Optional
from indicators import compute_snapshot, breakout_confirmation


DEFAULT_UNIVERSE = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "SUIUSDT", "APTUSDT",
    "MATICUSDT", "ADAUSDT", "DOTUSDT", "NEARUSDT", "ARBUSDT",
    "OPUSDT", "LTCUSDT", "INJUSDT", "TIAUSDT", "TRXUSDT",
]


CONDITION_LABELS = {
    "trend": "Trend Alignment",
    "ema_alignment": "EMA Alignment",
    "market_structure": "Market Structure",
    "break_resistance": "Break Resistance",
    "break_support": "Break Support",
    "above_ema20": "Reclaim EMA20",
    "below_ema20": "Reject EMA20",
    "rsi_healthy": "RSI Momentum",
    "macd_bullish": "MACD Bullish Cross",
    "macd_bearish": "MACD Bearish Cross",
    "volume_confirmation": "Volume Confirmation",
    "retest_or_near_support": "Support Retest",
    "retest_or_near_resistance": "Resistance Retest",
    "risk_reward": "Risk : Reward >= 1:2",
}


def _bias(snap: Dict[str, Any]) -> int:
    """Weighted bias score. Positive → long, negative → short."""
    b = 0
    if snap["ema20"] > snap["ema50"]:
        b += 1
    else:
        b -= 1
    if snap["ema50"] > snap["ema200"]:
        b += 1
    else:
        b -= 1
    if snap["price"] > snap["ema20"]:
        b += 1
    else:
        b -= 1
    if snap["macd"] > snap["macd_signal"]:
        b += 1
    else:
        b -= 1
    if snap["trend"] == "bullish":
        b += 2
    elif snap["trend"] == "bearish":
        b -= 2
    return b


def _direction(snap: Dict[str, Any]) -> str:
    b = _bias(snap)
    if b >= 2:
        return "long"
    if b <= -2:
        return "short"
    return "neutral"


def _conditions(snap: Dict[str, Any], direction: str, rr: float, breakout: Optional[Dict[str, Any]] = None) -> Dict[str, bool]:
    price = snap["price"]
    r = snap["rsi"]
    ml, ms, mh = snap["macd"], snap["macd_signal"], snap["macd_hist"]
    support = snap["support"]
    resistance = snap["resistance"]
    ema20, ema50, ema200 = snap["ema20"], snap["ema50"], snap["ema200"]
    breakout_ok = bool(breakout and breakout.get("confirmed"))

    if direction == "long":
        return {
            "trend": snap["trend"] == "bullish",
            "ema_alignment": ema20 > ema50 > ema200,
            "market_structure": snap["structure"] == "HH-HL" or snap["bos"],
            "break_resistance": breakout_ok,
            "above_ema20": price > ema20,
            "rsi_healthy": 45 <= r <= 72,
            "macd_bullish": ml > ms and mh > 0,
            "volume_confirmation": snap["volume_spike"] or snap["volume"] > snap["volume_avg20"],
            "retest_or_near_support": abs(price - support) / max(price, 1) < 0.03,
            "risk_reward": rr >= 2.0,
        }
    if direction == "short":
        return {
            "trend": snap["trend"] == "bearish",
            "ema_alignment": ema20 < ema50 < ema200,
            "market_structure": snap["structure"] == "LH-LL" or snap["bos"],
            "break_support": breakout_ok,
            "below_ema20": price < ema20,
            "rsi_healthy": 28 <= r <= 55,
            "macd_bearish": ml < ms and mh < 0,
            "volume_confirmation": snap["volume_spike"] or snap["volume"] > snap["volume_avg20"],
            "retest_or_near_resistance": abs(resistance - price) / max(price, 1) < 0.03,
            "risk_reward": rr >= 2.0,
        }
    # Neutral
    return {"neutral_bias": True}


def _weighted_score(snap: Dict[str, Any], direction: str, cond: Dict[str, bool], rr: float) -> int:
    """Weighted scoring 0-100."""
    if direction == "neutral":
        # Give a small base score based on how close it is to trending
        b = abs(_bias(snap))
        return min(60, 20 + b * 8)

    weights = {
        "trend": 15,
        "ema_alignment": 15,
        "market_structure": 12,
        "break_resistance": 8,
        "break_support": 8,
        "above_ema20": 5,
        "below_ema20": 5,
        "rsi_healthy": 10,
        "macd_bullish": 12,
        "macd_bearish": 12,
        "volume_confirmation": 10,
        "retest_or_near_support": 8,
        "retest_or_near_resistance": 8,
        "risk_reward": 15,
    }
    total = 0
    max_total = 0
    for k, v in cond.items():
        w = weights.get(k, 5)
        max_total += w
        if v:
            total += w
    pct = int((total / max_total) * 100) if max_total else 0
    # RR bonus
    if rr >= 3.0:
        pct = min(100, pct + 5)
    return pct


def _grade(score: int) -> str:
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 65:
        return "B"
    return "C"


def _action(direction: str, score: int, confidence: int) -> str:
    if confidence < 85 or score < 80 or direction == "neutral":
        return "WAIT"
    if direction == "long":
        return "BUY"
    if direction == "short":
        return "SELL"
    return "WAIT"


def _display_checklist(snap: Dict[str, Any], direction: str, cond: Dict[str, bool], breakout: Optional[Dict[str, Any]] = None) -> Dict[str, bool]:
    """Return a standardized 6-item live checklist for the UI."""
    price = snap["price"]
    ema20 = snap["ema20"]
    breakout_ok = bool(breakout and breakout.get("confirmed"))
    if direction == "long":
        return {
            "Trend Confirmed": snap["trend"] == "bullish" or (snap["ema20"] > snap["ema50"]),
            "EMA Alignment": snap["ema20"] > snap["ema50"] > snap["ema200"],
            "Support Holding": price > snap["support"] * 1.001,
            "Volume Confirmation": snap["volume_spike"] or snap["volume"] > snap["volume_avg20"],
            "Breakout Confirmed": breakout_ok,
            "Retest Complete": (breakout is not None and breakout.get("retest_held", False)) or (price > ema20 and 45 <= snap["rsi"] <= 70),
        }
    if direction == "short":
        return {
            "Trend Confirmed": snap["trend"] == "bearish" or (snap["ema20"] < snap["ema50"]),
            "EMA Alignment": snap["ema20"] < snap["ema50"] < snap["ema200"],
            "Support Holding": price < snap["resistance"] * 0.999,
            "Volume Confirmation": snap["volume_spike"] or snap["volume"] > snap["volume_avg20"],
            "Breakout Confirmed": breakout_ok,
            "Retest Complete": (breakout is not None and breakout.get("retest_held", False)) or (price < ema20 and 30 <= snap["rsi"] <= 55),
        }
    return {
        "Trend Confirmed": False,
        "EMA Alignment": False,
        "Support Holding": False,
        "Volume Confirmation": False,
        "Breakout Confirmed": False,
        "Retest Complete": False,
    }


def build_setup(symbol: str, klines: List, htf_klines: Optional[List] = None) -> Dict[str, Any]:
    if not klines or len(klines) < 60:
        return None
    snap = compute_snapshot(klines)
    direction = _direction(snap)
    price = snap["price"]
    atr_val = max(snap["atr"], price * 0.005)

    if direction == "long":
        entry = price
        stop_loss = max(min(snap["support"], price - atr_val * 1.5), price - atr_val * 3)
        risk = price - stop_loss
        tp1 = price + risk * 2.0
        tp2 = price + risk * 3.5
        tp3 = price + risk * 5.0
    elif direction == "short":
        entry = price
        stop_loss = min(max(snap["resistance"], price + atr_val * 1.5), price + atr_val * 3)
        risk = stop_loss - price
        tp1 = price - risk * 2.0
        tp2 = price - risk * 3.5
        tp3 = price - risk * 5.0
    else:
        entry = price
        stop_loss = price - atr_val
        risk = atr_val
        tp1 = price + atr_val * 2
        tp2 = price + atr_val * 3
        tp3 = price + atr_val * 4

    # ---- Auto Risk:Reward — pick highest realistic ratio ----
    auto_rr = 2.0
    if direction == "long" and risk > 0:
        # Try 3, 2.5, 2, 1.5 — pick highest where TP1 stays within reasonable reach of resistance
        for candidate in (3.0, 2.5, 2.0, 1.5):
            tp_test = entry + risk * candidate
            # Allow TP up to 3% beyond nearest resistance (targets often overshoot slightly)
            if tp_test <= snap["resistance"] * 1.03 or candidate == 1.5:
                auto_rr = candidate
                break
    elif direction == "short" and risk > 0:
        for candidate in (3.0, 2.5, 2.0, 1.5):
            tp_test = entry - risk * candidate
            if tp_test >= snap["support"] * 0.97 or candidate == 1.5:
                auto_rr = candidate
                break
    # Recompute TPs using auto_rr as primary
    if direction == "long":
        tp1 = entry + risk * auto_rr
        tp2 = entry + risk * (auto_rr * 1.75)
    elif direction == "short":
        tp1 = entry - risk * auto_rr
        tp2 = entry - risk * (auto_rr * 1.75)
    rr = auto_rr

    # ---- Higher timeframe snapshot (computed once, reused by breakout + htf_status) ----
    htf_snap = None
    if htf_klines and len(htf_klines) >= 60:
        try:
            htf_snap = compute_snapshot(htf_klines)
        except Exception:
            htf_snap = None

    # ---- Intelligent Breakout Confirmation ----
    breakout = None
    if direction == "long":
        breakout = breakout_confirmation(
            klines, snap["resistance"], "long", atr_val,
            snap["structure"], htf_snap=htf_snap, snap=snap,
        )
    elif direction == "short":
        breakout = breakout_confirmation(
            klines, snap["support"], "short", atr_val,
            snap["structure"], htf_snap=htf_snap, snap=snap,
        )

    cond = _conditions(snap, direction, rr, breakout)
    display_checklist = _display_checklist(snap, direction, cond, breakout)

    # ---- Liquidity Sweep detection ----
    liquidity_sweep_status = None
    try:
        recent = klines[-5:]
        highs = [float(k[2]) for k in recent]
        lows = [float(k[3]) for k in recent]
        closes = [float(k[4]) for k in recent]
        res = snap["resistance"]
        sup = snap["support"]
        # Wick above resistance but close below → possible sweep (fake breakout up)
        if direction == "long" and max(highs) > res and closes[-1] < res:
            liquidity_sweep_status = "possible_sweep"
        elif direction == "long" and max(highs) > res and closes[-1] > res:
            liquidity_sweep_status = "real_breakout"
        elif direction == "short" and min(lows) < sup and closes[-1] > sup:
            liquidity_sweep_status = "possible_sweep"
        elif direction == "short" and min(lows) < sup and closes[-1] < sup:
            liquidity_sweep_status = "real_breakout"
    except Exception:
        pass

    # ---- Higher Timeframe Confirmation (uses htf_snap already computed above) ----
    htf_status = None
    if htf_snap is not None:
        try:
            htf_dir = _direction(htf_snap)
            if direction != "neutral" and htf_dir == direction:
                htf_status = "confirmed"
            else:
                htf_status = "unconfirmed"
        except Exception:
            pass

    # ---- Score / grade / action anchored to CHECKLIST (single source of truth) ----
    passed = sum(1 for v in display_checklist.values() if v)
    total_checks = len(display_checklist)
    structure = snap["structure"]

    # Structural quality gates — no contradictions
    structure_ok = structure in ("HH-HL", "LH-LL")
    trend_ok = snap["trend"] in ("bullish", "bearish")

    if direction == "neutral":
        grade = "C"
        action = "WAIT"
        score = min(_weighted_score(snap, direction, cond, rr), 50)
        confidence = max(20, score - 15)
    else:
        if passed == total_checks and structure_ok and trend_ok:
            grade = "A+"
            action = "BUY" if direction == "long" else "SELL"
            score = 95
            confidence = 92
        elif passed >= total_checks - 1 and (structure_ok or trend_ok):
            grade = "A"
            action = "BUY" if direction == "long" else "SELL"
            score = 85
            confidence = 87
        elif passed >= 3:
            grade = "B"
            action = "WAIT"
            score = 60 + passed * 3
            confidence = 60 + passed * 3
        else:
            grade = "C"
            action = "WAIT"
            score = 40 + passed * 5
            confidence = 30 + passed * 5

        # Advanced demotions — active warnings never coexist with A+
        if htf_status == "unconfirmed" and grade == "A+":
            grade, action, score, confidence = "A", ("BUY" if direction == "long" else "SELL"), 82, 84
        if liquidity_sweep_status == "possible_sweep" and grade in ("A+", "A"):
            grade = "B"
            action = "WAIT"
            score = min(score, 74)
            confidence = min(confidence, 78)

    # ---- Final validation clamps: no self-contradictions ----
    if not structure_ok and grade == "A+":
        grade = "A"
        action = "BUY" if direction == "long" else "SELL"
        score = min(score, 85)
        confidence = min(confidence, 87)
    if not trend_ok and grade in ("A+", "A"):
        grade = "B"
        action = "WAIT"
        score = min(score, 72)
        confidence = min(confidence, 74)
    if action == "WAIT":
        confidence = min(confidence, 82)
    if grade == "A+":
        confidence = max(confidence, 88)
    elif grade == "A":
        confidence = max(80, min(confidence, 89))

    # ---- Entry quality: is NOW a good moment to enter? ----
    # Optimal entry = right at support (long) or resistance (short) on retest.
    entry_quality_score = 0
    if direction == "long":
        # Distance from support as % of ATR
        dist = (price - snap["support"]) / max(atr_val, 1e-9)
        entry_quality_score = max(0, 100 - int(dist * 15))
    elif direction == "short":
        dist = (snap["resistance"] - price) / max(atr_val, 1e-9)
        entry_quality_score = max(0, 100 - int(dist * 15))
    entry_quality_score = min(100, entry_quality_score)
    if entry_quality_score >= 85:
        entry_quality_label = "Excellent"
    elif entry_quality_score >= 70:
        entry_quality_label = "Good"
    elif entry_quality_score >= 50:
        entry_quality_label = "Fair"
    else:
        entry_quality_label = "Wait for Pullback"

    missing = [CONDITION_LABELS.get(k, k) for k, v in cond.items() if not v]

    checklist_reasons: Dict[str, str] = {}
    if breakout:
        checklist_reasons["Breakout Confirmed"] = breakout.get("reason", "")
        if breakout.get("retest_held"):
            checklist_reasons["Retest Complete"] = "Retest of level held — price bounced away"

    return {
        "symbol": symbol,
        "direction": direction,
        "price": snap["price"],
        "trend": snap["trend"],
        "market_structure": snap["structure"],
        "support": snap["support"],
        "resistance": snap["resistance"],
        "entry": round(entry, 6),
        "stop_loss": round(stop_loss, 6),
        "take_profit_1": round(tp1, 6),
        "take_profit_2": round(tp2, 6),
        "take_profit_3": round(tp3, 6),
        "risk_reward": rr,
        "auto_rr": rr,
        "ai_score": score,
        "confidence": confidence,
        "trade_grade": grade,
        "action": action,
        "entry_quality_score": entry_quality_score,
        "entry_quality_label": entry_quality_label,
        "change_pct": snap["change_pct"],
        "rsi": snap["rsi"],
        "conditions": cond,
        "missing_conditions": missing,
        "display_checklist": display_checklist,
        "checklist_reasons": checklist_reasons,
        "breakout_analysis": breakout,
        "liquidity_sweep_status": liquidity_sweep_status,
        "htf_status": htf_status,
        "snapshot": snap,
    }
