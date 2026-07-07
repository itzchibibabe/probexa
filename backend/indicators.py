"""Technical indicators computed with numpy/pandas (no ta-lib dep)."""
import numpy as np
import pandas as pd
from typing import List, Dict, Any


def to_df(klines: List[List]) -> pd.DataFrame:
    """Normalized kline: [openTime, open, high, low, close, volume, ...]. Accepts extra trailing cols."""
    rows = []
    for k in klines:
        rows.append({
            "openTime": int(k[0]),
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })
    df = pd.DataFrame(rows)
    return df


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def macd(series: pd.Series):
    fast = ema(series, 12)
    slow = ema(series, 26)
    macd_line = fast - slow
    signal = ema(macd_line, 9)
    hist = macd_line - signal
    return macd_line, signal, hist


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def find_swings(df: pd.DataFrame, lookback: int = 5):
    highs, lows = [], []
    highs_arr, lows_arr = df["high"].values, df["low"].values
    n = len(df)
    for i in range(lookback, n - lookback):
        if highs_arr[i] == max(highs_arr[i - lookback:i + lookback + 1]):
            highs.append((i, float(highs_arr[i])))
        if lows_arr[i] == min(lows_arr[i - lookback:i + lookback + 1]):
            lows.append((i, float(lows_arr[i])))
    return highs[-6:], lows[-6:]


def fibonacci_levels(high: float, low: float) -> Dict[str, float]:
    diff = high - low
    return {
        "0.0": round(high, 4),
        "0.236": round(high - diff * 0.236, 4),
        "0.382": round(high - diff * 0.382, 4),
        "0.5": round(high - diff * 0.5, 4),
        "0.618": round(high - diff * 0.618, 4),
        "0.786": round(high - diff * 0.786, 4),
        "1.0": round(low, 4),
    }


def market_structure(highs, lows) -> Dict[str, Any]:
    trend = "neutral"
    structure = "range"
    bos = False
    choch = False
    if len(highs) >= 2 and len(lows) >= 2:
        hh = highs[-1][1] > highs[-2][1]
        hl = lows[-1][1] > lows[-2][1]
        lh = highs[-1][1] < highs[-2][1]
        ll = lows[-1][1] < lows[-2][1]
        if hh and hl:
            trend = "bullish"
            structure = "HH-HL"
        elif lh and ll:
            trend = "bearish"
            structure = "LH-LL"
        else:
            structure = "mixed"
        if len(highs) >= 3:
            if hh and lows[-1][1] > highs[-2][1] * 0.98:
                bos = True
            if lh and hl:
                choch = True
    return {"trend": trend, "structure": structure, "bos": bos, "choch": choch}


def compute_snapshot(klines: List[List]) -> Dict[str, Any]:
    df = to_df(klines)
    close = df["close"]
    price = float(close.iloc[-1])
    ema20 = float(ema(close, 20).iloc[-1])
    ema50 = float(ema(close, 50).iloc[-1])
    ema200_period = min(200, len(df))
    ema200 = float(ema(close, ema200_period).iloc[-1])
    r = float(rsi(close).iloc[-1])
    m_line, m_sig, m_hist = macd(close)
    macd_val = float(m_line.iloc[-1])
    macd_sig = float(m_sig.iloc[-1])
    macd_hist = float(m_hist.iloc[-1])
    atr_val = float(atr(df).iloc[-1])
    vol = df["volume"]
    vol_avg = float(vol.tail(20).mean())
    vol_now = float(vol.iloc[-1])
    vol_spike = vol_now > vol_avg * 1.8

    highs, lows = find_swings(df)
    ms = market_structure(highs, lows)
    resistance = float(max(h[1] for h in highs)) if highs else float(df["high"].max())
    support = float(min(lo[1] for lo in lows)) if lows else float(df["low"].min())

    swing_high = float(df["high"].tail(50).max())
    swing_low = float(df["low"].tail(50).min())
    fib = fibonacci_levels(swing_high, swing_low)

    change_ref = close.iloc[-min(len(close), 24)]
    change_pct = float((close.iloc[-1] - change_ref) / change_ref * 100) if change_ref else 0.0

    return {
        "price": round(price, 6),
        "ema20": round(ema20, 6),
        "ema50": round(ema50, 6),
        "ema200": round(ema200, 6),
        "rsi": round(r, 2),
        "macd": round(macd_val, 6),
        "macd_signal": round(macd_sig, 6),
        "macd_hist": round(macd_hist, 6),
        "atr": round(atr_val, 6),
        "volume": round(vol_now, 2),
        "volume_avg20": round(vol_avg, 2),
        "volume_spike": vol_spike,
        "support": round(support, 6),
        "resistance": round(resistance, 6),
        "swing_high": round(swing_high, 6),
        "swing_low": round(swing_low, 6),
        "fibonacci": fib,
        "trend": ms["trend"],
        "structure": ms["structure"],
        "bos": ms["bos"],
        "choch": ms["choch"],
        "change_pct": round(change_pct, 2),
        "recent_highs": [round(h[1], 6) for h in highs],
        "recent_lows": [round(lo[1], 6) for lo in lows],
    }


