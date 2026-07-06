"""Probexa - AI Crypto Futures Analyzer Backend (OKX perpetual swaps)."""
import os
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from indicators import compute_snapshot
from scan_engine import build_setup, DEFAULT_UNIVERSE

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("crypto-ai")

# ---------- MongoDB ----------
mongo_url = os.environ["MONGO_URL"]
mongo = AsyncIOMotorClient(mongo_url)
db = mongo[os.environ["DB_NAME"]]

# ---------- Constants ----------
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
EMERGENT_PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
OKX_BASE = "https://www.okx.com"
EMERGENT_AUTH_BASE = "https://demobackend.emergentagent.com"
EMERGENT_PUSH_BASE = "https://integrations.emergentagent.com"

http = httpx.AsyncClient(timeout=20.0)
push_client = httpx.AsyncClient(
    base_url=EMERGENT_PUSH_BASE,
    headers={"X-Push-Key": EMERGENT_PUSH_KEY},
    timeout=10.0,
)

app = FastAPI(title="Probexa")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
BAR_MAP = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1H", "2h": "2H", "4h": "4H", "6h": "6H", "12h": "12H",
    "1d": "1D", "1w": "1W",
}


def to_okx_inst(symbol: str) -> str:
    """BTCUSDT -> BTC-USDT-SWAP"""
    s = symbol.upper().replace("-SWAP", "").replace("-", "")
    if s.endswith("USDT"):
        base, quote = s[:-4], "USDT"
    elif s.endswith("USDC"):
        base, quote = s[:-4], "USDC"
    elif s.endswith("USD"):
        base, quote = s[:-3], "USD"
    else:
        base, quote = s, "USDT"
    return f"{base}-{quote}-SWAP"


def from_okx_inst(inst_id: str) -> str:
    """BTC-USDT-SWAP -> BTCUSDT"""
    parts = inst_id.split("-")
    if len(parts) >= 2:
        return parts[0] + parts[1]
    return inst_id


# ---------- Startup ----------
@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    logger.info("Indexes ready. EMERGENT_LLM_KEY set: %s", bool(EMERGENT_LLM_KEY))


@app.on_event("shutdown")
async def _shutdown():
    await http.aclose()
    await push_client.aclose()
    mongo.close()


# =====================================================
# AUTH — Emergent Google Login
# =====================================================
class SessionBody(BaseModel):
    session_id: str


async def _get_user_from_token(token: str) -> Optional[dict]:
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    exp = session["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization[7:]
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired session")
    return user


@api.post("/auth/session")
async def auth_session(body: SessionBody):
    resp = await http.get(
        f"{EMERGENT_AUTH_BASE}/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": body.session_id},
    )
    if resp.status_code != 200:
        raise HTTPException(401, "Session validation failed")
    data = resp.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
        })

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })

    return {"session_token": session_token, "user": {"user_id": user_id, "email": email, "name": name, "picture": picture}}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(require_user)):
    return {"user": user}


@api.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        await db.user_sessions.delete_one({"session_token": authorization[7:]})
    return {"ok": True}


# =====================================================
# MARKET DATA — OKX perpetual swaps (public)
# =====================================================
async def _okx_get(path: str, params: dict) -> list:
    r = await http.get(f"{OKX_BASE}{path}", params=params)
    if r.status_code != 200:
        raise HTTPException(502, f"OKX upstream {r.status_code}")
    d = r.json()
    if d.get("code") != "0":
        raise HTTPException(400, d.get("msg", "OKX error"))
    return d.get("data", [])


@api.get("/market/pairs")
async def market_pairs():
    data = await _okx_get("/api/v5/public/instruments", {"instType": "SWAP"})
    pairs = [from_okx_inst(x["instId"]) for x in data if x.get("state") == "live" and x["instId"].endswith("-USDT-SWAP")]
    return {"pairs": sorted(set(pairs))}


