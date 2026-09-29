import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Optional, Union

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from PIL import Image

from config import settings
from memory.client import MemoryClient
from memory.feedback_log import get_feedback_log
from memory.profile import get_profile
from memory.seed_kb import seed_fashion_kb
from services.feedback import submit_feedback
from services.memory_viewer import get_memory_view
from services.recommend import recommend

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("devnovate")

# Color palette mapping for 400x500 solid-color placeholders
COLOR_MAP = {
    "indigo": (46, 58, 89),
    "white": (245, 245, 245),
    "light_blue": (173, 216, 230),
    "beige": (225, 210, 185),
    "navy": (27, 38, 59),
    "black": (30, 30, 30),
    "charcoal": (54, 69, 79),
    "grey": (128, 128, 128),
    "crimson": (180, 20, 50),
    "emerald": (16, 140, 90),
    "mustard": (225, 173, 1),
    "multicolor": (218, 140, 170),
    "gold": (212, 175, 55),
    "burgundy": (128, 0, 32),
    "cream": (250, 245, 230),
    "blue_striped": (100, 149, 237),
    "denim_blue": (65, 105, 185),
}

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
PHOTOS_DIR = os.path.join(DATA_DIR, "photos")
WARDROBES_FILE = os.path.join(DATA_DIR, "wardrobes.json")

memory_client = MemoryClient()


class RecommendRequest(BaseModel):
    user_id: str
    exclude: Optional[Union[list[list[str]], list[str]]] = Field(default_factory=list)
    mode: Optional[str] = Field(default="closet", description="'closet' or 'discover'")


class FeedbackRequest(BaseModel):
    user_id: str
    item_ids: list[str]
    action: str
    attributes_used: dict[str, Any] = Field(default_factory=dict)
    clarification: Optional[str] = None
    reasoning: Optional[str] = None


def generate_placeholder_images() -> None:
    """Generate 400x500 solid-color placeholder PNGs if missing."""
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    if not os.path.exists(WARDROBES_FILE):
        logger.warning(f"Wardrobes file not found at {WARDROBES_FILE}")
        return

    with open(WARDROBES_FILE, "r", encoding="utf-8") as f:
        wardrobes_data = json.load(f)

    generated_count = 0
    for user_id, items in wardrobes_data.items():
        for item in items:
            item_id = item.get("id")
            if not item_id:
                continue

            photo_path = os.path.join(PHOTOS_DIR, f"{item_id}.png")
            if not os.path.exists(photo_path):
                color_name = item.get("attributes", {}).get("color", "grey").lower()
                rgb = COLOR_MAP.get(color_name, (180, 180, 180))
                img = Image.new("RGB", (400, 500), color=rgb)
                img.save(photo_path, "PNG")
                generated_count += 1

    if generated_count > 0:
        logger.info(f"Generated {generated_count} placeholder PNGs in {PHOTOS_DIR}")


def load_wardrobes() -> dict[str, list[dict[str, Any]]]:
    """Load mock wardrobes from JSON file."""
    if not os.path.exists(WARDROBES_FILE):
        return {}
    with open(WARDROBES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup:
    # 1. Generate placeholder images if missing
    generate_placeholder_images()
    # 2. Seed fashion_kb knowledge bank if empty (idempotent)
    seed_fashion_kb(memory_client, bank_id=settings.fashion_kb_bank_id)
    yield
    # Shutdown


app = FastAPI(
    title="F____mory API",
    description="AI Wardrobe Assistant with Persistent Memory",
    version="0.2.0",
    lifespan=lifespan,
)

# Open CORS to local frontend dev ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure photos directory exists before mounting static files
os.makedirs(PHOTOS_DIR, exist_ok=True)
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/kb/search")
def search_kb(q: str = Query(..., description="Search query string")) -> list[dict[str, Any]]:
    """
    Search the fashion knowledge bank.
    Returns [{"doc_id": str, "content": str, "score": float}].
    """
    results = memory_client.retrieve(bank=settings.fashion_kb_bank_id, query=q, top_k=3)
    return results


@app.get("/wardrobe/{user_id}")
def get_wardrobe(user_id: str) -> list[dict[str, Any]]:
    """
    Fetch full wardrobe JSON for a user.
    Returns 404 for unknown user.
    """
    wardrobes = load_wardrobes()
    user_wardrobe = wardrobes.get(user_id.lower())
    if user_wardrobe is None:
        raise HTTPException(
            status_code=404,
            detail=f"Wardrobe for user '{user_id}' not found",
        )
    return user_wardrobe


@app.get("/profile/{user_id}")
def read_profile(user_id: str) -> dict[str, Any]:
    """
    Fetch user profile document.
    Returns {"preferences": [], "mood_flags": 0} if not yet initialized.
    """
    return get_profile(user_id, client=memory_client)


@app.post("/recommend")
def get_outfit_recommendation(body: RecommendRequest) -> dict[str, Any]:
    """
    Generate an AI outfit recommendation for a user.
    Supports mode: 'closet' (strictly owned items) or 'discover' (owned items + 1 new curated piece).
    Uses Hindsight KB styling rules, user profile preferences, and Groq LLM.
    """
    return recommend(
        user_id=body.user_id,
        exclude=body.exclude,
        mode=body.mode or "closet",
        memory_client=memory_client,
    )


@app.post("/feedback")
def submit_user_feedback(body: FeedbackRequest) -> dict[str, Any]:
    """
    Submit user feedback (accept or reject) on outfit recommendations.

    Both response shapes below are valid HTTP 200 responses:

    1. Probe Response (when needs_clarification is True):
       Returned when a reject occurs on an outfit with 2 or more attribute categories
       and no clarification was provided yet. Nothing is written to memory yet.
       Shape:
       {
           "needs_clarification": true,
           "options": [
               {"key": "color", "label": "The red color"},
               {"key": "type", "label": "The hoodie style"},
               {"key": "mood", "label": "Just not my mood today"}
           ],
           "item_ids": ["arjun_w1", "arjun_w5"]
       }

    2. Decision Response (when feedback decision is executed):
       Returned when accept is processed, or when single-category reject is processed,
       or when clarification is provided for a multi-category reject.
       Shape:
       {
           "needs_clarification": false,
           "written": true,
           "memory_write_summary": "Learned: likes color:indigo, type:tshirt",
           "profile_confidence_snapshot": [
               {"attribute": "color:indigo", "sentiment": 0.5, "confidence": 0.33, "evidence": 1}
           ],
           "suggestion": "mood_flags_high"  # optional: included if mood_flags >= 2
       }
    """
    return submit_feedback(
        user_id=body.user_id,
        item_ids=body.item_ids,
        action=body.action,
        attributes_used=body.attributes_used,
        clarification=body.clarification,
        reasoning=body.reasoning,
        client=memory_client,
    )


@app.get("/feedback-log/{user_id}")
def read_feedback_log(user_id: str, limit: int = Query(20, ge=1, le=100)) -> list[dict[str, Any]]:
    """
    Retrieve user feedback log entries, sorted newest first.
    Returns up to `limit` entries.
    """
    return get_feedback_log(user_id=user_id, limit=limit, client=memory_client)


@app.get("/memory/{user_id}")
def read_memory_view(user_id: str) -> dict[str, Any]:
    """
    Get interpreted persistent memory view for a user.
    Returns 404 if user_id is not in the known wardrobe users.
    """
    wardrobes = load_wardrobes()
    if user_id.lower() not in wardrobes:
        raise HTTPException(
            status_code=404,
            detail=f"Wardrobe for user '{user_id}' not found",
        )
    return get_memory_view(user_id=user_id, client=memory_client)
