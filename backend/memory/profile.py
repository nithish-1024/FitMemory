import json
import logging
from typing import Any, Optional

from config import settings
from memory.client import MemoryClient

logger = logging.getLogger(__name__)

DEFAULT_PROFILE = {"preferences": [], "mood_flags": 0}
EMPTY_PROFILE_PROMPT = "No learned preferences yet. Suggest a balanced, well-styled outfit."


def get_profile(user_id: str, client: Optional[MemoryClient] = None) -> dict[str, Any]:
    """
    Retrieve user profile from Hindsight bank f"{user_bank_prefix}{user_id}_profile".
    Document ID: "profile".
    If the bank or document does not exist, returns {"preferences": [], "mood_flags": 0}.
    Never raises an exception.
    """
    try:
        mem_client = client or MemoryClient()
        bank = f"{settings.user_bank_prefix}{user_id}_profile"
        doc = mem_client.get_document(bank, "profile")
        if not doc:
            return {"preferences": [], "mood_flags": 0}

        content = doc.get("content")
        if not content:
            return {"preferences": [], "mood_flags": 0}

        if isinstance(content, str):
            data = json.loads(content)
        elif isinstance(content, dict):
            data = content
        else:
            return {"preferences": [], "mood_flags": 0}

        if not isinstance(data, dict):
            return {"preferences": [], "mood_flags": 0}

        preferences = data.get("preferences")
        if not isinstance(preferences, list):
            preferences = []

        mood_flags = data.get("mood_flags", 0)
        return {
            "preferences": preferences,
            "mood_flags": mood_flags,
        }
    except Exception as e:
        logger.warning(f"Failed to fetch profile for user '{user_id}': {e}")
        return {"preferences": [], "mood_flags": 0}


def profile_to_prompt_text(profile: dict[str, Any]) -> str:
    """
    Convert user profile dict to human-readable prompt lines.
    e.g. "AVOID color:red (confidence 0.7)", "PREFER fit:oversized (confidence 0.9)".
    Only includes entries with confidence >= 0.3.
    If empty, returns "No learned preferences yet. Suggest a balanced, well-styled outfit."
    """
    if not profile or not isinstance(profile, dict):
        return EMPTY_PROFILE_PROMPT

    preferences = profile.get("preferences")
    if not preferences or not isinstance(preferences, list):
        return EMPTY_PROFILE_PROMPT

    lines: list[str] = []
    for item in preferences:
        if not isinstance(item, dict):
            continue

        attr = item.get("attribute")
        sentiment = item.get("sentiment", 0.0)
        confidence = item.get("confidence", 0.0)

        try:
            conf_val = float(confidence)
            sent_val = float(sentiment)
        except (ValueError, TypeError):
            continue

        # Only include entries with confidence >= 0.3
        if not attr or conf_val < 0.3:
            continue

        conf_str = f"{conf_val:.1f}" if round(conf_val, 1) == conf_val else str(conf_val)

        if sent_val < 0:
            lines.append(f"AVOID {attr} (confidence {conf_str})")
        else:
            lines.append(f"PREFER {attr} (confidence {conf_str})")

    if not lines:
        return EMPTY_PROFILE_PROMPT

    return "\n".join(lines)


def write_preference(
    user_id: str,
    attribute: str,
    delta_sentiment: float,
    client: Optional[MemoryClient] = None,
) -> dict[str, Any]:
    """
    Write or update a preference for a given attribute in the user profile.
    - Read current profile via get_profile(user_id).
    - Find existing entry with this "attribute" string:
      - If found: evidence += 1;
        sentiment = (sentiment_old * evidence_old + delta_sentiment) / evidence_new;
        confidence = min(1.0, evidence / 3).
      - If not found: create {"attribute": attribute, "sentiment": delta,
        "confidence": min(1.0, 1/3), "evidence": 1}.
    - Save whole profile dict back as "profile" document via MemoryClient.seed_document
      with overwrite=True (delete-then-retain).
    """
    mem_client = client or MemoryClient()
    profile = get_profile(user_id, client=mem_client)
    preferences = profile.get("preferences")
    if not isinstance(preferences, list):
        preferences = []
        profile["preferences"] = preferences

    existing_entry: Optional[dict[str, Any]] = None
    for entry in preferences:
        if isinstance(entry, dict) and entry.get("attribute") == attribute:
            existing_entry = entry
            break

    if existing_entry is not None:
        evidence_old = int(existing_entry.get("evidence", 1))
        sentiment_old = float(existing_entry.get("sentiment", 0.0))
        evidence_new = evidence_old + 1
        sentiment_new = (sentiment_old * evidence_old + float(delta_sentiment)) / evidence_new
        confidence_new = min(1.0, evidence_new / 3.0)

        existing_entry["evidence"] = evidence_new
        existing_entry["sentiment"] = round(sentiment_new, 4)
        existing_entry["confidence"] = round(confidence_new, 2)
    else:
        new_entry = {
            "attribute": attribute,
            "sentiment": round(float(delta_sentiment), 4),
            "confidence": round(min(1.0, 1.0 / 3.0), 2),
            "evidence": 1,
        }
        preferences.append(new_entry)

    bank = f"{settings.user_bank_prefix}{user_id}_profile"
    mem_client.seed_document(
        bank=bank,
        doc_id="profile",
        content=json.dumps(profile),
        metadata={"doc_id": "profile"},
        overwrite=True,
    )
    return profile


def increment_mood_flag(
    user_id: str,
    client: Optional[MemoryClient] = None,
) -> dict[str, Any]:
    """
    Increment user's mood_flags counter by 1 and save back to profile document.
    """
    mem_client = client or MemoryClient()
    profile = get_profile(user_id, client=mem_client)
    profile["mood_flags"] = int(profile.get("mood_flags", 0)) + 1

    bank = f"{settings.user_bank_prefix}{user_id}_profile"
    mem_client.seed_document(
        bank=bank,
        doc_id="profile",
        content=json.dumps(profile),
        metadata={"doc_id": "profile"},
        overwrite=True,
    )
    return profile


def reset_mood_flags(
    user_id: str,
    client: Optional[MemoryClient] = None,
) -> dict[str, Any]:
    """
    Reset user's mood_flags counter to 0 and save back to profile document.
    """
    mem_client = client or MemoryClient()
    profile = get_profile(user_id, client=mem_client)
    profile["mood_flags"] = 0

    bank = f"{settings.user_bank_prefix}{user_id}_profile"
    mem_client.seed_document(
        bank=bank,
        doc_id="profile",
        content=json.dumps(profile),
        metadata={"doc_id": "profile"},
        overwrite=True,
    )
    return profile