@api.get("/market/ticker")
async def market_ticker(symbol: str):
    inst = to_okx_inst(symbol)
    data = await _okx_get("/api/v5/market/ticker", {"instId": inst})
    if not data:
        raise HTTPException(404, "Symbol not found")
    d = data[0]
    open24 = float(d.get("open24h", 0) or 0)
    last = float(d.get("last", 0) or 0)
    change_pct = ((last - open24) / open24 * 100) if open24 else 0.0
    return {
        "symbol": symbol.upper(),
        "price": last,
        "change_pct": round(change_pct, 4),
        "volume": float(d.get("vol24h", 0) or 0),
        "quote_volume": float(d.get("volCcy24h", 0) or 0),
        "high": float(d.get("high24h", 0) or 0),
        "low": float(d.get("low24h", 0) or 0),
    }


@api.get("/market/tickers")
async def market_tickers(symbols: str):
    """Batch ticker for watchlist."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    data = await _okx_get("/api/v5/market/tickers", {"instType": "SWAP"})
    lookup = {from_okx_inst(x["instId"]): x for x in data}
    out = []
    for s in syms:
        d = lookup.get(s)
        if not d:
            continue
        open24 = float(d.get("open24h", 0) or 0)
        last = float(d.get("last", 0) or 0)
        change_pct = ((last - open24) / open24 * 100) if open24 else 0.0
        out.append({
            "symbol": s,
            "price": last,
            "change_pct": round(change_pct, 4),
            "volume": float(d.get("vol24h", 0) or 0),
        })
    return {"tickers": out}


async def _fetch_klines(symbol: str, interval: str, limit: int = 300) -> List[List]:
    inst = to_okx_inst(symbol)
    bar = BAR_MAP.get(interval.lower(), "1H")
    data = await _okx_get("/api/v5/market/candles", {"instId": inst, "bar": bar, "limit": min(limit, 300)})
    # OKX returns newest first — reverse to oldest first
    return list(reversed(data))


@api.get("/market/klines")
async def market_klines(symbol: str, interval: str = "1h", limit: int = 200):
    klines = await _fetch_klines(symbol, interval, limit)
    return {"klines": klines}


@api.get("/market/funding")
async def market_funding(symbol: str):
    try:
        inst = to_okx_inst(symbol)
        data = await _okx_get("/api/v5/public/funding-rate", {"instId": inst})
        if data:
            return {"funding_rate": float(data[0].get("fundingRate", 0) or 0)}
    except Exception:
        pass
    return {"funding_rate": 0.0}


@api.get("/market/open-interest")
async def market_open_interest(symbol: str):
    try:
        inst = to_okx_inst(symbol)
        data = await _okx_get("/api/v5/public/open-interest", {"instType": "SWAP", "instId": inst})
        if data:
            return {"open_interest": float(data[0].get("oi", 0) or 0)}
    except Exception:
        pass
    return {"open_interest": 0.0}


# =====================================================
# MARKET SCAN — rule-based, no LLM
# =====================================================
import asyncio as _asyncio
import time as _time

_scan_cache: Dict[str, Any] = {}
_SCAN_TTL = 60  # seconds


async def _fetch_one_setup(symbol: str, timeframe: str):
    try:
        klines = await _fetch_klines(symbol, timeframe, 250)
        setup = build_setup(symbol, klines)
        return setup
    except Exception as e:
        logger.debug("scan pair %s failed: %s", symbol, e)
        return None


@api.get("/scan")
async def scan_markets(timeframe: str = "1h", limit: int = 20):
    key = f"{timeframe}:{limit}"
    now = _time.time()
    cached = _scan_cache.get(key)
    if cached and (now - cached["at"] < _SCAN_TTL):
        return cached["data"]

    universe = DEFAULT_UNIVERSE[:limit]
    tasks = [_fetch_one_setup(s, timeframe) for s in universe]
    setups = await _asyncio.gather(*tasks)
    setups = [s for s in setups if s]

    best_setups = sorted(
        [s for s in setups if s["ai_score"] >= 80 and s["action"] in ("BUY", "SELL")],
        key=lambda x: (x["ai_score"], x["confidence"]),
        reverse=True,
    )[:8]

    preparing = sorted(
        [s for s in setups if 65 <= s["ai_score"] < 90 and s["direction"] != "neutral"],
        key=lambda x: x["ai_score"],
        reverse=True,
    )[:8]
    # Exclude items already in best_setups
    best_syms = {s["symbol"] for s in best_setups}
    preparing = [p for p in preparing if p["symbol"] not in best_syms][:6]

    # Sanitize snapshots (drop heavy fields) to reduce payload
    def strip(s):
        s = dict(s)
        s.pop("snapshot", None)
        return s

    data = {
        "timeframe": timeframe,
        "best_setups": [strip(s) for s in best_setups],
        "preparing": [strip(s) for s in preparing],
        "scanned_count": len(setups),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    _scan_cache[key] = {"at": now, "data": data}
    return data


@api.get("/setup/{symbol}")
async def get_setup(symbol: str, timeframe: str = "1h"):
    """Compute a full setup for a single symbol (rule-based, no LLM)."""
    klines = await _fetch_klines(symbol.upper(), timeframe, 250)
    setup = build_setup(symbol.upper(), klines)
    if not setup:
        raise HTTPException(400, "Not enough data")
    setup.pop("snapshot", None)
    return setup


# =====================================================
# AI ANALYSIS — Claude Sonnet 4.5
# =====================================================
ANALYZE_SYSTEM = """You are an elite crypto futures trading analyst. You ONLY recommend A+ probability setups.

