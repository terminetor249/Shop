"""Backend tests for iteration-3 review: system message broadcast, coin transfer, players privacy, admin delete."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ranked-item-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dokkaebi.shop"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _reg(name="P"):
    email = f"TEST_{uuid.uuid4().hex[:8]}@dokkaebi.shop"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": f"TEST_{name}"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["token"], "user": d["user"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def sender():
    return _reg("Sender")


@pytest.fixture(scope="module")
def recipient():
    return _reg("Recip")


def _clear(h):
    requests.post(f"{API}/notifications/mark-seen", json={}, headers=h, timeout=20)


# ---------- SYSTEM MESSAGE broadcast ----------
class TestSystemBroadcast:
    def test_system_message_broadcast_delivers(self, admin_h, recipient):
        _clear(recipient["h"])
        pre = requests.get(f"{API}/auth/me", headers=recipient["h"], timeout=20).json()["coins"]
        r = requests.post(f"{API}/constellation/send", headers=admin_h, json={
            "constellation_name": "",
            "many_constellations": False,
            "system_message": True,
            "reason": "The player has slain a Level-3 Wraith",
            "amount": 100,
            "player_ids": [recipient["user"]["id"]],
        }, timeout=20)
        assert r.status_code == 200, r.text
        post = requests.get(f"{API}/auth/me", headers=recipient["h"], timeout=20).json()["coins"]
        assert post - pre == 100
        time.sleep(0.3)
        notifs = requests.get(f"{API}/notifications", headers=recipient["h"], timeout=20).json()
        sys_notifs = [n for n in notifs if n.get("kind") == "constellation" and n.get("system_message") is True]
        assert sys_notifs, f"expected system_message notification: {notifs}"
        n = sys_notifs[0]
        assert n["reason"] == "The player has slain a Level-3 Wraith"
        assert n["amount"] == 100
        assert not n.get("constellation_name")
        assert not n.get("many_constellations")

    def test_no_mode_rejected(self, admin_h):
        r = requests.post(f"{API}/constellation/send", headers=admin_h, json={
            "constellation_name": "", "many_constellations": False, "system_message": False,
            "reason": "x", "amount": 0, "player_ids": [],
        }, timeout=20)
        assert r.status_code == 400, r.text

    def test_two_modes_rejected(self, admin_h):
        r = requests.post(f"{API}/constellation/send", headers=admin_h, json={
            "constellation_name": "Uriel", "many_constellations": False, "system_message": True,
            "reason": "x", "amount": 0, "player_ids": [],
        }, timeout=20)
        assert r.status_code == 400, r.text

    def test_two_modes_many_and_system(self, admin_h):
        r = requests.post(f"{API}/constellation/send", headers=admin_h, json={
            "constellation_name": "", "many_constellations": True, "system_message": True,
            "reason": "x", "amount": 0, "player_ids": [],
        }, timeout=20)
        assert r.status_code == 400


# ---------- COIN TRANSFER ----------
class TestCoinTransfer:
    def test_transfer_success(self, admin_h, sender, recipient):
        # Grant sender coins
        requests.post(f"{API}/grant-coins", headers=admin_h,
                      json={"player_id": sender["user"]["id"], "amount": 500, "reason": "seed"}, timeout=20)
        _clear(recipient["h"])
        s_pre = requests.get(f"{API}/auth/me", headers=sender["h"], timeout=20).json()["coins"]
        r_pre = requests.get(f"{API}/auth/me", headers=recipient["h"], timeout=20).json()["coins"]
        r = requests.post(f"{API}/coins/transfer", headers=sender["h"], json={
            "recipient_id": recipient["user"]["id"], "amount": 50, "reason": "for the guild",
        }, timeout=20)
        assert r.status_code == 200, r.text
        s_post = requests.get(f"{API}/auth/me", headers=sender["h"], timeout=20).json()["coins"]
        r_post = requests.get(f"{API}/auth/me", headers=recipient["h"], timeout=20).json()["coins"]
        assert s_pre - s_post == 50
        assert r_post - r_pre == 50
        time.sleep(0.3)
        notifs = requests.get(f"{API}/notifications", headers=recipient["h"], timeout=20).json()
        xfer = [n for n in notifs if n.get("kind") == "coin_transfer"]
        assert xfer, f"expected coin_transfer notif: {notifs}"
        assert xfer[0]["sender_name"] == sender["user"]["name"]
        assert xfer[0]["amount"] == 50

    def test_transfer_to_self_rejected(self, sender):
        r = requests.post(f"{API}/coins/transfer", headers=sender["h"], json={
            "recipient_id": sender["user"]["id"], "amount": 5, "reason": "self",
        }, timeout=20)
        assert r.status_code == 400
        assert "yourself" in r.json().get("detail", "").lower()

    def test_transfer_over_balance_rejected(self, sender, recipient):
        r = requests.post(f"{API}/coins/transfer", headers=sender["h"], json={
            "recipient_id": recipient["user"]["id"], "amount": 999_999_999, "reason": "big",
        }, timeout=20)
        assert r.status_code == 400

    def test_transfer_negative_rejected(self, sender, recipient):
        r = requests.post(f"{API}/coins/transfer", headers=sender["h"], json={
            "recipient_id": recipient["user"]["id"], "amount": -5, "reason": "neg",
        }, timeout=20)
        assert r.status_code == 422


# ---------- PLAYERS PRIVACY ----------
class TestPlayersPrivacy:
    def test_player_view_strips_others(self, sender, recipient):
        r = requests.get(f"{API}/players", headers=sender["h"], timeout=20)
        assert r.status_code == 200
        others = [p for p in r.json() if p["id"] != sender["user"]["id"]]
        assert others, "should see at least one other player"
        for p in others:
            assert set(p.keys()) <= {"id", "name", "email"}, f"other player leaked fields: {p.keys()}"
            for banned in ("coins", "stats", "stat_caps", "vitals", "unallocated_points",
                            "hp_current", "mp_current", "stamina_current"):
                assert banned not in p, f"leaked {banned} in {p}"
        # own record should have full info
        me_rec = next(p for p in r.json() if p["id"] == sender["user"]["id"])
        assert "coins" in me_rec

    def test_admin_view_has_coins(self, admin_h):
        r = requests.get(f"{API}/players", headers=admin_h, timeout=20)
        assert r.status_code == 200
        assert any("coins" in p for p in r.json())


# ---------- ADMIN DELETE PLAYER ----------
class TestAdminDelete:
    def test_delete_cascade(self, admin_h):
        # create a throwaway player to delete
        victim = _reg("Victim")
        pid = victim["user"]["id"]
        # give them coins + a notification + an inventory item
        requests.post(f"{API}/grant-coins", headers=admin_h,
                      json={"player_id": pid, "amount": 100, "reason": "seed"}, timeout=20)
        # scenario that mentions them
        s = requests.post(f"{API}/scenarios", headers=admin_h, json={
            "title": f"TEST_del_{uuid.uuid4().hex[:6]}",
            "scenario_type": "sub",
            "visible_to": [pid],
            "clear_conditions": ["x"],
        }, timeout=20).json()
        # delete
        r = requests.delete(f"{API}/players/{pid}", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        # gone from listing
        listing = requests.get(f"{API}/players", headers=admin_h, timeout=20).json()
        assert not any(p["id"] == pid for p in listing)
        # detail 404
        r2 = requests.get(f"{API}/players/{pid}", headers=admin_h, timeout=20)
        assert r2.status_code == 404
        # scenario visible_to no longer contains them
        scen = requests.get(f"{API}/scenarios", headers=admin_h, timeout=20).json()
        target = next((x for x in scen if x["id"] == s["id"]), None)
        if target is not None:
            assert pid not in target.get("visible_to", [])

    def test_delete_forbidden_for_players(self, sender, recipient):
        r = requests.delete(f"{API}/players/{recipient['user']['id']}", headers=sender["h"], timeout=20)
        assert r.status_code in (401, 403)

    def test_delete_nonexistent(self, admin_h):
        r = requests.delete(f"{API}/players/{uuid.uuid4()}", headers=admin_h, timeout=20)
        assert r.status_code == 404
