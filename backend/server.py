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
CATEGORIES = ["Items", "Skills", "Modifiers", "Star Relics"]

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
    category: Literal["Items", "Skills", "Modifiers", "Star Relics"]
    rank: str
    price: int = Field(ge=0)
    stock: int = Field(default=-1)  # -1 = unlimited
    image_path: Optional[str] = None

class GrantCoins(BaseModel):
    player_id: str
    amount: int
    reason: str

class ScenarioCreate(BaseModel):
    title: str
    description: str = ""
    scenario_type: Literal["main", "sub", "bounty"]
    visible_to: List[str] = []  # empty list = all players
    reward: str = ""
    reward_coins: int = Field(default=0, ge=0)

class PurchaseInput(BaseModel):
    item_id: str


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
    return docs


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
async def _create_notification(player_id: str, kind: str, title: str, message: str, amount: int = 0):
    doc = {
        "id": str(uuid.uuid4()),
        "player_id": player_id,
        "kind": kind,  # "grant" | "scenario_cleared"
        "title": title,
        "message": message,
        "amount": amount,
        "seen": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)


@api_router.post("/grant-coins")
async def grant_coins(body: GrantCoins, user: dict = Depends(require_admin)):
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
    # Player-facing notification: sponsorship from constellations
    if body.amount > 0:
        await _create_notification(
            body.player_id, "grant",
            "A Constellation Sponsors You",
            f"{body.reason}",
            body.amount,
        )
    else:
        await _create_notification(
            body.player_id, "grant",
            "Coin Deduction",
            f"{body.reason}",
            body.amount,
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
    inv = {
        "id": str(uuid.uuid4()),
        "player_id": user["id"],
        "item_id": item["id"],
        "item_snapshot": {k: v for k, v in item.items() if k != "_id"},
        "purchased_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inventory.insert_one(inv)
    tx.pop("_id", None)
    return tx

@api_router.get("/inventory")
async def list_inventory(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "admin" else {"player_id": user["id"]}
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
            f"Scenario Cleared — {scenario['title']}",
            scenario.get("reward") or (f"+{reward_coins} coins" if reward_coins else "You have cleared the scenario."),
            reward_coins,
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


@api_router.post("/notifications/mark-seen")
async def mark_notifications_seen(user: dict = Depends(get_current_user)):
    if user.get("role") != "player":
        return {"ok": True}
    await db.notifications.update_many(
        {"player_id": user["id"], "seen": False},
        {"$set": {"seen": True}},
    )
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
    # Initialize storage
    init_storage()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
