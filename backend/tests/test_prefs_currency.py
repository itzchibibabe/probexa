"""Tests for new endpoints: GET /api/currency/rates, GET/PUT /api/prefs."""
import time
import pytest


BASE = "https://futures-analyzer-4.preview.emergentagent.com"


# ---------- /api/currency/rates ----------
class TestCurrencyRates:
    def test_rates_ok_and_structure(self, api_client):
        r = api_client.get(f"{BASE}/api/currency/rates")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["base"] == "USD"
        assert "rates" in data and isinstance(data["rates"], dict)
        assert data["rates"].get("USD") == 1 or data["rates"].get("USD") == 1.0
        assert "updated_at" in data
        assert data.get("source") in ("open.er-api.com", "fallback")

    def test_rates_values_when_live(self, api_client):
        r = api_client.get(f"{BASE}/api/currency/rates")
        assert r.status_code == 200
        data = r.json()
        rates = data["rates"]
        if data["source"] == "fallback":
            pytest.skip("Upstream open.er-api.com unavailable; fallback served (acceptable per spec).")
        # Live rate sanity checks
        assert "INR" in rates, "INR missing from live rates"
        assert rates["INR"] > 50, f"INR rate suspiciously low: {rates['INR']}"
        assert "EUR" in rates
        assert 0.5 < rates["EUR"] < 2, f"EUR out of range: {rates['EUR']}"
        assert "GBP" in rates
        assert 0.3 < rates["GBP"] < 2, f"GBP out of range: {rates['GBP']}"

    def test_rates_caching_second_call(self, api_client):
        r1 = api_client.get(f"{BASE}/api/currency/rates")
        t0 = time.time()
        r2 = api_client.get(f"{BASE}/api/currency/rates")
        elapsed = time.time() - t0
        assert r2.status_code == 200
        # Cached responses should be near-instant (<1s over network)
        assert elapsed < 2.0, f"Second call too slow: {elapsed:.2f}s (expected cache hit)"
        # Rates identity should match
        assert r1.json()["rates"] == r2.json()["rates"]
        assert r1.json().get("updated_at") == r2.json().get("updated_at")


# ---------- /api/prefs ----------
NOTIF_KEYS = {"a_plus_ready", "watchlist", "daily_goal_achieved", "daily_loss_reached", "daily_summary"}


class TestPrefs:
    def test_get_prefs_unauth_401(self, api_client):
        r = api_client.get(f"{BASE}/api/prefs")
        assert r.status_code == 401

    def test_get_prefs_authed_shape(self, auth_client):
        r = auth_client.get(f"{BASE}/api/prefs")
        assert r.status_code == 200, r.text
        data = r.json()
        # Required keys
        for k in ("display_name", "currency", "notifications"):
            assert k in data, f"missing key: {k}"
        assert isinstance(data["notifications"], dict)
        # All 5 notification keys present with boolean values
        assert set(data["notifications"].keys()) == NOTIF_KEYS, (
            f"notification keys mismatch: got {set(data['notifications'].keys())}"
        )
        for k, v in data["notifications"].items():
            assert isinstance(v, bool), f"{k} is not bool: {v!r}"

    def test_put_prefs_updates_name_and_currency(self, auth_client):
        # capture notifications state to verify preservation
        before = auth_client.get(f"{BASE}/api/prefs").json()
        r = auth_client.put(
            f"{BASE}/api/prefs",
            json={"display_name": "Vishwa", "currency": "INR"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["display_name"] == "Vishwa"
        assert data["currency"] == "INR"
        # notifications shape preserved (still all 5 keys, bool)
        assert set(data["notifications"].keys()) == NOTIF_KEYS
        # notifications unchanged from before
        assert data["notifications"] == before["notifications"], (
            f"notifications changed unexpectedly: before={before['notifications']} after={data['notifications']}"
        )

        # Verify persistence with GET
        g = auth_client.get(f"{BASE}/api/prefs").json()
        assert g["display_name"] == "Vishwa"
        assert g["currency"] == "INR"

    def test_put_prefs_notifications_partial_merge(self, auth_client):
        # ensure prior state from previous test
        r = auth_client.put(
            f"{BASE}/api/prefs",
            json={"notifications": {"daily_summary": True, "watchlist": False}},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # display_name & currency untouched
        assert data["display_name"] == "Vishwa"
        assert data["currency"] == "INR"
        # requested toggles applied
        assert data["notifications"]["daily_summary"] is True
        assert data["notifications"]["watchlist"] is False
        # other three remain at defaults (True)
        for k in ("a_plus_ready", "daily_goal_achieved", "daily_loss_reached"):
            assert data["notifications"][k] is True, f"{k} unexpectedly changed to {data['notifications'][k]}"

    def test_put_prefs_empty_body_no_change(self, auth_client):
        before = auth_client.get(f"{BASE}/api/prefs").json()
        r = auth_client.put(f"{BASE}/api/prefs", json={})
        assert r.status_code == 200, r.text
        after = r.json()
        assert after == before, f"empty PUT changed state: before={before} after={after}"

    def test_put_prefs_trims_name_and_uppercases_currency(self, auth_client):
        r = auth_client.put(
            f"{BASE}/api/prefs",
            json={"display_name": "  Vishwa   ", "currency": "inr"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["display_name"] == "Vishwa", f"expected trimmed 'Vishwa', got {data['display_name']!r}"
        assert data["currency"] == "INR", f"expected uppercased 'INR', got {data['currency']!r}"
