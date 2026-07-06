"""Rule-based scan engine — no LLM. Scores each pair 0-100 and lists missing conditions."""
from typing import Dict, List, Any
from indicators import compute_snapshot


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


def _conditions(snap: Dict[str, Any], direction: str, rr: float) -> Dict[str, bool]:
    price = snap["price"]
    r = snap["rsi"]
    ml, ms, mh = snap["macd"], snap["macd_signal"], snap["macd_hist"]
    support = snap["support"]
    resistance = snap["resistance"]
    ema20, ema50, ema200 = snap["ema20"], snap["ema50"], snap["ema200"]

    if direction == "long":
        return {
            "trend": snap["trend"] == "bullish",
            "ema_alignment": ema20 > ema50 > ema200,
            "market_structure": snap["structure"] == "HH-HL" or snap["bos"],
            "break_resistance": price > resistance * 0.998,
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
            "break_support": price < support * 1.002,
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


def _display_checklist(snap: Dict[str, Any], direction: str, cond: Dict[str, bool]) -> Dict[str, bool]:
    """Return a standardized 6-item live checklist for the UI."""
    price = snap["price"]
    ema20 = snap["ema20"]
    if direction == "long":
        return {
            "Trend Confirmed": snap["trend"] == "bullish" or (snap["ema20"] > snap["ema50"]),
            "EMA Alignment": snap["ema20"] > snap["ema50"] > snap["ema200"],
            "Support Holding": price > snap["support"] * 1.001,
            "Volume Confirmation": snap["volume_spike"] or snap["volume"] > snap["volume_avg20"],
            "Breakout Confirmed": price > snap["resistance"] * 0.998,
            "Retest Complete": price > ema20 and 45 <= snap["rsi"] <= 70,
        }
    if direction == "short":
        return {
            "Trend Confirmed": snap["trend"] == "bearish" or (snap["ema20"] < snap["ema50"]),
            "EMA Alignment": snap["ema20"] < snap["ema50"] < snap["ema200"],
            "Support Holding": price < snap["resistance"] * 0.999,
            "Volume Confirmation": snap["volume_spike"] or snap["volume"] > snap["volume_avg20"],
            "Breakout Confirmed": price < snap["support"] * 1.002,
            "Retest Complete": price < ema20 and 30 <= snap["rsi"] <= 55,
        }
    return {
        "Trend Confirmed": False,
        "EMA Alignment": False,
        "Support Holding": False,
        "Volume Confirmation": False,
        "Breakout Confirmed": False,
        "Retest Complete": False,
    }


def build_setup(symbol: str, klines: List) -> Dict[str, Any]:
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

    reward = abs(tp1 - entry)
    rr = round(reward / risk, 2) if risk > 0 else 0.0

    cond = _conditions(snap, direction, rr)
    score = _weighted_score(snap, direction, cond, rr)
    confidence = score if direction != "neutral" else max(20, score - 15)
    grade = _grade(score)
    action = _action(direction, score, confidence)

    missing = [CONDITION_LABELS.get(k, k) for k, v in cond.items() if not v]
    display_checklist = _display_checklist(snap, direction, cond)

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
        "ai_score": score,
        "confidence": confidence,
        "trade_grade": grade,
        "action": action,
        "change_pct": snap["change_pct"],
        "rsi": snap["rsi"],
        "conditions": cond,
        "missing_conditions": missing,
        "display_checklist": display_checklist,
        "snapshot": snap,
    }
