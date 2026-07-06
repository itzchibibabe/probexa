import os
import pytest
import requests

BASE_URL = "https://futures-analyzer-4.preview.emergentagent.com"
TOKEN = "test-token-abc-123"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def auth_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"})
    return s
