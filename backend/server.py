"""Dokkaebi Shop backend — Omniscient Reader's Viewpoint themed shop for DnD campaigns."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt as pyjwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Header, Query
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Dokkaebi Shop API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
APP_NAME = "dokkaebi-shop"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Object Storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
storage_key = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Auth helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 3600, path="/"
    )


# ---------- Models ----------
RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "Star Relic"]
CATEGORIES = ["Items", "Skills", "Story"]
STAT_KEYS = ("vigor", "strength", "agility", "status", "acuity")
DEFAULT_STATS = {k: 10 for k in STAT_KEYS}
STARTING_FREE_POINTS = 25


def compute_upgrade_cost(current_level: int, total: int) -> int:
    return 100 + current_level * 20 + total * 10


async def _apply_stats_change(user_id: str, fresh: dict, new_stats: dict,
                              coin_delta: int = 0, unallocated_delta: int = 0):
    """Update stats and scale current vitals by the max delta so ratios stay in tune."""
    old_stats = fresh.get("stats") or dict(DEFAULT_STATS)
    old_max = vitals_max(old_stats)
    new_max = vitals_max(new_stats)
    hp_cur = int(fresh.get("hp_current", old_max["hp"]))
    mp_cur = int(fresh.get("mp_current", old_max["mp"]))
    st_cur = int(fresh.get("stamina_current", old_max["stamina"]))
    hp_cur = max(0, min(new_max["hp"], hp_cur + (new_max["hp"] - old_max["hp"])))
    mp_cur = max(0, min(new_max["mp"], mp_cur + (new_max["mp"] - old_max["mp"])))
    st_cur = max(0, min(new_max["stamina"], st_cur + (new_max["stamina"] - old_max["stamina"])))
    ops = {"$set": {
        "stats": new_stats,
        "hp_current": hp_cur,
        "mp_current": mp_cur,
        "stamina_current": st_cur,
    }}
    inc = {}
    if coin_delta:
        inc["coins"] = coin_delta
    if unallocated_delta:
        inc["unallocated_points"] = unallocated_delta
    if inc:
        ops["$inc"] = inc
    await db.users.update_one({"id": user_id}, ops)


def compute_hp_max(stats: dict) -> int:
    return 10 + int(stats.get("vigor", 0))


def compute_mp_max(stats: dict) -> int:
    return 400 + (int(stats.get("status", 0)) - 1) * 50


def compute_stamina_max(stats: dict) -> int:
    return 4 * int(stats.get("vigor", 0)) + 6 * int(stats.get("agility", 0))


def vitals_max(stats: dict) -> dict:
    return {
        "hp": compute_hp_max(stats),
        "mp": compute_mp_max(stats),
        "stamina": compute_stamina_max(stats),
    }


class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class ItemCreate(BaseModel):
    name: str
    description: str = ""
    category: Literal["Items", "Skills", "Story"]
    rank: str
    price: int = Field(ge=0)
    stock: int = Field(default=-1)  # -1 = unlimited
    uses: Optional[int] = Field(default=None, ge=1)  # None = not consumable
    image_path: Optional[str] = None

class GrantCoins(BaseModel):
    player_id: str
    amount: int
    reason: str

class ConstellationBroadcast(BaseModel):
    constellation_name: str = ""
    many_constellations: bool = False
    system_message: bool = False
    reason: str
    amount: int = 0
    player_ids: List[str] = []  # empty = all players

class ScenarioCreate(BaseModel):
    title: str
    description: str = ""
    scenario_type: Literal["main", "sub", "hidden", "bounty"]
    visible_to: List[str] = []  # empty list = all players
    reward: str = ""
    reward_coins: int = Field(default=0, ge=0)
    scenario_number: Optional[int] = None  # for main scenarios: 1, 2, 3...
    difficulty: str = ""
    clear_conditions: List[str] = []
    time_limit: str = ""
    failure: str = ""
    notes: str = ""

class PurchaseInput(BaseModel):
    item_id: str

StatName = Literal["vigor", "strength", "agility", "status", "acuity"]

class UpgradeInput(BaseModel):
    stat: StatName

class AllocateInput(BaseModel):
    stat: StatName

class AdjustInput(BaseModel):
    stat: StatName
    delta: int

class CapInput(BaseModel):
    stat: StatName
    max: Optional[int] = None  # None removes cap
    note: str = ""

class VitalsInput(BaseModel):
    hp: Optional[int] = None
    mp: Optional[int] = None
    stamina: Optional[int] = None


# ---------- Auth Routes ----------
@api_router.post("/auth/register")
async def register(body: RegisterInput, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "role": "player",
        "coins": 0,
        "stats": dict(DEFAULT_STATS),
        "stat_caps": {},
        "unallocated_points": STARTING_FREE_POINTS,
        "hp_current": compute_hp_max(DEFAULT_STATS),
        "mp_current": compute_mp_max(DEFAULT_STATS),
        "stamina_current": compute_stamina_max(DEFAULT_STATS),
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], email, "player")
    set_auth_cookie(response, token)
    user.pop("password_hash")
    user.pop("_id", None)
    return {"user": user, "token": token}

@api_router.post("/auth/login")
async def login(body: LoginInput, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Users / Players ----------
@api_router.get("/players")
async def list_players(user: dict = Depends(get_current_user)):
    docs = await db.users.find({"role": "player"}, {"password_hash": 0, "_id": 0}).to_list(1000)
    # Players cannot see other players' coins / stats — only their own record is fully detailed.
    if user.get("role") == "player":
        pruned = []
        for d in docs:
            if d.get("id") == user.get("id"):
                pruned.append(d)
            else:
                pruned.append({"id": d["id"], "name": d.get("name", ""), "email": d.get("email", "")})
        return pruned
    return docs


# ---------- Stats ----------
def _serialize_stats(fresh: dict) -> dict:
    stats = fresh.get("stats") or dict(DEFAULT_STATS)
    caps = fresh.get("stat_caps") or {}
    total = sum(stats.values())
    costs = {k: compute_upgrade_cost(stats[k], total) for k in STAT_KEYS}
    maxes = vitals_max(stats)
    return {
        "stats": stats,
        "stat_caps": caps,
        "total": total,
        "upgrade_costs": costs,
        "unallocated_points": int(fresh.get("unallocated_points", 0)),
        "coins": int(fresh.get("coins", 0)),
        "vitals": {
            "hp": {"current": int(fresh.get("hp_current", maxes["hp"])), "max": maxes["hp"]},
            "mp": {"current": int(fresh.get("mp_current", maxes["mp"])), "max": maxes["mp"]},
            "stamina": {"current": int(fresh.get("stamina_current", maxes["stamina"])), "max": maxes["stamina"]},
        },
    }


@api_router.get("/stats")
async def my_stats(user: dict = Depends(get_current_user)):
    if user["role"] != "player":
        raise HTTPException(status_code=403, detail="Players only")
    fresh = await db.users.find_one({"id": user["id"]}, {"password_hash": 0, "_id": 0})
    return _serialize_stats(fresh)


@api_router.post("/stats/allocate")
async def allocate_point(body: AllocateInput, user: dict = Depends(get_current_user)):
    if user["role"] != "player":
        raise HTTPException(status_code=403, detail="Players only")
    fresh = await db.users.find_one({"id": user["id"]})
    unallocated = int(fresh.get("unallocated_points", 0))
    if unallocated <= 0:
        raise HTTPException(status_code=400, detail="No free points remaining")
    stats = dict(fresh.get("stats") or DEFAULT_STATS)
    caps = fresh.get("stat_caps") or {}
    cap_entry = caps.get(body.stat)
    if cap_entry and cap_entry.get("max") is not None and stats.get(body.stat, 0) >= cap_entry["max"]:
        detail = f"{body.stat.title()} is capped at Lv {cap_entry['max']}"
        if cap_entry.get("note"):
            detail += f" ({cap_entry['note']})"
        raise HTTPException(status_code=400, detail=detail)
    stats[body.stat] = stats.get(body.stat, 0) + 1
    await _apply_stats_change(user["id"], fresh, stats, unallocated_delta=-1)
    updated = await db.users.find_one({"id": user["id"]}, {"password_hash": 0, "_id": 0})
    return _serialize_stats(updated)


@api_router.post("/stats/upgrade")
async def upgrade_stat(body: UpgradeInput, user: dict = Depends(get_current_user)):
    if user["role"] != "player":
        raise HTTPException(status_code=403, detail="Players only")
    fresh = await db.users.find_one({"id": user["id"]})
    stats = dict(fresh.get("stats") or DEFAULT_STATS)
    caps = fresh.get("stat_caps") or {}
    current = stats.get(body.stat, 0)
    total = sum(stats.values())
    cost = compute_upgrade_cost(current, total)
    cap_entry = caps.get(body.stat)
    if cap_entry and cap_entry.get("max") is not None and current >= cap_entry["max"]:
        note = cap_entry.get("note", "")
        detail = f"{body.stat.title()} is capped at Lv {cap_entry['max']}"
        if note:
            detail += f" ({note})"
        raise HTTPException(status_code=400, detail=detail)
    if fresh.get("coins", 0) < cost:
        raise HTTPException(status_code=400, detail=f"Not enough coins (need {cost})")
    new_level = current + 1
    stats[body.stat] = new_level
    await _apply_stats_change(user["id"], fresh, stats, coin_delta=-cost)
    tx = {
        "id": str(uuid.uuid4()),
        "player_id": user["id"],
        "player_name": user["name"],
        "amount": -cost,
        "reason": f"Upgraded {body.stat.title()} to Lv {new_level}",
        "type": "stat_upgrade",
        "stat": body.stat,
        "new_level": new_level,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(tx)
    updated = await db.users.find_one({"id": user["id"]}, {"password_hash": 0, "_id": 0})
    return _serialize_stats(updated)


@api_router.post("/stats/vitals")
async def set_vitals(body: VitalsInput, user: dict = Depends(get_current_user)):
    if user["role"] != "player":
        raise HTTPException(status_code=403, detail="Players only")
    fresh = await db.users.find_one({"id": user["id"]})
    stats = fresh.get("stats") or dict(DEFAULT_STATS)
    maxes = vitals_max(stats)
    updates = {}
    if body.hp is not None:
        updates["hp_current"] = max(0, min(int(body.hp), maxes["hp"]))
    if body.mp is not None:
        updates["mp_current"] = max(0, min(int(body.mp), maxes["mp"]))
    if body.stamina is not None:
        updates["stamina_current"] = max(0, min(int(body.stamina), maxes["stamina"]))
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"password_hash": 0, "_id": 0})
    return _serialize_stats(updated)


# ---------- Admin: player detail + stat management ----------
@api_router.get("/players/{player_id}")
async def admin_player_detail(player_id: str, user: dict = Depends(require_admin)):
    p = await db.users.find_one({"id": player_id, "role": "player"}, {"password_hash": 0, "_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")
    inv = await db.inventory.find({"player_id": player_id}, {"_id": 0}).sort("purchased_at", -1).to_list(500)
    serial = _serialize_stats(p)
    return {
        "player": p,
        **serial,
        "inventory": inv,
    }


@api_router.delete("/players/{player_id}")
async def admin_delete_player(player_id: str, user: dict = Depends(require_admin)):
    p = await db.users.find_one({"id": player_id, "role": "player"})
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")
    await db.users.delete_one({"id": player_id})
    await db.inventory.delete_many({"player_id": player_id})
    await db.notifications.delete_many({"player_id": player_id})
    await db.transactions.delete_many({"player_id": player_id})
    # Remove them from scenario visible_to lists
    await db.scenarios.update_many(
        {"visible_to": player_id},
        {"$pull": {"visible_to": player_id}},
    )
    return {"ok": True, "removed": p["name"]}


@api_router.post("/players/{player_id}/stats/adjust")
async def admin_adjust_stat(player_id: str, body: AdjustInput, user: dict = Depends(require_admin)):
    p = await db.users.find_one({"id": player_id, "role": "player"})
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")
    stats = p.get("stats") or dict(DEFAULT_STATS)
    new_level = max(0, stats.get(body.stat, 0) + body.delta)
    new_stats = dict(stats)
    new_stats[body.stat] = new_level
    await _apply_stats_change(player_id, p, new_stats)
    return {"stats": new_stats}


@api_router.post("/players/{player_id}/stats/cap")
async def admin_set_cap(player_id: str, body: CapInput, user: dict = Depends(require_admin)):
    p = await db.users.find_one({"id": player_id, "role": "player"})
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")
    caps = p.get("stat_caps") or {}
    if body.max is None:
        caps.pop(body.stat, None)
    else:
        caps[body.stat] = {"max": body.max, "note": body.note}
    await db.users.update_one({"id": player_id}, {"$set": {"stat_caps": caps}})
    return {"stat_caps": caps}


# ---------- Upload ----------
@api_router.post("/upload")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only images allowed")
    ext = (file.filename or "img.png").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "png"
    path = f"{APP_NAME}/items/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type)
    file_doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(file_doc)
    return {"path": result["path"]}

@api_router.get("/files/{path:path}")
async def download(path: str, authorization: Optional[str] = Header(None), auth: Optional[str] = Query(None)):
    # Auth via header or query param
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(path)
    return FastResponse(content=data, media_type=record.get("content_type", content_type))


# ---------- Shop Items ----------
@api_router.get("/items")
async def list_items(user: dict = Depends(get_current_user)):
    docs = await db.items.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api_router.post("/items")
async def create_item(body: ItemCreate, user: dict = Depends(require_admin)):
    if body.rank not in RANKS:
        raise HTTPException(status_code=400, detail=f"Invalid rank. Allowed: {RANKS}")
    item = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.items.insert_one(item)
    item.pop("_id", None)
    return item

@api_router.put("/items/{item_id}")
async def update_item(item_id: str, body: ItemCreate, user: dict = Depends(require_admin)):
    if body.rank not in RANKS:
        raise HTTPException(status_code=400, detail=f"Invalid rank")
    result = await db.items.update_one({"id": item_id}, {"$set": body.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    doc = await db.items.find_one({"id": item_id}, {"_id": 0})
    return doc

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, user: dict = Depends(require_admin)):
    await db.items.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Coins & Transactions ----------
async def _create_notification(
    player_id: str,
    kind: str,
    reason: str = "",
    amount: int = 0,
    constellation_name: str = "",
    many_constellations: bool = False,
    system_message: bool = False,
    sender_name: str = "",
    scenario_title: str = "",
    scenario_type: str = "",
    scenario_number: Optional[int] = None,
):
    doc = {
        "id": str(uuid.uuid4()),
        "player_id": player_id,
        "kind": kind,  # "constellation" | "scenario_cleared" | "scenario_arrival" | "coin_transfer"
        "reason": reason,
        "amount": amount,
        "constellation_name": constellation_name,
        "many_constellations": many_constellations,
        "system_message": system_message,
        "sender_name": sender_name,
        "scenario_title": scenario_title,
        "scenario_type": scenario_type,
        "scenario_number": scenario_number,
        "seen": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)


class CoinTransferInput(BaseModel):
    recipient_id: str
    amount: int = Field(gt=0)
    reason: str = ""


@api_router.post("/coins/transfer")
async def transfer_coins(body: CoinTransferInput, user: dict = Depends(get_current_user)):
    if user["role"] != "player":
        raise HTTPException(status_code=403, detail="Only players can send coins")
    if body.recipient_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot send coins to yourself")
    recipient = await db.users.find_one({"id": body.recipient_id, "role": "player"})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    sender = await db.users.find_one({"id": user["id"]})
    if int(sender.get("coins", 0)) < body.amount:
        raise HTTPException(status_code=400, detail="Not enough coins")
    reason = body.reason.strip() or "No reason given"
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$inc": {"coins": -body.amount}})
    await db.users.update_one({"id": body.recipient_id}, {"$inc": {"coins": body.amount}})
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "player_id": user["id"],
        "player_name": user["name"],
        "amount": -body.amount,
        "reason": f"Sent to {recipient['name']}: {reason}",
        "type": "transfer_out",
        "counterparty_id": body.recipient_id,
        "counterparty_name": recipient["name"],
        "created_at": now,
    })
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "player_id": body.recipient_id,
        "player_name": recipient["name"],
        "amount": body.amount,
        "reason": f"Received from {user['name']}: {reason}",
        "type": "transfer_in",
        "counterparty_id": user["id"],
        "counterparty_name": user["name"],
        "created_at": now,
    })
    await _create_notification(
        body.recipient_id, "coin_transfer",
        reason=reason,
        amount=body.amount,
        sender_name=user["name"],
    )
    return {"ok": True, "sent": body.amount, "recipient": recipient["name"]}


@api_router.post("/constellation/send")
async def constellation_send(body: ConstellationBroadcast, user: dict = Depends(require_admin)):
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason/message is required")
    # Determine broadcast mode (mutually exclusive)
    modes = [bool(body.system_message), bool(body.many_constellations), bool(body.constellation_name.strip())]
    if sum(modes) == 0:
        raise HTTPException(status_code=400, detail="Choose a mode: system message, many constellations, or a specific constellation name")
    if sum(modes) > 1:
        raise HTTPException(status_code=400, detail="Only one mode at a time: system, many, or a specific constellation")

    # Resolve target players
    if body.player_ids:
        players = await db.users.find(
            {"role": "player", "id": {"$in": body.player_ids}},
            {"password_hash": 0, "_id": 0},
        ).to_list(1000)
    else:
        players = await db.users.find({"role": "player"}, {"password_hash": 0, "_id": 0}).to_list(1000)

    if not players:
        raise HTTPException(status_code=404, detail="No matching players")

    if body.system_message:
        source_display = "System"
    elif body.many_constellations:
        source_display = "Many constellations"
    else:
        source_display = f"The constellation {body.constellation_name.strip()}"

    for p in players:
        if body.amount != 0:
            await db.users.update_one({"id": p["id"]}, {"$inc": {"coins": body.amount}})
            tx = {
                "id": str(uuid.uuid4()),
                "player_id": p["id"],
                "player_name": p["name"],
                "amount": body.amount,
                "reason": f"{source_display}: {reason}",
                "type": "system" if body.system_message else "constellation",
                "admin_id": user["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.transactions.insert_one(tx)
        await _create_notification(
            p["id"], "constellation",
            reason=reason,
            amount=body.amount,
            constellation_name=body.constellation_name.strip(),
            many_constellations=body.many_constellations,
            system_message=body.system_message,
        )
    return {"ok": True, "delivered_to": len(players)}


@api_router.post("/grant-coins")
async def grant_coins(body: GrantCoins, user: dict = Depends(require_admin)):
    # Legacy: quick single-player grant. Uses Uriel as default constellation.
    player = await db.users.find_one({"id": body.player_id, "role": "player"})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    await db.users.update_one({"id": body.player_id}, {"$inc": {"coins": body.amount}})
    tx = {
        "id": str(uuid.uuid4()),
        "player_id": body.player_id,
        "player_name": player["name"],
        "amount": body.amount,
        "reason": body.reason,
        "type": "grant",
        "admin_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(tx)
    await _create_notification(
        body.player_id, "constellation",
        reason=body.reason,
        amount=body.amount,
        constellation_name="Uriel",
    )
    tx.pop("_id", None)
    return tx

@api_router.get("/transactions")
async def list_transactions(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"player_id": user["id"]}
    docs = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


# ---------- Purchase ----------
@api_router.post("/purchase")
async def purchase(body: PurchaseInput, user: dict = Depends(get_current_user)):
    if user["role"] != "player":
        raise HTTPException(status_code=403, detail="Only players can purchase")
    item = await db.items.find_one({"id": body.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.get("stock", -1) == 0:
        raise HTTPException(status_code=400, detail="Sold out")
    player = await db.users.find_one({"id": user["id"]})
    if player["coins"] < item["price"]:
        raise HTTPException(status_code=400, detail="Not enough coins")
    # Deduct coins
    await db.users.update_one({"id": user["id"]}, {"$inc": {"coins": -item["price"]}})
    # Decrement stock if limited
    if item.get("stock", -1) > 0:
        await db.items.update_one({"id": item["id"]}, {"$inc": {"stock": -1}})
    # Log transaction
    tx = {
        "id": str(uuid.uuid4()),
        "player_id": user["id"],
        "player_name": user["name"],
        "amount": -item["price"],
        "reason": f"Purchased {item['name']} [{item['rank']}]",
        "type": "purchase",
        "item_id": item["id"],
        "item_name": item["name"],
        "item_rank": item["rank"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(tx)
    # Add to inventory
    snapshot = {k: v for k, v in item.items() if k != "_id"}
    inv = {
        "id": str(uuid.uuid4()),
        "player_id": user["id"],
        "item_id": item["id"],
        "item_snapshot": snapshot,
        "uses_remaining": item.get("uses"),  # None if not consumable
        "used_up": False,
        "purchased_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inventory.insert_one(inv)
    tx.pop("_id", None)
    return tx


@api_router.post("/inventory/{inv_id}/use")
async def use_item(inv_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != "player":
        raise HTTPException(status_code=403, detail="Only players can use items")
    inv = await db.inventory.find_one({"id": inv_id, "player_id": user["id"]})
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    uses = inv.get("uses_remaining")
    if uses is None:
        raise HTTPException(status_code=400, detail="This item is not consumable")
    if uses <= 0 or inv.get("used_up"):
        raise HTTPException(status_code=400, detail="Item already used up")
    new_uses = uses - 1
    if new_uses <= 0:
        await db.inventory.update_one(
            {"id": inv_id},
            {"$set": {"uses_remaining": 0, "used_up": True,
                      "used_at": datetime.now(timezone.utc).isoformat()}},
        )
    else:
        await db.inventory.update_one({"id": inv_id}, {"$set": {"uses_remaining": new_uses}})
    doc = await db.inventory.find_one({"id": inv_id}, {"_id": 0})
    return doc


@api_router.get("/inventory")
async def list_inventory(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"player_id": user["id"]}
    # Hide used-up consumables from player's active vault
    if user["role"] == "player":
        query["used_up"] = {"$ne": True}
    docs = await db.inventory.find(query, {"_id": 0}).sort("purchased_at", -1).to_list(1000)
    return docs


# ---------- Scenarios ----------
@api_router.get("/scenarios")
async def list_scenarios(user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        docs = await db.scenarios.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    else:
        docs = await db.scenarios.find(
            {"$or": [{"visible_to": []}, {"visible_to": user["id"]}]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)
    return docs

@api_router.post("/scenarios")
async def create_scenario(body: ScenarioCreate, user: dict = Depends(require_admin)):
    scenario = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.scenarios.insert_one(scenario)
    # Fan-out arrival notifications
    visible_to = scenario.get("visible_to") or []
    if visible_to:
        players = await db.users.find(
            {"role": "player", "id": {"$in": visible_to}},
            {"password_hash": 0, "_id": 0},
        ).to_list(1000)
    else:
        players = await db.users.find({"role": "player"}, {"password_hash": 0, "_id": 0}).to_list(1000)
    for p in players:
        await _create_notification(
            p["id"], "scenario_arrival",
            scenario_title=scenario["title"],
            scenario_type=scenario["scenario_type"],
            scenario_number=scenario.get("scenario_number"),
        )
    scenario.pop("_id", None)
    return scenario

@api_router.put("/scenarios/{scenario_id}")
async def update_scenario(scenario_id: str, body: ScenarioCreate, user: dict = Depends(require_admin)):
    result = await db.scenarios.update_one({"id": scenario_id}, {"$set": body.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return await db.scenarios.find_one({"id": scenario_id}, {"_id": 0})

@api_router.delete("/scenarios/{scenario_id}")
async def delete_scenario(scenario_id: str, user: dict = Depends(require_admin)):
    await db.scenarios.delete_one({"id": scenario_id})
    return {"ok": True}


@api_router.post("/scenarios/{scenario_id}/complete")
async def complete_scenario(scenario_id: str, user: dict = Depends(require_admin)):
    scenario = await db.scenarios.find_one({"id": scenario_id})
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if scenario.get("cleared_at"):
        raise HTTPException(status_code=400, detail="Scenario already cleared")

    # Determine target players
    visible_to = scenario.get("visible_to") or []
    if visible_to:
        players = await db.users.find(
            {"role": "player", "id": {"$in": visible_to}},
            {"password_hash": 0, "_id": 0},
        ).to_list(1000)
    else:
        players = await db.users.find({"role": "player"}, {"password_hash": 0, "_id": 0}).to_list(1000)

    reward_coins = int(scenario.get("reward_coins") or 0)
    reason = f"Cleared scenario: {scenario['title']}"
    awarded_ids = []

    for p in players:
        if reward_coins > 0:
            await db.users.update_one({"id": p["id"]}, {"$inc": {"coins": reward_coins}})
            tx = {
                "id": str(uuid.uuid4()),
                "player_id": p["id"],
                "player_name": p["name"],
                "amount": reward_coins,
                "reason": reason,
                "type": "scenario",
                "scenario_id": scenario_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.transactions.insert_one(tx)
        await _create_notification(
            p["id"], "scenario_cleared",
            reason=scenario.get("reward") or (f"+{reward_coins} coins" if reward_coins else "You have cleared the scenario."),
            amount=reward_coins,
            scenario_title=scenario["title"],
        )
        awarded_ids.append(p["id"])

    await db.scenarios.update_one(
        {"id": scenario_id},
        {"$set": {
            "cleared_at": datetime.now(timezone.utc).isoformat(),
            "cleared_by_admin": user["id"],
            "awarded_player_ids": awarded_ids,
        }},
    )
    doc = await db.scenarios.find_one({"id": scenario_id}, {"_id": 0})
    return doc


# ---------- Notifications (player-facing) ----------
@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    if user.get("role") != "player":
        return []
    docs = await db.notifications.find(
        {"player_id": user["id"], "seen": False},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50)
    return docs


class MarkSeenInput(BaseModel):
    ids: List[str] = []


@api_router.post("/notifications/mark-seen")
async def mark_notifications_seen(body: MarkSeenInput = MarkSeenInput(), user: dict = Depends(get_current_user)):
    if user.get("role") != "player":
        return {"ok": True}
    query = {"player_id": user["id"], "seen": False}
    if body.ids:
        query["id"] = {"$in": body.ids}
    await db.notifications.update_many(query, {"$set": {"seen": True}})
    return {"ok": True}


# ---------- Constants ----------
@api_router.get("/meta")
async def meta():
    return {"ranks": RANKS, "categories": CATEGORIES}


# ---------- App wiring ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # Indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.items.create_index("id", unique=True)
        await db.scenarios.create_index("id", unique=True)
    except Exception as e:
        logger.warning(f"index setup: {e}")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@dokkaebi.shop")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Dokkaebi King",
            "role": "admin",
            "coins": 0,
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    # Migrations
    try:
        # Rename old category "Modifiers" -> "Story"
        r = await db.items.update_many({"category": "Modifiers"}, {"$set": {"category": "Story"}})
        if r.modified_count:
            logger.info(f"Migrated {r.modified_count} items: Modifiers -> Story")
        # Category "Star Relics" is removed; migrate any leftovers to "Items"
        r2 = await db.items.update_many({"category": "Star Relics"}, {"$set": {"category": "Items"}})
        if r2.modified_count:
            logger.info(f"Migrated {r2.modified_count} items: Star Relics category -> Items")
        # Backfill stats for players missing new fields (safe: preserves progression)
        async for u in db.users.find({"role": "player"}):
            existing_stats = u.get("stats") or {}
            new_stats = dict(existing_stats)
            missing_stat = False
            for k in STAT_KEYS:
                if k not in new_stats:
                    new_stats[k] = 10
                    missing_stat = True
            set_updates = {}
            if missing_stat:
                set_updates["stats"] = new_stats
            if "unallocated_points" not in u:
                # Existing players: only get free points if their sheet is fully "fresh"
                # (i.e., missing acuity means fresh migration → grant 25)
                set_updates["unallocated_points"] = STARTING_FREE_POINTS if "acuity" not in existing_stats else 0
            maxes = vitals_max(new_stats)
            if u.get("hp_current") is None:
                set_updates["hp_current"] = maxes["hp"]
            if u.get("mp_current") is None:
                set_updates["mp_current"] = maxes["mp"]
            if u.get("stamina_current") is None:
                set_updates["stamina_current"] = maxes["stamina"]
            if set_updates:
                await db.users.update_one({"id": u["id"]}, {"$set": set_updates})
    except Exception as e:
        logger.warning(f"migration: {e}")
    # Initialize storage
    init_storage()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
