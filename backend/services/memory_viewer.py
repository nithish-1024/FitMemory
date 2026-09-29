import logging
from typing import Any, Optional

from memory.client import MemoryClient
from memory.feedback_log import get_feedback_log
from memory.profile import get_profile

logger = logging.getLogger(__name__)


def get_memory_view(
    user_id: str,
    client: Optional[MemoryClient] = None,
) -> dict[str, Any]:
    """
    Generate an interpreted, structured view of the user's persistent memory.

    1. Reads user profile from Hindsight.
    2. Parses each preference:
       - Category and value from "category:value"
       - Direction: "likes" if sentiment > 0 else "avoids"
       - Label: f"{direction.capitalize()} {value} ({category})"
       - Strength: "strong" (>= 0.66), "moderate" (>= 0.33), or "early signal"
       - Sorted by confidence descending.
    3. Retrieves up to 5 most recent feedback logs.
    4. Computes a human-readable one-sentence summary.
    """
    try:
        mem_client = client or MemoryClient()
        profile = get_profile(user_id, client=mem_client) or {}

        raw_preferences = profile.get("preferences")
        if not isinstance(raw_preferences, list):
            raw_preferences = []

        parsed_preferences: list[dict[str, Any]] = []
        for item in raw_preferences:
            if not isinstance(item, dict):
                continue

            attr = str(item.get("attribute", ""))
            if ":" in attr:
                category, value = attr.split(":", 1)
            else:
                category, value = "other", attr

            category = category.strip()
            value = value.strip()

            sentiment = float(item.get("sentiment", 0.0))
            direction = "likes" if sentiment > 0 else "avoids"
            label = f"{direction.capitalize()} {value} ({category})"

            confidence = float(item.get("confidence", 0.0))
            if confidence >= 0.66:
                strength = "strong"
            elif confidence >= 0.33:
                strength = "moderate"
            else:
                strength = "early signal"

            evidence = int(item.get("evidence", 1))

            parsed_preferences.append({
                "category": category,
                "value": value,
                "direction": direction,
                "label": label,
                "confidence": confidence,
                "strength": strength,
                "evidence": evidence,
            })

        # Sort all entries by confidence descending
        parsed_preferences.sort(key=lambda x: x["confidence"], reverse=True)

        # Recent feedback log (limit 5)
        recent_log = get_feedback_log(user_id, limit=5, client=mem_client) or []

        # One sentence summary
        if not parsed_preferences:
            summary = "I am learning your style. Accept or pass on recommendations to calibrate."
        else:
            n_total = len(parsed_preferences)
            n_strong = sum(1 for p in parsed_preferences if p["strength"] == "strong")
            pref_word = "preference" if n_total == 1 else "preferences"
            summary = f"{n_total} learned {pref_word}, {n_strong} strong."

        mood_flags = int(profile.get("mood_flags", 0))

        return {
            "user_id": user_id,
            "preferences": parsed_preferences if parsed_preferences else [],
            "mood_flags": mood_flags,
            "recent_activity": recent_log if recent_log else [],
            "summary": summary if summary else "I am learning your style. Accept or pass on recommendations to calibrate.",
        }
    except Exception as e:
        logger.warning(f"get_memory_view encountered error for user '{user_id}': {e}")
        return {
            "user_id": user_id,
            "preferences": [],
            "mood_flags": 0,
            "recent_activity": [],
            "summary": "I am learning your style. Accept or pass on recommendations to calibrate.",
        }