def breakout_confirmation(
    klines: List[List],
    level: float,
    direction: str,
    atr_val: float,
    structure: str,
    htf_snap: Dict[str, Any] = None,
    snap: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """Intelligent multi-factor breakout confirmation.

    Ticks 'Breakout Confirmed' only when ALL of the following are true:
      1. Candle BODY closes clearly above resistance (long) / below support (short) — wicks alone never count
      2. Breakout volume above recent 20-candle average (+20%)
      3. Strong momentum: body >= 55% of candle range AND body >= 50% of ATR
      4. Market structure confirms (HH-HL long, LH-LL short)
      5. Price remains accepted — not immediately rejected back into the range
      6. Higher timeframe trend aligns (falls back to same-TF EMA200 slope if HTF data unavailable)

    A held retest is a *bonus* signal — not required for confirmation.
    Returns {confirmed, reason, criteria, retest_held}. Never raises.
    """
    if direction not in ("long", "short") or not klines or len(klines) < 25:
        return {
            "confirmed": False,
            "reason": "Direction unclear or insufficient candle data",
            "criteria": {},
            "retest_held": False,
        }

    df = to_df(klines)
    lookback = min(20, len(df) - 1)
    recent = df.tail(lookback + 1).reset_index(drop=True)

    # --- Locate the breakout candle (most recent clean cross of level) ---
    breakout_idx = None
    for i in range(len(recent) - 1, 0, -1):
        prev_close = float(recent.iloc[i - 1]["close"])
        cur_close = float(recent.iloc[i]["close"])
        cur_open = float(recent.iloc[i]["open"])
        if direction == "long":
            body_beyond = cur_close > level * 1.001 and cur_close > cur_open
            prev_beyond = prev_close > level
            if body_beyond and not prev_beyond:
                breakout_idx = i
                break
        else:
            body_beyond = cur_close < level * 0.999 and cur_close < cur_open
            prev_beyond = prev_close < level
            if body_beyond and not prev_beyond:
                breakout_idx = i
                break

    # If no fresh cross was found but price is already sitting beyond the level,
    # treat the most recent candle as the reference (already-broken-out regime).
    if breakout_idx is None:
        last = recent.iloc[-1]
        last_close = float(last["close"])
        if direction == "long" and last_close > level * 1.001:
            breakout_idx = len(recent) - 1
        elif direction == "short" and last_close < level * 0.999:
            breakout_idx = len(recent) - 1

    structure_confirms = (direction == "long" and structure == "HH-HL") or (
        direction == "short" and structure == "LH-LL"
    )

    if breakout_idx is None:
        side = "above" if direction == "long" else "below"
        return {
            "confirmed": False,
            "reason": f"No candle body has closed {side} the key level yet",
            "criteria": {
                "body_close_beyond_level": False,
                "volume_above_average": False,
                "strong_momentum_candle": False,
                "structure_confirms": structure_confirms,
                "price_still_accepted": False,
                "htf_aligned": False,
            },
            "retest_held": False,
        }

    b = recent.iloc[breakout_idx]
    b_open, b_close = float(b["open"]), float(b["close"])
    b_high, b_low = float(b["high"]), float(b["low"])
    b_vol = float(b["volume"])

    # 1. Body close beyond level (bullish/bearish body, not just a wick)
    if direction == "long":
        body_close_beyond = b_close > level * 1.001 and b_close > b_open
    else:
        body_close_beyond = b_close < level * 0.999 and b_close < b_open

    # 2. Volume above recent average (compared to the 20 candles BEFORE the breakout)
    vw_start = max(0, breakout_idx - 20)
    vw = recent["volume"].iloc[vw_start:breakout_idx]
    avg_vol = float(vw.mean()) if len(vw) else 0.0
    volume_above_avg = avg_vol > 0 and b_vol > avg_vol * 1.2

    # 3. Strong momentum candle — large body, not a doji
    body = abs(b_close - b_open)
    candle_range = max(b_high - b_low, 1e-9)
    body_ratio = body / candle_range
    body_vs_atr = body / max(atr_val, 1e-9)
    strong_momentum = body_ratio >= 0.55 and body_vs_atr >= 0.5

    # 5. Price still accepted — check candles AFTER breakout, if any
    post = recent.iloc[breakout_idx + 1 :]
    if len(post) == 0:
        price_accepted = body_close_beyond
    else:
        last_close = float(post.iloc[-1]["close"])
        if direction == "long":
            still_beyond = last_close > level * 0.999
            majority_held = int((post["close"] > level).sum()) >= max(1, int(len(post) * 0.5))
        else:
            still_beyond = last_close < level * 1.001
            majority_held = int((post["close"] < level).sum()) >= max(1, int(len(post) * 0.5))
        price_accepted = bool(still_beyond and majority_held)

    # 6. HTF alignment — real HTF data if supplied, else EMA200-slope proxy
    if htf_snap:
        htf_trend = htf_snap.get("trend", "neutral")
        h20, h50 = htf_snap.get("ema20", 0), htf_snap.get("ema50", 0)
        if direction == "long":
            htf_aligned = htf_trend == "bullish" or (h20 > h50)
        else:
            htf_aligned = htf_trend == "bearish" or (h20 < h50)
    elif snap:
        e50, e200 = snap.get("ema50", 0), snap.get("ema200", 0)
        p = snap.get("price", 0)
        if direction == "long":
            htf_aligned = p > e200 and e50 > e200
        else:
            htf_aligned = p < e200 and e50 < e200
    else:
        htf_aligned = False

    criteria = {
        "body_close_beyond_level": bool(body_close_beyond),
        "volume_above_average": bool(volume_above_avg),
        "strong_momentum_candle": bool(strong_momentum),
        "structure_confirms": bool(structure_confirms),
        "price_still_accepted": bool(price_accepted),
        "htf_aligned": bool(htf_aligned),
    }
    all_pass = all(criteria.values())

    # Bonus: retest held (do not require)
    retest_held = False
    if len(post) >= 2:
        for _, row in post.iterrows():
            if direction == "long":
                if float(row["low"]) <= level * 1.005 and float(row["close"]) > level:
                    retest_held = True
                    break
            else:
                if float(row["high"]) >= level * 0.995 and float(row["close"]) < level:
                    retest_held = True
                    break

    if all_pass:
        parts = ["Body closed beyond level", "volume surge", "strong candle",
                 f"{structure} structure", "level held"]
        if retest_held:
            parts.append("retest held")
        reason = " · ".join(parts)
    else:
        fails = []
        if not body_close_beyond:
            fails.append("body did not close beyond level (wick only)")
        if not volume_above_avg:
            fails.append("volume below recent average")
        if not strong_momentum:
            fails.append("weak candle (doji / small body)")
        if not structure_confirms:
            expected = "HH-HL" if direction == "long" else "LH-LL"
            fails.append(f"structure not {expected}")
        if not price_accepted:
            fails.append("price rejected back into range")
        if not htf_aligned:
            expected = "bullish" if direction == "long" else "bearish"
            fails.append(f"higher-timeframe trend not {expected}")
        reason = "; ".join(fails)

    return {
        "confirmed": bool(all_pass),
        "reason": reason,
        "criteria": criteria,
        "retest_held": bool(retest_held),
    }