STRICT RULES:
- If confidence < 85%, action MUST be "WAIT" and trade_quality MUST be "C" or lower.
- Never guess. Never force a trade. Capital preservation > profit.
- Only "A+" setups have BOTH trend + structure + volume + retest + RR>=2 aligned.
- Explain every decision in simple beginner-friendly language.

You MUST return ONLY valid JSON matching this exact schema:
{
  "trend": "bullish|bearish|neutral",
  "market_structure": "HH-HL|LH-LL|range|mixed",
  "support": number,
  "resistance": number,
  "buy_probability": number (0-100),
  "sell_probability": number (0-100),
  "trade_score": number (0-100),
  "trade_quality": "A+|A|B|C",
  "action": "BUY|SELL|WAIT",
  "reason": "simple 2-sentence explanation for beginners",
  "entry_price": number,
  "stop_loss": number,
  "take_profit_1": number,
  "take_profit_2": number,
  "take_profit_3": number,
  "risk_reward": number,
  "confidence": number (0-100),
  "volume_analysis": "one-line volume commentary",
  "invalidation": "one-line invalidation description",
  "next_alert_price": number,
  "education": "3-sentence beginner explanation of what happened and what to watch",
  "checklist": {
    "trend": boolean,
    "support_resistance": boolean,
    "market_structure": boolean,
    "breakout": boolean,
    "candle_confirmation": boolean,
    "volume_confirmation": boolean,
    "retest": boolean,
    "risk_reward": boolean
  }
}
No prose, no markdown, no backticks — JSON only."""


async def _call_claude(prompt: str, image_b64: Optional[str] = None) -> Dict[str, Any]:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"analyze-{uuid.uuid4().hex[:8]}",
        system_message=ANALYZE_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    kwargs: Dict[str, Any] = {"text": prompt}
    if image_b64:
        kwargs["file_contents"] = [ImageContent(image_base64=image_b64)]
    resp = await chat.send_message(UserMessage(**kwargs))
    raw = resp if isinstance(resp, str) else str(resp)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip("` \n")
    try:
        return json.loads(raw)
    except Exception as e:
        logger.error("Claude JSON parse failed: %s\nraw=%s", e, raw[:500])
        raise HTTPException(500, "AI response could not be parsed")


class AnalyzeRequest(BaseModel):
    symbol: str
    exchange: str = "okx"
    timeframe: str = "1h"


@api.post("/analyze")
async def analyze(body: AnalyzeRequest, user: dict = Depends(require_user)):
    symbol = body.symbol.upper()
    klines = await _fetch_klines(symbol, body.timeframe, 300)
    if len(klines) < 60:
        raise HTTPException(400, "Not enough data")

    snap = compute_snapshot(klines)

    funding = {"funding_rate": 0.0}
    oi = {"open_interest": 0.0}
    try:
        inst = to_okx_inst(symbol)
        f_data = await _okx_get("/api/v5/public/funding-rate", {"instId": inst})
        if f_data:
            funding["funding_rate"] = float(f_data[0].get("fundingRate", 0) or 0)
        o_data = await _okx_get("/api/v5/public/open-interest", {"instType": "SWAP", "instId": inst})
        if o_data:
            oi["open_interest"] = float(o_data[0].get("oi", 0) or 0)
    except Exception:
        pass

    prompt = f"""Analyze this LIVE {symbol} perpetual futures market snapshot on the {body.timeframe} timeframe.

