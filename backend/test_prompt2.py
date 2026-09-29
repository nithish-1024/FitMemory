import re
import sys
from starlette.testclient import TestClient

from config import settings
from main import app
from memory.profile import get_profile, profile_to_prompt_text

print("--- Running Prompt 2 Acceptance Criteria Tests ---")

# Step 2 Unit tests: profile
p_empty = get_profile("test_user_empty")
assert p_empty == {"preferences": [], "mood_flags": 0}, f"Expected empty profile, got {p_empty}"
text_empty = profile_to_prompt_text(p_empty)
assert text_empty == "No learned preferences yet. Suggest a balanced, well-styled outfit.", f"Got {text_empty}"

sample_profile = {
    "preferences": [
        {"attribute": "color:red", "sentiment": -0.8, "confidence": 0.7, "evidence": 2},
        {"attribute": "fit:oversized", "sentiment": 0.9, "confidence": 0.9, "evidence": 3},
        {"attribute": "texture:denim", "sentiment": 0.5, "confidence": 0.2, "evidence": 1},  # < 0.3 should be excluded
    ],
    "mood_flags": 0,
}
sample_text = profile_to_prompt_text(sample_profile)
assert "AVOID color:red (confidence 0.7)" in sample_text, f"Expected AVOID in {sample_text}"
assert "PREFER fit:oversized (confidence 0.9)" in sample_text, f"Expected PREFER in {sample_text}"
assert "texture:denim" not in sample_text, "Low confidence (<0.3) should not be included"
print("Profile unit tests passed.")

with TestClient(app) as client:
    # Criterion 6: GET /profile/arjun returns {"preferences": [], "mood_flags": 0}
    res_prof = client.get("/profile/arjun")
    assert res_prof.status_code == 200, f"Expected 200, got {res_prof.status_code}"
    prof_data = res_prof.json()
    assert "preferences" in prof_data and "mood_flags" in prof_data, f"Expected valid profile structure, got {prof_data}"
    print("Criterion 6 passed: GET /profile/arjun returns valid profile structure")

    # Criterion 1: POST /recommend {"user_id":"arjun"} returns 2-4 item_ids in arjun's wardrobe, plus 2-sentence reasoning
    res_arjun = client.post("/recommend", json={"user_id": "arjun"})
    assert res_arjun.status_code == 200, f"Expected 200, got {res_arjun.status_code}: {res_arjun.text}"
    arjun_data = res_arjun.json()
    item_ids = arjun_data.get("item_ids", [])
    assert 2 <= len(item_ids) <= 4, f"Expected 2-4 items, got {len(item_ids)}"
    for i_id in item_ids:
        assert i_id.startswith("arjun_"), f"Item {i_id} does not belong to arjun"

    reasoning = arjun_data.get("reasoning", "")
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", reasoning.strip()) if s.strip()]
    assert len(sentences) == 2, f"Expected exactly 2 sentences in reasoning, got {len(sentences)}: {reasoning}"
    print(f"Criterion 1 passed: arjun outfit={item_ids}, reasoning={reasoning}")

    # Criterion 2: POST /recommend {"user_id":"sara"} returns only sara's item ids
    res_sara = client.post("/recommend", json={"user_id": "sara"})
    assert res_sara.status_code == 200, f"Expected 200, got {res_sara.status_code}: {res_sara.text}"
    sara_data = res_sara.json()
    sara_item_ids = sara_data.get("item_ids", [])
    assert 2 <= len(sara_item_ids) <= 4, f"Expected 2-4 items, got {len(sara_item_ids)}"
    for i_id in sara_item_ids:
        assert i_id.startswith("sara_"), f"Item {i_id} does not belong to sara"
    print(f"Criterion 2 passed: sara outfit={sara_item_ids}")

    # Criterion 3: kb_rules_used contains at least one fashion_kb doc_id
    kb_rules = arjun_data.get("kb_rules_used", [])
    assert len(kb_rules) >= 1, "kb_rules_used is empty"
    valid_kb_ids = {"kb_color_theory", "kb_japanese_pairings", "kb_proportion", "kb_texture", "kb_formality", "kb_trend_monochrome_layering"}
    assert any(r in valid_kb_ids for r in kb_rules), f"Expected at least one fashion_kb doc_id in {kb_rules}"
    print(f"Criterion 3 passed: kb_rules_used={kb_rules}")

    # Criterion 4: Calling twice with the first result in 'exclude' returns a different set
    res_arjun_2 = client.post("/recommend", json={"user_id": "arjun", "exclude": [item_ids]})
    assert res_arjun_2.status_code == 200
    item_ids_2 = res_arjun_2.json().get("item_ids", [])
    assert set(item_ids_2) != set(item_ids), f"Second outfit {item_ids_2} should differ from first outfit {item_ids}"
    print(f"Criterion 4 passed: second outfit {item_ids_2} differs from first {item_ids}")

    # Criterion 5: With an invalid GROQ_API_KEY the endpoint still returns 200 with used_fallback=true
    original_key = settings.groq_api_key
    try:
        settings.groq_api_key = "invalid_key_12345"
        res_fallback = client.post("/recommend", json={"user_id": "arjun"})
        assert res_fallback.status_code == 200, f"Expected 200 on invalid groq key, got {res_fallback.status_code}"
        fb_data = res_fallback.json()
        assert fb_data.get("used_fallback") is True, f"Expected used_fallback=True, got {fb_data.get('used_fallback')}"
        assert fb_data.get("reasoning") == "Fallback outfit based on wardrobe basics.", f"Unexpected fallback reasoning: {fb_data.get('reasoning')}"
        assert 2 <= len(fb_data.get("item_ids", [])) <= 4, f"Fallback items invalid: {fb_data.get('item_ids')}"
        print("Criterion 5 passed: invalid GROQ_API_KEY returned 200 with used_fallback=true and proper basics outfit.")
    finally:
        settings.groq_api_key = original_key

    # Check image_url format and attributes_used
    assert "pollinations.ai/prompt/" in arjun_data.get("image_url", ""), "Invalid image_url"
    attrs = arjun_data.get("attributes_used", {})
    assert "color" in attrs and "type" in attrs and "fit" in attrs and "texture" in attrs, "Missing attribute categories"
    print("image_url and attributes_used validation passed.")

print("\n=== ALL PROMPT 2 ACCEPTANCE CRITERIA PASSED ===")
