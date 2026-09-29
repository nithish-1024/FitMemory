import json
import logging
import os
import re
import urllib.parse
from typing import Any, Optional, Union

from fastapi import HTTPException
from groq import Groq

from config import settings
from memory.client import MemoryClient
from memory.profile import EMPTY_PROFILE_PROMPT, get_profile, profile_to_prompt_text

logger = logging.getLogger(__name__)

WARDROBES_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "wardrobes.json")

TOP_TYPES = {
    "tshirt",
    "shirt",
    "blouse",
    "top",
    "sweater",
    "hoodie",
    "camisole",
    "overshirt",
    "jacket",
    "blazer",
}
BOTTOM_TYPES = {"trousers", "jeans", "skirt", "pants", "shorts"}
SHOE_TYPES = {"shoes", "boots", "sneakers", "loafers"}
DRESS_TYPES = {"dress"}

FALLBACK_REASONING = "Fallback outfit based on wardrobe basics."
FALLBACK_IMAGE_PROMPT = (
    "Full-body fashion editorial lookbook photography of a stylish person wearing clean classic wardrobe essentials, "
    "standing in a minimalist architectural studio, soft diffuse daylight, Vogue magazine aesthetic, photorealistic fabric textures, 35mm film, hyper-realistic, 8k resolution, elegant posture."
)