CURRENT INDICATORS (computed from real OKX exchange data):
- Price: {snap['price']}
- % change (recent): {snap['change_pct']}%
- EMA20: {snap['ema20']}, EMA50: {snap['ema50']}, EMA200: {snap['ema200']}
- RSI(14): {snap['rsi']}
- MACD: {snap['macd']} / signal {snap['macd_signal']} / hist {snap['macd_hist']}
- ATR(14): {snap['atr']}
- Volume: {snap['volume']} vs 20-avg {snap['volume_avg20']} (spike={snap['volume_spike']})
- Support: {snap['support']} | Resistance: {snap['resistance']}
- Swing high: {snap['swing_high']} | Swing low: {snap['swing_low']}
- Fibonacci: {snap['fibonacci']}
- Trend: {snap['trend']} | Structure: {snap['structure']} | BOS: {snap['bos']} | CHOCH: {snap['choch']}
- Recent highs: {snap['recent_highs']}
- Recent lows: {snap['recent_lows']}
- Funding rate: {funding['funding_rate']}
- Open Interest: {oi['open_interest']}

Decide the trade grade. Remember: if confidence < 85 -> action=WAIT, quality=C.
Return ONLY the JSON per schema."""

    result = await _call_claude(prompt)

    analysis_id = f"a_{uuid.uuid4().hex[:12]}"
    record = {
        "analysis_id": analysis_id,
        "user_id": user["user_id"],
        "symbol": symbol,
        "exchange": body.exchange,
        "timeframe": body.timeframe,
        "snapshot": snap,
        "funding": funding,
        "open_interest": oi,
        "result": result,
        "created_at": datetime.now(timezone.utc),
    }
    await db.analyses.insert_one(record.copy())
    record.pop("_id", None)
    return {
        "analysis_id": analysis_id,
        "symbol": symbol,
        "timeframe": body.timeframe,
        "snapshot": snap,
        "funding": funding,
        "open_interest": oi,
        "result": result,
        "created_at": record["created_at"].isoformat(),
    }


class ScreenshotRequest(BaseModel):
    image_base64: str
    symbol: Optional[str] = None
    notes: Optional[str] = None


@api.post("/analyze/screenshot")
async def analyze_screenshot(body: ScreenshotRequest, user: dict = Depends(require_user)):
    prompt = f"""Analyze this trading chart screenshot{f' of {body.symbol}' if body.symbol else ''}.
