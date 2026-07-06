"""Tests for new Probexa features: Goal Tracker, Trades, and updated Setup schema
(market_structure + display_checklist)."""
import pytest
import requests

BASE_URL = "https://futures-analyzer-4.preview.emergentagent.com"
TOKEN = "test-token-abc-123"

DISPLAY_CHECKLIST_KEYS = {
    "Trend Confirmed",
    "EMA Alignment",
    "Support Holding",
    "Volume Confirmation",
    "Breakout Confirmed",
    "Retest Complete",
}

SETUP_EXISTING_KEYS = {
    "trend", "support", "resistance", "entry", "stop_loss",
    "take_profit_1", "take_profit_2", "risk_reward",
    "ai_score", "confidence", "trade_grade", "action",
}

GOALS_KEYS = {
    "current_balance", "starting_balance", "target_balance",
    "daily_profit_goal", "weekly_profit_goal", "monthly_profit_goal",
    "max_daily_loss", "max_weekly_loss",
}

STATS_KEYS = {
    "current_balance", "starting_balance", "target_balance",
    "total_progress_pct", "remaining_to_goal",
    "today_pnl", "week_pnl", "month_pnl",
    "daily_progress_pct", "weekly_progress_pct", "monthly_progress_pct",
    "daily_loss_pct", "weekly_loss_pct",
    "win_rate", "total_trades", "consecutive_wins", "consecutive_losses",
    "daily_goal_hit", "daily_loss_hit",
}