def load_wardrobes() -> dict[str, list[dict[str, Any]]]:
    """Load wardrobe dataset."""
    if not os.path.exists(WARDROBES_FILE):
        return {}
    with open(WARDROBES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_two_sentences(text: str, default_rule: str = "color theory") -> str:
    """Normalize unicode characters and ensure that the reasoning string contains exactly two sentences."""
    normalized = (
        text.replace("\u2011", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    cleaned = " ".join(normalized.strip().split())
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]

    if len(sentences) == 2:
        return f"{sentences[0]} {sentences[1]}"
    elif len(sentences) > 2:
        return f"{sentences[0]} {sentences[1]}"
    elif len(sentences) == 1:
        s1 = sentences[0]
        if not s1.endswith((".", "!", "?")):
            s1 += "."
        return f"{s1} This combination follows the {default_rule} rule for balanced contrast and harmony."
    else:
        return (
            "This combination balances silhouette proportions and coordinated palette tones. "
            f"The styling adheres to core {default_rule} principles."
        )


def compute_attributes_used(chosen_items: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Compute unique attributes used from chosen items."""
    attributes_used: dict[str, list[str]] = {
        "color": [],
        "type": [],
        "fit": [],
        "texture": [],
    }
    for item in chosen_items:
        attrs = item.get("attributes", {})
        for key in ["color", "type", "fit", "texture"]:
            val = attrs.get(key)
            if val is not None:
                str_val = str(val)
                if str_val not in attributes_used[key]:
                    attributes_used[key].append(str_val)
    return attributes_used


def get_rule_based_fallback(
    wardrobe: list[dict[str, Any]], exclude: list[Any]
) -> list[str]:
    """
    Generate rule-based fallback outfit:
    first top + first bottom + first shoes not in exclude.
    """
    exclude_sets = [
        set(ex) for ex in (exclude or []) if isinstance(ex, (list, set, tuple)) and ex
    ]

    tops = [
        it["id"]
        for it in wardrobe
        if it.get("attributes", {}).get("type", "").lower() in TOP_TYPES
    ]
    bottoms = [
        it["id"]
        for it in wardrobe
        if it.get("attributes", {}).get("type", "").lower() in BOTTOM_TYPES
    ]
    shoes = [
        it["id"]
        for it in wardrobe
        if it.get("attributes", {}).get("type", "").lower() in SHOE_TYPES
    ]

    # Try 1: first top + first bottom + first shoes not in exclude
    for t in tops:
        for b in bottoms:
            for s in shoes:
                combo = [t, b, s]
                if set(combo) not in exclude_sets:
                    return combo

    # Try 2: first top + first bottom not in exclude
    for t in tops:
        for b in bottoms:
            combo = [t, b]
            if set(combo) not in exclude_sets:
                return combo

    # Try 3: any 2-3 items not in exclude
    n = len(wardrobe)
    for i in range(n):
        for j in range(i + 1, n):
            combo = [wardrobe[i]["id"], wardrobe[j]["id"]]
            if set(combo) not in exclude_sets:
                return combo

    # Ultimate fallback
    if len(wardrobe) >= 2:
        return [wardrobe[0]["id"], wardrobe[1]["id"]]
    return [wardrobe[0]["id"]] if wardrobe else []


def get_model_description(user_id: str) -> str:
    """Return gender-specific and model-specific editorial description."""
    normalized = user_id.lower()
    if normalized == "arjun":
        return "Full-body fashion editorial lookbook photo of a stylish 20-something South Asian male model (Arjun), masculine tailoring, clean styled hair"
    elif normalized == "sara":
        return "Full-body fashion editorial lookbook photo of a stylish 20-something South Asian female model (Sara), feminine tailoring, elegant posture"
    else:
        return f"Full-body fashion editorial lookbook photo of a stylish 20-something model ({user_id}), elegant tailoring"


def build_discovered_product_image_url(item_name: str, color: str, category: str) -> str:
    """Build an isolated product photograph URL for a newly discovered fashion piece."""
    prompt = (
        f"Studio product catalog photo of a luxury {color} {item_name} {category}, "
        "ghost mannequin or flat lay on soft neutral studio background, 8k resolution, crisp clean lighting, designer fashion"
    )
    encoded = urllib.parse.quote(prompt.strip())
    return f"https://image.pollinations.ai/prompt/{encoded}?width=400&height=400&model=flux&nologo=true"


def format_final_image_prompt(
    user_id: str,
    chosen_items: list[dict[str, Any]],
    raw_prompt: Optional[str] = None,
) -> str:
    """Ensure image_prompt strictly matches model gender, exact garments, and luxury studio lookbook standard."""
    model_desc = get_model_description(user_id)
    garments_list = []
    for it in chosen_items:
        name = it.get("name", "")
        attrs = it.get("attributes", {})
        color = attrs.get("color", "")
        cat = attrs.get("type", "")
        if color and color.lower() not in name.lower():
            garments_list.append(f"{color} {name}")
        else:
            garments_list.append(name)
    garments_desc = ", ".join(garments_list)

    studio_setting = (
        "standing in a minimalist architectural studio, soft diffuse daylight, Vogue magazine aesthetic, "
        "photorealistic fabric textures, 35mm film, hyper-realistic, 8k resolution, confident posture"
    )

    if not raw_prompt or raw_prompt == FALLBACK_IMAGE_PROMPT:
        return f"{model_desc}, wearing {garments_desc}, {studio_setting}."

    prompt_lower = raw_prompt.lower()
    normalized_user = user_id.lower()

    if normalized_user == "arjun":
        cleaned = re.sub(
            r"(?i)\b(a stylish person|a female model|a woman|female model|female)\b",
            "",
            raw_prompt,
        ).strip()
        cleaned = re.sub(r"^,\s*", "", cleaned)
        if "male model" not in prompt_lower and "arjun" not in prompt_lower:
            return f"{model_desc}, wearing {garments_desc}, {cleaned if cleaned else studio_setting}"
        return cleaned

    if normalized_user == "sara":
        cleaned = re.sub(
            r"(?i)\b(a stylish person|a male model|a man|male model|male)\b",
            "",
            raw_prompt,
        ).strip()
        cleaned = re.sub(r"^,\s*", "", cleaned)
        if "female model" not in prompt_lower and "sara" not in prompt_lower:
            return f"{model_desc}, wearing {garments_desc}, {cleaned if cleaned else studio_setting}"
        return cleaned

    return raw_prompt


def get_discover_fallback(
    wardrobe: list[dict[str, Any]], exclude: list[Any], user_id: str = "arjun"
) -> tuple[list[str], dict[str, Any], str, str]:
    """Fallback for discover mode when LLM is unavailable."""
    base_item = (
        wardrobe[0]
        if wardrobe
        else {
            "id": "item_1",
            "name": "Classic Oxford Shirt",
            "attributes": {"color": "white", "type": "shirt"},
        }
    )
    base_color = base_item.get("attributes", {}).get("color", "white").lower()
    base_type = base_item.get("attributes", {}).get("type", "shirt").lower()

    if base_type in TOP_TYPES:
        new_name = "Tailored High-Waist Pleated Trousers"
        new_cat = "trousers"
        new_color = (
            "charcoal" if base_color in ("white", "cream", "light_blue") else "bone"
        )
        new_desc = "Fills an essential wardrobe gap with a sharp, fluid silhouette that grounds the look."
    else:
        new_name = "Textured Minimalist Knit Overshirt"
        new_cat = "overshirt"
        new_color = "indigo" if base_color in ("beige", "white", "khaki") else "cream"
        new_desc = "Introduces modern layered texture and tone contrast against your wardrobe bottom."

    new_item = {
        "id": "new_piece_suggested",
        "name": new_name,
        "category": new_cat,
        "color": new_color,
        "fit": "relaxed",
        "reasoning": new_desc,
        "description": new_desc,
        "photo": build_discovered_product_image_url(new_name, new_color, new_cat),
    }
    reasoning = (
        f"This {new_color} {new_name} introduces a tailored proportion that balances the {base_item.get('name', 'owned piece')}. "
        "The curated pairing establishes tonal depth according to core color theory principles."
    )
    model_desc = get_model_description(user_id)
    image_prompt = (
        f"{model_desc}, wearing {base_item.get('name', 'owned wardrobe piece')} "
        f"paired with a new {new_color} {new_name}, standing in a minimalist architectural studio, soft diffuse daylight, Vogue magazine aesthetic, photorealistic fabric textures, 35mm film, hyper-realistic, 8k resolution, elegant posture."
    )
    return [base_item["id"]], new_item, reasoning, image_prompt


def validate_outfit(
    item_ids: Any,
    wardrobe_id_set: set[str],
    exclude_sets: list[set[str]],
    excluded_item_ids: Optional[set[str]] = None,
    mode: str = "closet",
) -> tuple[bool, str]:
    """Validate that item_ids meets all constraints."""
    if not isinstance(item_ids, list):
        return False, "item_ids must be a list of strings."

    min_count = 1 if mode == "discover" else 2
    max_count = 2 if mode == "discover" else 4

    if not (min_count <= len(item_ids) <= max_count):
        return (
            False,
            f"item_ids count for {mode} mode must be between {min_count} and {max_count}, got {len(item_ids)}.",
        )
    for i_id in item_ids:
        if not isinstance(i_id, str):
            return False, f"Invalid item_id type: {i_id}"
        if i_id not in wardrobe_id_set:
            return False, f"item_id '{i_id}' is not in the user's wardrobe."
        if excluded_item_ids and i_id in excluded_item_ids:
            return False, f"item_id '{i_id}' is in the excluded items list."
    if mode == "closet" and set(item_ids) in exclude_sets:
        return False, f"Outfit {item_ids} is in the excluded outfits list."
    return True, ""


def build_image_url(image_prompt: str) -> str:
    """Build pollinations.ai image URL routing to FLUX photorealistic model with luxury editorial tags."""
    editorial_tags = (
        "standing in a minimalist architectural studio, soft diffuse daylight, Vogue magazine aesthetic, "
        "photorealistic fabric textures, 35mm film, hyper-realistic, 8k resolution, elegant posture"
    )
    if "hyper-realistic" not in image_prompt.lower() and "photorealistic" not in image_prompt.lower():
        full_prompt = f"{image_prompt}, {editorial_tags}"
    else:
        full_prompt = image_prompt

    normalized = (
        full_prompt.replace("\u2011", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    encoded_prompt = urllib.parse.quote(normalized.strip())
    return (
        f"https://image.pollinations.ai/prompt/{encoded_prompt}"
        "?width=768&height=1024&model=flux&nologo=true"
    )


def recommend(
    user_id: str,
    exclude: Optional[Union[list[list[str]], list[str]]] = None,
    mode: str = "closet",
    memory_client: Optional[MemoryClient] = None,
) -> dict[str, Any]:
    """
    Generate an AI outfit recommendation for user_id.

    Modes:
    - "closet": Recombines 2-4 items strictly from available wardrobe items.
    - "discover": Selects 1-2 items from wardrobe, and invents 1 new complementary item
      tailored to the user's style memory.
    """
    clean_exclude = exclude or []
    excluded_item_ids: set[str] = set()
    exclude_outfit_sets: list[set[str]] = []

    for entry in clean_exclude:
        if isinstance(entry, str):
            excluded_item_ids.add(entry)
        elif isinstance(entry, (list, set, tuple)):
            exclude_outfit_sets.append(set(entry))

    # 1. Load wardrobe
    wardrobes = load_wardrobes()
    normalized_user = user_id.lower()
    if normalized_user not in wardrobes:
        raise HTTPException(
            status_code=404,
            detail=f"Wardrobe for user '{user_id}' not found",
        )
    full_wardrobe = wardrobes[normalized_user]

    # Filter out any item_ids present in exclude
    available_wardrobe = [
        item for item in full_wardrobe if item["id"] not in excluded_item_ids
    ]
    if len(available_wardrobe) == 0:
        raise HTTPException(
            status_code=400,
            detail="Empty wardrobe after exclude: no items remaining to recommend",
        )

    wardrobe_by_id = {item["id"]: item for item in available_wardrobe}
    wardrobe_id_set = set(wardrobe_by_id.keys())

    # 2. KB retrieval
    mem_client = memory_client or MemoryClient()
    kb_rules_used: list[str] = []
    kb_rules_text = ""
    try:
        kb_results = mem_client.retrieve(
            bank=settings.fashion_kb_bank_id,
            query="outfit styling color pairing proportion texture formality trend",
            top_k=3,
        )
        kb_rules_used = [r["doc_id"] for r in kb_results if "doc_id" in r]
        kb_rules_text = "\n".join(
            f"- {r.get('doc_id', 'rule')}: {r.get('content', '')}" for r in kb_results
        )
    except Exception as e:
        logger.warning(f"Error querying fashion_kb: {e}")

    if not kb_rules_used:
        kb_rules_used = ["kb_color_theory", "kb_proportion", "kb_japanese_pairings"]
        kb_rules_text = (
            "- kb_color_theory: 60-30-10 rule: 60% dominant neutral base, 30% secondary color, 10% accent.\n"
            "- kb_proportion: Balance silhouettes: oversized top needs fitted or straight bottom.\n"
            "- kb_japanese_pairings: Pair one strong color with one muted color."
        )

    # 3. Profile
    profile = get_profile(normalized_user, client=mem_client)
    profile_text = profile_to_prompt_text(profile)
    has_learned_preferences = profile_text != EMPTY_PROFILE_PROMPT

    compact_wardrobe = [
        {"id": it["id"], "name": it["name"], "attributes": it.get("attributes", {})}
        for it in available_wardrobe
    ]

    # 4. System Prompt by Mode
    model_desc = get_model_description(user_id)

    if mode == "discover":
        system_prompt = (
            "You are an expert personal stylist and wardrobe curator.\n"
            f"Target Model: {model_desc}.\n"
            "The user wants to DISCOVER a brand-new clothing piece to add to their wardrobe that pairs with 1-2 pieces they already own.\n"
            f"Follow these styling rules:\n{kb_rules_text}\n\n"
            f"Learned user preferences (respect these):\n{profile_text}\n\n"
            "TASK:\n"
            "1. Select 1 or 2 item_ids from the user's available wardrobe list that will form the base.\n"
            "2. Invent ONE new complementary fashion piece ('new_item') with 'id' ('new_piece_suggested'), 'name', 'category', 'color', 'fit', and 'reasoning' (explaining why it elevates the wardrobe).\n"
            "3. Provide 'reasoning' in exactly 2 sentences explaining why this new item pairs harmoniously with the chosen owned piece(s).\n"
            f"4. Provide 'image_prompt' strictly following this template: {model_desc}, wearing [EXACT GARMENTS AND COLORS], standing in a minimalist architectural studio, soft diffuse daylight, Vogue magazine aesthetic, photorealistic fabric textures, 35mm film, hyper-realistic, 8k resolution, confident posture.\n\n"
            "Return strict JSON only in this format:\n"
            "{\n"
            '  "item_ids": ["owned_id_1"],\n'
            '  "new_item": {\n'
            '    "id": "new_piece_suggested",\n'
            '    "name": "Earthy Olive Relaxed Blazer",\n'
            '    "category": "blazer",\n'
            '    "color": "olive",\n'
            '    "fit": "relaxed",\n'
            '    "reasoning": "Balances your neutral tones with a subtle earthy hue."\n'
            "  },\n"
            '  "reasoning": "...",\n'
            '  "image_prompt": "..."\n'
            "}"
        )
        user_message = f"Wardrobe items available:\n{json.dumps(compact_wardrobe)}"
    else:
        system_prompt = (
            "You are a personal stylist agent. Use ONLY items from the wardrobe list.\n"
            f"Target Model: {model_desc}.\n"
            f"Follow these fashion rules:\n{kb_rules_text}\n\n"
            f"Learned user preferences (respect these):\n{profile_text}\n\n"
            'Return strict JSON only: {"item_ids": [...], "reasoning": "...", "image_prompt": "..."}.\n'
            "item_ids: 2-4 ids from the wardrobe, must form a wearable outfit (one top or dress, "
            "one bottom unless a dress, footwear if available).\n"
            "reasoning: exactly 2 sentences, naming the specific rule or learned preference applied.\n"
            f"image_prompt: {model_desc}, wearing [EXACT GARMENTS AND COLORS], standing in a minimalist architectural studio, soft diffuse daylight, Vogue magazine aesthetic, photorealistic fabric textures, 35mm film, hyper-realistic, 8k resolution, confident posture."
        )
        user_message = (
            f"Wardrobe items:\n{json.dumps(compact_wardrobe)}\n\n"
            f"Do not repeat these outfits: {exclude_outfit_sets}"
        )

    used_fallback = False
    chosen_item_ids: list[str] = []
    new_item_data: Optional[dict[str, Any]] = None
    reasoning: str = ""
    image_prompt: str = ""

    # Attempt Groq LLM completion
    try:
        if not settings.groq_api_key:
            raise ValueError("No GROQ_API_KEY configured")

        groq_client = Groq(
            api_key=settings.groq_api_key,
            timeout=20.0,
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        def call_llm(msgs: list[dict[str, str]]) -> tuple[bool, dict[str, Any], str]:
            resp = groq_client.chat.completions.create(
                model=settings.groq_model,
                messages=msgs,
                response_format={"type": "json_object"},
                temperature=0.4,
            )
            raw = resp.choices[0].message.content or "{}"
            try:
                parsed = json.loads(raw)
            except Exception as parse_err:
                return False, {}, f"JSON decode error: {parse_err}"

            valid, err_msg = validate_outfit(
                parsed.get("item_ids"),
                wardrobe_id_set,
                exclude_outfit_sets,
                excluded_item_ids,
                mode=mode,
            )
            if not valid:
                return False, parsed, err_msg

            if mode == "discover":
                ni = parsed.get("new_item")
                if not isinstance(ni, dict) or not ni.get("name"):
                    return False, parsed, "Missing new_item details in discover response"

            return True, parsed, ""

        success, parsed_data, err = call_llm(messages)
        if not success:
            logger.info(f"Groq recommendation first attempt failed ({err}). Retrying once...")
            retry_messages = list(messages)
            retry_messages.append(
                {
                    "role": "assistant",
                    "content": json.dumps(parsed_data) if parsed_data else "{}",
                }
            )
            retry_messages.append(
                {
                    "role": "user",
                    "content": (
                        f"The previous output had an error: {err}. "
                        "Please fix it and return strict JSON complying with the requested schema."
                    ),
                }
            )
            success, parsed_data, err = call_llm(retry_messages)

        if success:
            chosen_item_ids = parsed_data["item_ids"]
            if mode == "discover":
                new_item_data = parsed_data.get("new_item")
            primary_rule = kb_rules_used[0] if kb_rules_used else "color theory"
            reasoning = ensure_two_sentences(
                str(parsed_data.get("reasoning", "")), default_rule=primary_rule
            )
            image_prompt = str(
                parsed_data.get("image_prompt", "")
            ).strip() or FALLBACK_IMAGE_PROMPT
        else:
            logger.warning(f"Groq retry also failed validation: {err}. Using fallback.")
            used_fallback = True

    except Exception as e:
        logger.warning(f"Groq call failed or timed out: {e}. Using fallback.")
        used_fallback = True

    # 5. Fallback if needed
    if used_fallback or not chosen_item_ids:
        used_fallback = True
        if mode == "discover":
            chosen_item_ids, new_item_data, reasoning, image_prompt = (
                get_discover_fallback(available_wardrobe, exclude_outfit_sets, user_id=user_id)
            )
        else:
            chosen_item_ids = get_rule_based_fallback(available_wardrobe, exclude_outfit_sets)
            reasoning = FALLBACK_REASONING
            fallback_items = [wardrobe_by_id[i] for i in chosen_item_ids if i in wardrobe_by_id]
            image_prompt = format_final_image_prompt(user_id, fallback_items)

    # 6. Build items array
    chosen_items = [
        dict(wardrobe_by_id[i_id]) for i_id in chosen_item_ids if i_id in wardrobe_by_id
    ]

    # If discover mode, append new item representation to items list
    if mode == "discover" and new_item_data:
        curated_item_id = new_item_data.get("id") or "new_piece_suggested"
        new_item_data["id"] = curated_item_id
        color_val = str(new_item_data.get("color", "neutral")).lower()
        cat_val = str(
            new_item_data.get("category") or new_item_data.get("type") or "essential"
        ).lower()
        fit_val = str(new_item_data.get("fit", "relaxed")).lower()
        desc_val = str(
            new_item_data.get("reasoning")
            or new_item_data.get(
                "description", "A curated piece to complement your existing wardrobe."
            )
        )
        curated_name = new_item_data.get("name", "Curated Discovery Piece")
        curated_photo_url = new_item_data.get("photo") or build_discovered_product_image_url(
            curated_name, color_val, cat_val
        )
        new_item_data["photo"] = curated_photo_url

        new_wardrobe_item = {
            "id": curated_item_id,
            "name": curated_name,
            "photo": curated_photo_url,
            "attributes": {
                "color": color_val,
                "type": cat_val,
                "fit": fit_val,
                "texture": "textured",
                "is_new": True,
                "description": desc_val,
            },
        }
        chosen_items.append(new_wardrobe_item)

    # 7. Compute attributes_used
    attributes_used = compute_attributes_used(chosen_items)

    # 8. Ensure image_prompt strictly matches model gender and exact garments, then build URL
    image_prompt = format_final_image_prompt(user_id, chosen_items, image_prompt)
    image_url = build_image_url(image_prompt)
    profile_applied = has_learned_preferences and not used_fallback

    return {
        "user_id": user_id,
        "mode": mode,
        "item_ids": chosen_item_ids,
        "new_item": new_item_data,
        "items": chosen_items,
        "reasoning": reasoning,
        "attributes_used": attributes_used,
        "kb_rules_used": kb_rules_used,
        "profile_applied": profile_applied,
        "image_prompt": image_prompt,
        "image_url": image_url,
        "used_fallback": used_fallback,
    }
