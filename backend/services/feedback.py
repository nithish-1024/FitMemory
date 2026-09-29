import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from memory.client import MemoryClient
from memory.feedback_log import log_feedback
from memory.profile import (
    get_profile,
    increment_mood_flag,
    reset_mood_flags,
    write_preference,
)

logger = logging.getLogger(__name__)

CATEGORY_LABEL_MAP = {
    "color": "color",
    "type": "style",
    "fit": "fit",
    "texture": "texture",
}


def submit_feedback(
    user_id: str,
    item_ids: list[str],
    action: str,
    attributes_used: dict[str, Any],
    clarification: Optional[str] = None,
    reasoning: Optional[str] = None,
    client: Optional[MemoryClient] = None,
) -> dict[str, Any]:
    """
    Handle user feedback on outfit recommendation.
    - action: "accept" or "reject"
    - ACCEPT path:
        For each category in attributes_used with a single value,
        write_preference(user_id, f"{category}:{value}", +0.5).
        reset_mood_flags(user_id).
        memory_write_summary = "Learned: likes " + comma list of attribute:value pairs.
    - REJECT path:
        attribute_categories = [k for k, v in attributes_used.items() if v]
        needs_clarification = len(attribute_categories) >= 2
        If not needs_clarification:
            write_preference for single category's value(s) at -0.6 directly.
            clarification stays None.
        If needs_clarification:
            If clarification is None:
                return probe response {"needs_clarification": True, "options": [...], "item_ids": item_ids}
                WITHOUT writing anything or logging yet.
            If clarification provided:
                "mood": increment_mood_flag(user_id). No preference write.
                otherwise: write_preference(user_id, f"{clarification}:{attributes_used[clarification][0]}", -0.8).
    - Always call log_feedback on decision responses.
    - If mood_flags >= 2: add "suggestion": "mood_flags_high".
    """
    mem_client = client or MemoryClient()
    norm_action = (action or "").lower().strip()

    if norm_action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'reject'")

    if norm_action == "accept":
        written_pairs: list[str] = []
        for category, values in (attributes_used or {}).items():
            if isinstance(values, list) and len(values) == 1:
                val = str(values[0])
                attr_key = f"{category}:{val}"
                write_preference(user_id, attr_key, +0.5, client=mem_client)
                written_pairs.append(attr_key)
            elif isinstance(values, str) and values:
                attr_key = f"{category}:{values}"
                write_preference(user_id, attr_key, +0.5, client=mem_client)
                written_pairs.append(attr_key)

        reset_mood_flags(user_id, client=mem_client)

        if written_pairs:
            memory_write_summary = "Learned: likes " + ", ".join(written_pairs)
        else:
            memory_write_summary = "no new preferences"

        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "item_ids": item_ids,
            "action": "accept",
            "clarification": clarification,
            "attributes_used": attributes_used,
            "reasoning": reasoning or memory_write_summary,
        }
        log_feedback(user_id, log_entry, client=mem_client)

        profile = get_profile(user_id, client=mem_client)
        mood_flags = profile.get("mood_flags", 0)
        response_data: dict[str, Any] = {
            "needs_clarification": False,
            "written": True,
            "memory_write_summary": memory_write_summary,
            "profile_confidence_snapshot": profile.get("preferences", []),
        }
        if mood_flags >= 2:
            response_data["suggestion"] = "mood_flags_high"
        return response_data

    else:
        # REJECT path
        attribute_categories = [
            k for k, v in (attributes_used or {}).items()
            if (isinstance(v, list) and len(v) > 0) or (isinstance(v, str) and v)
        ]
        needs_clarification = len(attribute_categories) >= 2

        if not needs_clarification:
            written_pairs = []
            if attribute_categories:
                single_cat = attribute_categories[0]
                vals = attributes_used[single_cat]
                val_list = vals if isinstance(vals, list) else [vals]
                for val in val_list:
                    attr_key = f"{single_cat}:{val}"
                    write_preference(user_id, attr_key, -0.6, client=mem_client)
                    written_pairs.append(attr_key)
                memory_write_summary = "Learned: dislikes " + ", ".join(written_pairs)
            else:
                memory_write_summary = "no new preferences"

            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "item_ids": item_ids,
                "action": "reject",
                "clarification": None,
                "attributes_used": attributes_used,
                "reasoning": reasoning or memory_write_summary,
            }
            log_feedback(user_id, log_entry, client=mem_client)

            profile = get_profile(user_id, client=mem_client)
            mood_flags = profile.get("mood_flags", 0)
            response_data = {
                "needs_clarification": False,
                "written": True,
                "memory_write_summary": memory_write_summary,
                "profile_confidence_snapshot": profile.get("preferences", []),
            }
            if mood_flags >= 2:
                response_data["suggestion"] = "mood_flags_high"
            return response_data

        else:
            # needs_clarification is True
            if not clarification:
                # Probe response without writing or logging yet
                options: list[dict[str, str]] = []
                for cat in attribute_categories:
                    vals = attributes_used[cat]
                    val_list = vals if isinstance(vals, list) else [vals]
                    val_str = ", ".join(str(v) for v in val_list)
                    suffix = CATEGORY_LABEL_MAP.get(cat, cat)
                    options.append({
                        "key": cat,
                        "label": f"The {val_str} {suffix}",
                    })
                options.append({
                    "key": "mood",
                    "label": "Just not my mood today",
                })
                return {
                    "needs_clarification": True,
                    "options": options,
                    "item_ids": item_ids,
                }
            else:
                clarification_key = str(clarification).lower().strip()
                if clarification_key == "mood":
                    increment_mood_flag(user_id, client=mem_client)
                    memory_write_summary = "No preference written (mood flagged)."
                else:
                    cat_vals = (attributes_used or {}).get(clarification_key)
                    if cat_vals:
                        val = cat_vals[0] if isinstance(cat_vals, list) else cat_vals
                        attr_key = f"{clarification_key}:{val}"
                        write_preference(user_id, attr_key, -0.8, client=mem_client)
                        memory_write_summary = f"Learned: dislikes {attr_key}"
                    else:
                        memory_write_summary = f"No attribute found for clarification '{clarification_key}'."

                log_entry = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "item_ids": item_ids,
                    "action": "reject",
                    "clarification": clarification_key,
                    "attributes_used": attributes_used,
                    "reasoning": reasoning or memory_write_summary,
                }
                log_feedback(user_id, log_entry, client=mem_client)

                profile = get_profile(user_id, client=mem_client)
                mood_flags = profile.get("mood_flags", 0)
                response_data = {
                    "needs_clarification": False,
                    "written": True,
                    "memory_write_summary": memory_write_summary,
                    "profile_confidence_snapshot": profile.get("preferences", []),
                }
                if mood_flags >= 2:
                    response_data["suggestion"] = "mood_flags_high"
                return response_data
