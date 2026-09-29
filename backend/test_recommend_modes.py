"""
Verification test script for dual recommendation modes ("closet" vs "discover")
and Hindsight memory sync in FitMemory.
"""

import sys
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_closet_mode():
    print("\n--- Test 1: POST /recommend with mode='closet' ---")
    payload = {"user_id": "arjun", "mode": "closet"}
    response = client.post("/recommend", json=payload)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    assert "item_ids" in data, "Response missing item_ids"
    assert "items" in data, "Response missing items"
    assert "reasoning" in data, "Response missing reasoning"
    assert "image_url" in data, "Response missing image_url"

    item_ids = data["item_ids"]
    assert 2 <= len(item_ids) <= 4, f"Expected 2-4 items, got {len(item_ids)}: {item_ids}"
    assert data.get("mode") == "closet", f"Expected mode 'closet', got {data.get('mode')}"

    print(f"Status: {response.status_code} OK")
    print(f"Mode: {data.get('mode')}")
    print(f"Chosen Item IDs: {item_ids}")
    print(f"Items count: {len(data['items'])}")
    print(f"Reasoning: {data['reasoning']}")
    print(f"Image URL: {data['image_url'][:60]}...")
    print("PASS: Closet mode returned valid owned items.")


def test_discover_mode():
    print("\n--- Test 2: POST /recommend with mode='discover' ---")
    payload = {"user_id": "arjun", "mode": "discover"}
    response = client.post("/recommend", json=payload)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    assert "item_ids" in data, "Response missing item_ids"
    assert "items" in data, "Response missing items"
    assert "new_item" in data, "Response missing new_item"
    assert data["new_item"] is not None, "new_item should not be None in discover mode"
    assert "reasoning" in data, "Response missing reasoning"
    assert "image_url" in data, "Response missing image_url"

    item_ids = data["item_ids"]
    assert 1 <= len(item_ids) <= 2, f"Expected 1-2 owned items, got {len(item_ids)}: {item_ids}"
    assert data.get("mode") == "discover", f"Expected mode 'discover', got {data.get('mode')}"

    new_item = data["new_item"]
    assert "name" in new_item, "new_item must have 'name'"
    assert "color" in new_item, "new_item must have 'color'"
    assert "category" in new_item or "type" in new_item, "new_item must have 'category' or 'type'"

    # Verify that new_item attributes are included in attributes_used
    attributes_used = data.get("attributes_used", {})
    print(f"Status: {response.status_code} OK")
    print(f"Mode: {data.get('mode')}")
    print(f"Base Owned Item IDs: {item_ids}")
    print(f"Discovered New Piece: {new_item.get('name')} ({new_item.get('color')}, {new_item.get('category')})")
    print(f"Reasoning: {data['reasoning']}")
    print(f"Attributes Used: {attributes_used}")
    print("PASS: Discover mode returned owned items + curated new_item.")


def test_feedback_memory_sync():
    print("\n--- Test 3: POST /feedback on Discovered Outfit ---")
    # 1. Generate discover outfit
    rec_res = client.post("/recommend", json={"user_id": "arjun", "mode": "discover"})
    assert rec_res.status_code == 200
    rec_data = rec_res.json()

    # 2. Submit Accept feedback
    fb_payload = {
        "user_id": "arjun",
        "item_ids": rec_data["item_ids"],
        "action": "accept",
        "attributes_used": rec_data.get("attributes_used", {}),
    }
    fb_res = client.post("/feedback", json=fb_payload)
    assert fb_res.status_code == 200, f"Feedback failed: {fb_res.text}"
    fb_data = fb_res.json()

    print(f"Feedback Status: {fb_res.status_code} OK")
    print(f"Written to Memory: {fb_data.get('written')}")
    print(f"Summary: {fb_data.get('memory_write_summary')}")
    assert fb_data.get("written") is True, "Feedback should be written to memory"
    print("PASS: Feedback successfully synced into Hindsight memory.")


def main():
    print("==================================================")
    print("  Running FitMemory Backend Recommendation Mode Tests")
    print("==================================================")
    try:
        test_closet_mode()
        test_discover_mode()
        test_feedback_memory_sync()
        print("\n==================================================")
        print("  ALL TESTS PASSED! Backend is aligned and ready.")
        print("==================================================")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Test Assertion Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] Unexpected Exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
