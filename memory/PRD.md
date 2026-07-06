# Probexa - PRD

**Tagline:** Only High-Probability Setups.

Probexa is an intelligent trading assistant (not an AI chatbot) that automatically scans crypto perpetual futures markets and grades setups A+ / A / B / C using technical analysis and predefined trading rules.

## Data Source
- **Binance Futures API is geo-blocked from the backend region.** Backend uses **OKX Perpetual Swap public API** (same symbols like BTCUSDT — internally mapped to BTC-USDT-SWAP). Prices are arbitrage-identical.
- TradingView chart (client-side) renders `BINANCE:{symbol}.P` since it runs in the user's browser.

## Rule-based scan engine
Score 0-100 built from weighted indicators (no LLM in the scan hot path):
- Trend + EMA20/50/200 alignment (25pts)
- Market Structure (HH-HL / LH-LL) + BOS/CHOCH (12pts)
- Break of resistance/support (8pts)
- RSI momentum in healthy zone (10pts)
- MACD alignment (12pts)
- Volume confirmation (10pts)
- Support/resistance retest proximity (8pts)
- Risk : Reward ≥ 1:2 (15pts)

Grades: **A+** ≥90, **A** ≥80, **B** ≥65, **C** <65.
Action: `WAIT` if confidence <85 or score <80 or direction neutral. Otherwise `BUY` or `SELL` based on directional bias.

## Screens

### Login
Emergent Google login. Brand "Probexa" + tagline "Only High-Probability Setups."

### Home (Analyze tab)
- Timeframe chips (15m/30m/1h/4h/1d)
- **Today's Best Setups**: cards (Coin, Price, AI Score, Confidence, BUY/SELL/WAIT). Empty state = "WAIT — no A+ setup right now."
- **Preparing A+ Setups**: cards (Coin, Preparing BUY/SELL, Score /100, Missing conditions list)
- Search button → pair search screen
- Pull-to-refresh
- 60s server-side cache

### Analyze detail `/analyze/[symbol]`
Minimal card only. Displays exactly:
- Trend, Market Structure, Support, Resistance
- Entry, Stop Loss, Take Profit 1, Take Profit 2
- Risk : Reward, Score /100, Confidence %, Trade Grade
- Status pill (BUY / SELL / WAIT)
- **Live Checklist** (6 items with ✓/✗): Trend Confirmed, EMA Alignment, Support Holding, Volume Confirmation, Breakout Confirmed, Retest Complete
- **"Open Smart Position Calculator"** button (pre-fills entry/SL/TP in Tools tab)
- Embedded TradingView chart (BINANCE prefix)
- Watchlist toggle

### Goal Dashboard `/goals`
Set: Current/Target Balance, Daily/Weekly/Monthly Profit Goals, Max Daily/Weekly Loss.
Displays: Balance card with progress bar, per-goal rows with progress %, performance grid (Win Rate, Total Trades, Consec Wins, Consec Losses).
Discipline banners:
- `🎉 Daily goal achieved. Consider stopping for today.` when daily_goal_hit
- `⚠ Daily loss limit reached. Trading is not recommended.` when daily_loss_hit
Log Trade Result: symbol + BUY/SELL + PnL → auto-updates balance and stats.

### Tools tab (Smart Position Calculator)
User enters: Wallet Balance, Risk %, Leverage.
Trade setup (Entry/SL/TP1/TP2/TP3) auto-fills from analyze detail via URL params.
Instantly computes:
- Recommended Margin
- Position Size (units)
- Position Notional
- Maximum Loss
- Expected Profit (TP1)
- Profits at TP2 / TP3
- Risk : Reward

### Watchlist tab
Add/remove pairs; live prices + 24h change.

### Alerts tab
Smart alert creation: A+ setup detected, price above/below, breakout with volume.

### Journal tab
History of saved analyses (from LLM `/analyze` when used).

### Tools tab
- Position Size / Risk Calculator: balance, risk %, leverage, entry, SL, TP1/2/3 → position size, notional, margin, max loss, profits at TP levels.
- Education accordion (glossary only).

## Backend Endpoints
- `GET /api/scan?timeframe=1h` — rule-based scan of top 20 pairs
- `GET /api/setup/{symbol}?timeframe=1h` — single-pair setup w/ 6-item checklist
- `GET /api/market/pairs|ticker|tickers|klines|funding|open-interest`
- `POST /api/analyze` (LLM, optional) + `/api/analyze/screenshot`
- `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`
- CRUD `/api/watchlist`, `/api/alerts`, `GET /api/journal`
- `POST /api/calculator`, `POST /api/register-push`
- **`GET/PUT /api/goals`** — user goal settings
- **`GET /api/goals/summary`** — computed stats + progress %
- **`GET/POST /api/trades`, `DELETE /api/trades/{id}`** — trade log

## Integrations
- **Emergent Google Login** (session token 7d)
- **Emergent Universal LLM key → Claude Sonnet 4.5** (used in `/api/analyze` + `/analyze/screenshot`; not in main scan path)
- **Emergent-managed Push Notifications** (works after deploy build)

## Auth
Bearer session tokens (7d), stored in `expo-secure-store` on native, `localStorage` on web.

## Design tokens
Dark surface `#0B0E14`, accents `#00D9FF` (blue) / `#00FF88` (green), warning `#FFB800`, error `#FF3B30`.