# -------------------- Updated Setup Schema --------------------
class TestSetupSchema:
    """Verify /api/setup/{symbol} now returns market_structure + display_checklist."""

    @pytest.mark.parametrize("symbol", ["BTCUSDT", "ETHUSDT"])
    def test_setup_has_new_fields(self, api_client, symbol):
        r = api_client.get(f"{BASE_URL}/api/setup/{symbol}",
                           params={"timeframe": "1h"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()

        # New fields
        assert "market_structure" in d, "missing market_structure"
        assert isinstance(d["market_structure"], str)

        assert "display_checklist" in d, "missing display_checklist"
        checklist = d["display_checklist"]
        assert isinstance(checklist, dict), "display_checklist must be dict"
        assert set(checklist.keys()) == DISPLAY_CHECKLIST_KEYS, (
            f"display_checklist keys mismatch: got {set(checklist.keys())}"
        )
        for k, v in checklist.items():
            assert isinstance(v, bool), f"display_checklist['{k}']={v} not bool"

        # Existing fields still present
        missing = SETUP_EXISTING_KEYS - set(d.keys())
        assert not missing, f"missing existing keys: {missing}"


class TestScanSchema:
    """Verify /api/scan includes display_checklist in best_setups + preparing."""

    def test_scan_items_have_display_checklist(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/scan",
                           params={"timeframe": "1h"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "best_setups" in d and "preparing" in d

        all_items = d["best_setups"] + d["preparing"]
        # Skip only if universe totally empty — but there should be preparing items
        assert len(all_items) > 0, "no setups returned to validate"

        for item in all_items:
            assert "display_checklist" in item, (
                f"missing display_checklist in {item.get('symbol')}"
            )
            assert set(item["display_checklist"].keys()) == DISPLAY_CHECKLIST_KEYS, (
                f"{item.get('symbol')} bad keys: {set(item['display_checklist'].keys())}"
            )
            assert "market_structure" in item, f"missing market_structure in {item.get('symbol')}"


# -------------------- Goals CRUD --------------------
class TestGoals:
    def test_goals_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/goals")
        assert r.status_code == 401

    def test_get_goals_returns_all_8_keys(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/goals")
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d.keys()) == GOALS_KEYS, f"goals keys mismatch: {set(d.keys())}"
        for k in GOALS_KEYS:
            assert isinstance(d[k], (int, float)), f"{k} not numeric"

    def test_put_goals_persists(self, auth_client):
        payload = {
            "current_balance": 1000,
            "target_balance": 5000,
            "daily_profit_goal": 50,
            "weekly_profit_goal": 300,
            "monthly_profit_goal": 1000,
            "max_daily_loss": 100,
            "max_weekly_loss": 300,
        }
        r = auth_client.put(f"{BASE_URL}/api/goals", json=payload)
        assert r.status_code == 200, r.text
        saved = r.json()
        for k, v in payload.items():
            assert float(saved[k]) == float(v), f"{k}: {saved[k]} != {v}"

        # starting_balance should be set (either to current_balance or previously stored)
        assert "starting_balance" in saved
        assert isinstance(saved["starting_balance"], (int, float))

        # Verify persistence via GET
        r2 = auth_client.get(f"{BASE_URL}/api/goals")
        got = r2.json()
        for k, v in payload.items():
            assert float(got[k]) == float(v)


# -------------------- Goals Summary --------------------
class TestGoalsSummary:
    def test_summary_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/goals/summary")
        assert r.status_code == 401

    def test_summary_shape(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/goals/summary")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "goals" in d and "stats" in d
        assert set(d["goals"].keys()) >= GOALS_KEYS
        missing = STATS_KEYS - set(d["stats"].keys())
        assert not missing, f"stats missing: {missing}"


# -------------------- Trades --------------------
class TestTradesAuth:
    def test_trades_get_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/trades")
        assert r.status_code == 401

    def test_trades_post_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/trades",
                            json={"symbol": "BTCUSDT", "side": "BUY", "pnl": 10})
        assert r.status_code == 401


class TestTradesFlow:
    """Log a trade, verify balance updates, verify list, then delete + verify revert."""

    def test_add_trade_updates_balance_and_appears_in_list(self, auth_client):
        # Reset goals to a known baseline
        auth_client.put(f"{BASE_URL}/api/goals", json={
            "current_balance": 1000,
            "target_balance": 5000,
            "daily_profit_goal": 50,
            "weekly_profit_goal": 300,
            "monthly_profit_goal": 1000,
            "max_daily_loss": 100,
            "max_weekly_loss": 300,
        })
        bal_before = float(auth_client.get(f"{BASE_URL}/api/goals").json()["current_balance"])

        # Log win trade
        r = auth_client.post(f"{BASE_URL}/api/trades",
                             json={"symbol": "BTCUSDT", "side": "BUY", "pnl": 25.5})
        assert r.status_code == 200, r.text
        trade = r.json()
        assert "trade_id" in trade
        assert trade["won"] is True
        assert trade["symbol"] == "BTCUSDT"
        assert float(trade["pnl"]) == 25.5
        trade_id = trade["trade_id"]

        # Verify in list
        lst = auth_client.get(f"{BASE_URL}/api/trades").json()["items"]
        assert any(t["trade_id"] == trade_id for t in lst)

        # Balance increased by 25.5
        bal_after = float(auth_client.get(f"{BASE_URL}/api/goals").json()["current_balance"])
        assert round(bal_after - bal_before, 2) == 25.5, f"{bal_before} -> {bal_after}"

        # Cleanup: delete the trade, verify balance reverts
        r_del = auth_client.delete(f"{BASE_URL}/api/trades/{trade_id}")
        assert r_del.status_code == 200
        lst2 = auth_client.get(f"{BASE_URL}/api/trades").json()["items"]
        assert not any(t["trade_id"] == trade_id for t in lst2)
        bal_reverted = float(auth_client.get(f"{BASE_URL}/api/goals").json()["current_balance"])
        assert round(bal_reverted, 2) == round(bal_before, 2), (
            f"balance did not revert: before={bal_before} after_delete={bal_reverted}"
        )

    def test_summary_reflects_win_and_loss(self, auth_client):
        # Baseline reset (goals only; can't easily wipe historical trades but today_pnl only counts today)
        auth_client.put(f"{BASE_URL}/api/goals", json={
            "current_balance": 1000,
            "target_balance": 5000,
            "daily_profit_goal": 50,
            "weekly_profit_goal": 300,
            "monthly_profit_goal": 1000,
            "max_daily_loss": 100,
            "max_weekly_loss": 300,
        })

        # Snapshot summary state before
        s0 = auth_client.get(f"{BASE_URL}/api/goals/summary").json()["stats"]
        today0 = float(s0["today_pnl"])
        total0 = int(s0["total_trades"])

        # Log a win
        t_win = auth_client.post(f"{BASE_URL}/api/trades",
                                 json={"symbol": "BTCUSDT", "side": "BUY", "pnl": 25.5}).json()
        # Log a loss
        t_loss = auth_client.post(f"{BASE_URL}/api/trades",
                                  json={"symbol": "BTCUSDT", "side": "SELL", "pnl": -10}).json()

        s1 = auth_client.get(f"{BASE_URL}/api/goals/summary").json()["stats"]
        # today_pnl delta should be 15.5
        assert round(float(s1["today_pnl"]) - today0, 2) == 15.5, (
            f"today_pnl delta {float(s1['today_pnl']) - today0}"
        )
        # total_trades increased by 2
        assert int(s1["total_trades"]) == total0 + 2
        # win_rate must be a number in [0,100]
        assert 0 <= float(s1["win_rate"]) <= 100

        # Cleanup: delete both trades
        auth_client.delete(f"{BASE_URL}/api/trades/{t_win['trade_id']}")
        auth_client.delete(f"{BASE_URL}/api/trades/{t_loss['trade_id']}")


class TestDisciplineFlags:
    def test_daily_goal_hit_flag(self, auth_client):
        # Set low daily goal
        auth_client.put(f"{BASE_URL}/api/goals", json={
            "current_balance": 1000,
            "target_balance": 5000,
            "daily_profit_goal": 10,
            "weekly_profit_goal": 300,
            "monthly_profit_goal": 1000,
            "max_daily_loss": 500,  # high so no false loss trigger
            "max_weekly_loss": 500,
        })
        # Ensure baseline today_pnl >= goal after we log $15 — but if today already
        # accumulated negative, add extra buffer. Log a bigger win to be safe.
        t = auth_client.post(f"{BASE_URL}/api/trades",
                             json={"symbol": "BTCUSDT", "side": "BUY", "pnl": 15}).json()
        stats = auth_client.get(f"{BASE_URL}/api/goals/summary").json()["stats"]
        # today_pnl should be >= 10 → daily_goal_hit True (if not, may be due to
        # prior loss trades today; log a compensating extra trade)
        if not stats["daily_goal_hit"]:
            deficit = 10 - float(stats["today_pnl"])
            if deficit > 0:
                extra = auth_client.post(f"{BASE_URL}/api/trades",
                                         json={"symbol": "BTCUSDT", "side": "BUY",
                                               "pnl": deficit + 5}).json()
                stats = auth_client.get(f"{BASE_URL}/api/goals/summary").json()["stats"]
                auth_client.delete(f"{BASE_URL}/api/trades/{extra['trade_id']}")
        assert stats["daily_goal_hit"] is True, f"stats={stats}"
        auth_client.delete(f"{BASE_URL}/api/trades/{t['trade_id']}")

    def test_daily_loss_hit_flag(self, auth_client):
        # Set low max_daily_loss
        auth_client.put(f"{BASE_URL}/api/goals", json={
            "current_balance": 1000,
            "target_balance": 5000,
            "daily_profit_goal": 1000,  # high so no goal_hit false trigger
            "weekly_profit_goal": 1000,
            "monthly_profit_goal": 1000,
            "max_daily_loss": 5,
            "max_weekly_loss": 500,
        })
        t = auth_client.post(f"{BASE_URL}/api/trades",
                             json={"symbol": "BTCUSDT", "side": "SELL", "pnl": -10}).json()
        stats = auth_client.get(f"{BASE_URL}/api/goals/summary").json()["stats"]
        # If prior wins are dragging today_pnl positive, add another loss
        if not stats["daily_loss_hit"]:
            surplus = float(stats["today_pnl"])
            if surplus > -5:
                need = surplus + 5 + 1  # push loss beyond -5
                extra = auth_client.post(f"{BASE_URL}/api/trades",
                                         json={"symbol": "BTCUSDT", "side": "SELL",
                                               "pnl": -need}).json()
                stats = auth_client.get(f"{BASE_URL}/api/goals/summary").json()["stats"]
                auth_client.delete(f"{BASE_URL}/api/trades/{extra['trade_id']}")
        assert stats["daily_loss_hit"] is True, f"stats={stats}"
        auth_client.delete(f"{BASE_URL}/api/trades/{t['trade_id']}")
