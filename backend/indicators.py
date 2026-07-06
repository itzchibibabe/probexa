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