Identify trend, market structure (HH-HL/LH-LL), support/resistance, candlestick patterns, volume, breakouts, retests.
{f'User notes: {body.notes}' if body.notes else ''}
Then output the A+ trade card as JSON per the strict schema. Remember: confidence < 85 -> WAIT."""
    result = await _call_claude(prompt, image_b64=body.image_base64)
    analysis_id = f"a_{uuid.uuid4().hex[:12]}"
    await db.analyses.insert_one({
        "analysis_id": analysis_id,
        "user_id": user["user_id"],
        "symbol": body.symbol or "SCREENSHOT",
        "exchange": "screenshot",
        "timeframe": "n/a",
        "result": result,
        "created_at": datetime.now(timezone.utc),
    })
    return {"analysis_id": analysis_id, "result": result}


# =====================================================
# WATCHLIST / ALERTS / JOURNAL
# =====================================================
class WatchlistAdd(BaseModel):
    symbol: str


@api.get("/watchlist")
async def get_watchlist(user: dict = Depends(require_user)):
    items = await db.watchlist.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    return {"items": items}


@api.post("/watchlist")
async def add_watchlist(body: WatchlistAdd, user: dict = Depends(require_user)):
    sym = body.symbol.upper()
    existing = await db.watchlist.find_one({"user_id": user["user_id"], "symbol": sym})
    if not existing:
        await db.watchlist.insert_one({"user_id": user["user_id"], "symbol": sym, "added_at": datetime.now(timezone.utc)})
    return {"ok": True}


@api.delete("/watchlist/{symbol}")
async def del_watchlist(symbol: str, user: dict = Depends(require_user)):
    await db.watchlist.delete_one({"user_id": user["user_id"], "symbol": symbol.upper()})
    return {"ok": True}


class AlertCreate(BaseModel):
    symbol: str
    condition: str
    target_price: Optional[float] = None
    note: Optional[str] = None


@api.get("/alerts")
async def get_alerts(user: dict = Depends(require_user)):
    items = await db.alerts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    return {"items": items}


@api.post("/alerts")
async def add_alert(body: AlertCreate, user: dict = Depends(require_user)):
    alert_id = f"al_{uuid.uuid4().hex[:12]}"
    doc = {
        "alert_id": alert_id,
        "user_id": user["user_id"],
        "symbol": body.symbol.upper(),
        "condition": body.condition,
        "target_price": body.target_price,
        "note": body.note or "",
        "enabled": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.alerts.insert_one(doc.copy())
    doc.pop("_id", None)
    doc["created_at"] = doc["created_at"].isoformat()
    return doc


@api.delete("/alerts/{alert_id}")
async def del_alert(alert_id: str, user: dict = Depends(require_user)):
    await db.alerts.delete_one({"user_id": user["user_id"], "alert_id": alert_id})
    return {"ok": True}


@api.get("/journal")
async def get_journal(user: dict = Depends(require_user)):
    items = await db.analyses.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for it in items:
        if isinstance(it.get("created_at"), datetime):
            it["created_at"] = it["created_at"].isoformat()
    return {"items": items}


# =====================================================
# POSITION SIZE CALCULATOR
# =====================================================
class CalcRequest(BaseModel):
    balance: float
    risk_pct: float
    entry: float
    stop_loss: float
    leverage: float = 1.0
    tp1: Optional[float] = None
    tp2: Optional[float] = None
    tp3: Optional[float] = None


@api.post("/calculator")
async def calculator(body: CalcRequest):
    if body.entry <= 0 or body.stop_loss <= 0:
        raise HTTPException(400, "Invalid entry/SL")
    risk_amount = body.balance * (body.risk_pct / 100.0)
    per_unit_risk = abs(body.entry - body.stop_loss)
    if per_unit_risk == 0:
        raise HTTPException(400, "Entry equals stop loss")
    position_units = risk_amount / per_unit_risk
    position_notional = position_units * body.entry
    margin_required = position_notional / max(body.leverage, 1)
    max_loss = risk_amount

    def profit_at(tp):
        if tp is None:
            return None
        return round(abs(tp - body.entry) * position_units, 2)

    return {
        "position_units": round(position_units, 6),
        "position_notional": round(position_notional, 2),
        "margin_required": round(margin_required, 2),
        "max_loss": round(max_loss, 2),
        "profit_tp1": profit_at(body.tp1),
        "profit_tp2": profit_at(body.tp2),
        "profit_tp3": profit_at(body.tp3),
    }


# =====================================================
# PUSH NOTIFICATIONS
# =====================================================
class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    try:
        resp = await push_client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Push register failed (non-blocking): %s", e)
    return {"status": "registered"}


async def send_push(recipients: List[str], data: dict, idempotency_key: Optional[str] = None):
    if not recipients:
        return
    payload: Dict[str, Any] = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    try:
        resp = await push_client.post("/api/v1/push/trigger", json=payload)
        resp.raise_for_status()
    except Exception as e:
        logger.warning("Push send failed (non-blocking): %s", e)


@api.get("/")
async def root():
    return {"app": "Probexa", "ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
