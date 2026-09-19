"""Backend regression tests for Dokkaebi Shop — targets the iteration-2 review request."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ranked-item-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dokkaebi.shop"
ADMIN_PASSWORD = "admin123"


# ---------- Helpers / fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def player_a():
    """Register a fresh player with a unique email so we can predict vitals/coins state."""
    email = f"TEST_p_{uuid.uuid4().hex[:8]}@dokkaebi.shop"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "TestPlayerA"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"], "h": {"Authorization": f"Bearer {data['token']}"}}


@pytest.fixture(scope="session")
def player_b():
    email = f"TEST_p_{uuid.uuid4().hex[:8]}@dokkaebi.shop"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "TestPlayerB"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"], "h": {"Authorization": f"Bearer {data['token']}"}}


def _clear_notifs(headers):
    requests.post(f"{API}/notifications/mark-seen", json={}, headers=headers, timeout=20)


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_me_admin(self, admin_h):
        r = requests.get(f"{API}/auth/me", headers=admin_h, timeout=20)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_invalid_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "bad"}, timeout=20)
        assert r.status_code == 401


# ---------- Meta / Categories (Star Relics removed) ----------
class TestMeta:
    def test_categories_no_star_relics(self, admin_h):
        r = requests.get(f"{API}/meta", headers=admin_h, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["categories"] == ["Items", "Skills", "Story"], d["categories"]
        assert "Star Relic" in d["ranks"], "Star Relic rank should remain"
        assert "Star Relics" not in d["categories"]

    def test_create_item_star_relics_category_rejected(self, admin_h):
        r = requests.post(f"{API}/items", headers=admin_h, json={
            "name": "TEST_bad_cat", "description": "", "category": "Star Relics",
            "rank": "S", "price": 10, "stock": -1,
        }, timeout=20)
        assert r.status_code == 422, f"expected pydantic 422, got {r.status_code}: {r.text}"

    def test_create_item_valid_category(self, admin_h):
        r = requests.post(f"{API}/items", headers=admin_h, json={
            "name": f"TEST_item_{uuid.uuid4().hex[:6]}", "description": "x", "category": "Items",
            "rank": "S", "price": 50, "stock": -1,
        }, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["category"] == "Items"


# ---------- Scenarios: new fields, hidden type, arrival notifications ----------
class TestScenariosArrival:
    def test_create_hidden_scenario_broadcast(self, admin_h, player_a, player_b):
        _clear_notifs(player_a["h"])
        _clear_notifs(player_b["h"])

        payload = {
            "title": "TEST Whispers Beneath",
            "description": "flavor",
            "scenario_type": "hidden",
            "visible_to": [],
            "reward": "A Star Piece",
            "reward_coins": 30,
            "difficulty": "??",
            "clear_conditions": ["Find the crypt", "Silence the choir"],
            "time_limit": "1 day",
            "failure": "Death.",
            "notes": "Uriel watches.",
        }
        r = requests.post(f"{API}/scenarios", headers=admin_h, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["scenario_type"] == "hidden"
        assert s["clear_conditions"] == payload["clear_conditions"]
        assert s["difficulty"] == "??"
        assert s["time_limit"] == "1 day"

        # Player A should see it in listing
        r2 = requests.get(f"{API}/scenarios", headers=player_a["h"], timeout=20)
        assert r2.status_code == 200
        titles = [x["title"] for x in r2.json()]
        assert "TEST Whispers Beneath" in titles

        # Player A should receive a scenario_arrival notification with scenario_type=hidden
        time.sleep(0.5)
        r3 = requests.get(f"{API}/notifications", headers=player_a["h"], timeout=20)
        assert r3.status_code == 200
        notifs = r3.json()
        arr = [n for n in notifs if n.get("kind") == "scenario_arrival" and n.get("scenario_title") == "TEST Whispers Beneath"]
        assert arr, f"expected scenario_arrival notification, got {notifs}"
        assert arr[0]["scenario_type"] == "hidden"

    def test_create_main_scenario_with_number(self, admin_h, player_a):
        _clear_notifs(player_a["h"])
        payload = {
            "title": "TEST Main 3",
            "scenario_type": "main",
            "visible_to": [player_a["user"]["id"]],
            "scenario_number": 3,
            "clear_conditions": ["Reach the top"],
            "reward_coins": 100,
        }
        r = requests.post(f"{API}/scenarios", headers=admin_h, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["scenario_number"] == 3

        r2 = requests.get(f"{API}/notifications", headers=player_a["h"], timeout=20)
        arr = [n for n in r2.json() if n.get("kind") == "scenario_arrival" and n.get("scenario_title") == "TEST Main 3"]
        assert arr, "player_a should get arrival notif for targeted main scenario"
        assert arr[0]["scenario_type"] == "main"
        assert arr[0]["scenario_number"] == 3

    def test_sub_personal_targeted(self, admin_h, player_a, player_b):
        payload = {
            "title": "TEST Sub Personal",
            "scenario_type": "sub",
            "visible_to": [player_a["user"]["id"]],
            "clear_conditions": ["Solo it"],
        }
        r = requests.post(f"{API}/scenarios", headers=admin_h, json=payload, timeout=20)
        assert r.status_code == 200

        # player_b should NOT see it in listing
        rb = requests.get(f"{API}/scenarios", headers=player_b["h"], timeout=20)
        titles_b = [x["title"] for x in rb.json()]
        assert "TEST Sub Personal" not in titles_b

    def test_mark_seen_clears_queue(self, admin_h, player_a):
        r = requests.post(f"{API}/notifications/mark-seen", json={}, headers=player_a["h"], timeout=20)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/notifications", headers=player_a["h"], timeout=20)
        assert r2.json() == []


# ---------- Vitals: manual delta apply (used by mobile sign toggle) ----------
class TestVitals:
    def test_set_vitals_delta_negative(self, player_a):
        # Reset to max then subtract
        r0 = requests.get(f"{API}/stats", headers=player_a["h"], timeout=20)
        assert r0.status_code == 200
        d = r0.json()
        hp_max = d["vitals"]["hp"]["max"]

        # Set to max first
        requests.post(f"{API}/stats/vitals", json={"hp": hp_max}, headers=player_a["h"], timeout=20)
        # Subtract 5
        r = requests.post(f"{API}/stats/vitals", json={"hp": hp_max - 5}, headers=player_a["h"], timeout=20)
        assert r.status_code == 200
        assert r.json()["vitals"]["hp"]["current"] == hp_max - 5

    def test_vitals_clamped(self, player_a):
        r = requests.post(f"{API}/stats/vitals", json={"hp": -100}, headers=player_a["h"], timeout=20)
        assert r.status_code == 200
        assert r.json()["vitals"]["hp"]["current"] == 0


# ---------- Regression: stat upgrade scales HP & Stamina current+max ----------
class TestStatUpgradeRegression:
    def test_vigor_upgrade_scales_current_and_max(self, admin_h, player_a):
        # Grant coins first
        pid = player_a["user"]["id"]
        r = requests.post(f"{API}/grant-coins", headers=admin_h, json={"player_id": pid, "amount": 10000, "reason": "TEST"}, timeout=20)
        assert r.status_code == 200

        # Read pre state
        r0 = requests.get(f"{API}/stats", headers=player_a["h"], timeout=20)
        pre = r0.json()
        hp_cur_pre = pre["vitals"]["hp"]["current"]
        hp_max_pre = pre["vitals"]["hp"]["max"]
        st_cur_pre = pre["vitals"]["stamina"]["current"]
        st_max_pre = pre["vitals"]["stamina"]["max"]

        # Upgrade vigor
        r1 = requests.post(f"{API}/stats/upgrade", json={"stat": "vigor"}, headers=player_a["h"], timeout=20)
        assert r1.status_code == 200, r1.text
        post = r1.json()

        assert post["vitals"]["hp"]["max"] == hp_max_pre + 1, f"HP max should +1: {post['vitals']['hp']}"
        assert post["vitals"]["hp"]["current"] == min(post["vitals"]["hp"]["max"], hp_cur_pre + 1)
        # stamina = 4*vigor + 6*agility → vigor +1 => stamina +4
        assert post["vitals"]["stamina"]["max"] == st_max_pre + 4
        assert post["vitals"]["stamina"]["current"] == min(post["vitals"]["stamina"]["max"], st_cur_pre + 4)


# ---------- Regression: consumable inventory item uses decrement ----------
class TestConsumableUse:
    def test_purchase_and_use_consumable(self, admin_h, player_a):
        # Create consumable item
        it = requests.post(f"{API}/items", headers=admin_h, json={
            "name": f"TEST_potion_{uuid.uuid4().hex[:6]}", "category": "Items", "rank": "F",
            "price": 5, "stock": -1, "uses": 2,
        }, timeout=20).json()
        # Grant coins
        pid = player_a["user"]["id"]
        requests.post(f"{API}/grant-coins", headers=admin_h, json={"player_id": pid, "amount": 100, "reason": "test"}, timeout=20)
        # Purchase
        p = requests.post(f"{API}/purchase", headers=player_a["h"], json={"item_id": it["id"]}, timeout=20)
        assert p.status_code == 200
        inv = requests.get(f"{API}/inventory", headers=player_a["h"], timeout=20).json()
        row = next(x for x in inv if x["item_id"] == it["id"])
        assert row["uses_remaining"] == 2
        # Use once
        u = requests.post(f"{API}/inventory/{row['id']}/use", headers=player_a["h"], timeout=20)
        assert u.status_code == 200
        assert u.json()["uses_remaining"] == 1


# ---------- Regression: constellation broadcast ----------
class TestConstellation:
    def test_constellation_named_with_coins(self, admin_h, player_b):
        _clear_notifs(player_b["h"])
        r = requests.post(f"{API}/constellation/send", headers=admin_h, json={
            "constellation_name": "Uriel",
            "many_constellations": False,
            "reason": "smiles upon you",
            "amount": 25,
            "player_ids": [player_b["user"]["id"]],
        }, timeout=20)
        assert r.status_code == 200, r.text
        n = requests.get(f"{API}/notifications", headers=player_b["h"], timeout=20).json()
        arr = [x for x in n if x["kind"] == "constellation"]
        assert arr and arr[0]["constellation_name"] == "Uriel" and arr[0]["amount"] == 25


# ---------- Regression: scenario complete grants coins & notification ----------
class TestScenarioComplete:
    def test_complete_grants_reward(self, admin_h, player_b):
        # Create scenario visible only to player_b with reward_coins
        s = requests.post(f"{API}/scenarios", headers=admin_h, json={
            "title": "TEST Complete Me",
            "scenario_type": "bounty",
            "visible_to": [player_b["user"]["id"]],
            "reward_coins": 77,
            "reward": "trinket",
        }, timeout=20).json()
        _clear_notifs(player_b["h"])
        coins_before = requests.get(f"{API}/auth/me", headers=player_b["h"], timeout=20).json()["coins"]
        r = requests.post(f"{API}/scenarios/{s['id']}/complete", headers=admin_h, timeout=20)
        assert r.status_code == 200
        coins_after = requests.get(f"{API}/auth/me", headers=player_b["h"], timeout=20).json()["coins"]
        assert coins_after - coins_before == 77
        n = requests.get(f"{API}/notifications", headers=player_b["h"], timeout=20).json()
        assert any(x["kind"] == "scenario_cleared" and x["scenario_title"] == "TEST Complete Me" for x in n)
