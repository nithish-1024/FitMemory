import re
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_all_fixes():
    print("=" * 60)
    print("  Running FitMemory Verification Tests for All 3 Fixes")
    print("=" * 60)

    print("\n--- Test 1: GET /memory/sara and GET /memory/arjun ---")
    t0 = time.time()
    res_sara = client.get("/memory/sara")
    t_sara = time.time() - t0
    assert res_sara.status_code == 200, f"Sara memory failed: {res_sara.status_code}"
    data_sara = res_sara.json()
    print(f"Sara memory status: {res_sara.status_code} in {t_sara:.3f}s")
    print(f"Sara summary: {data_sara.get('summary')}")
    assert "user_id" in data_sara
    assert "preferences" in data_sara
    assert "recent_activity" in data_sara

    t1 = time.time()
    res_arjun = client.get("/memory/arjun")
    t_arjun = time.time() - t1
    assert res_arjun.status_code == 200, f"Arjun memory failed: {res_arjun.status_code}"
    data_arjun = res_arjun.json()
    print(f"Arjun memory status: {res_arjun.status_code} in {t_arjun:.3f}s")
    print(f"Arjun summary: {data_arjun.get('summary')}")
    assert "user_id" in data_arjun
    assert "preferences" in data_arjun
    assert "recent_activity" in data_arjun
    print("PASS: Memory endpoints return valid structured responses rapidly with 0 timeouts.")

    print("\n--- Test 2: POST /recommend for Arjun (Gender & Clothes Check) ---")
    res_rec_arjun = client.post("/recommend", json={"user_id": "arjun", "mode": "closet"})
    assert res_rec_arjun.status_code == 200
    rec_arjun = res_rec_arjun.json()
    prompt_arjun = rec_arjun["image_prompt"].lower()
    print("Arjun prompt:", rec_arjun["image_prompt"][:120], "...")
    assert "male" in prompt_arjun or "arjun" in prompt_arjun, "Arjun prompt missing male model descriptor"
    assert "female" not in prompt_arjun, "Female model descriptor incorrectly present for Arjun"
    print("PASS: Arjun outfit generates male model image prompt.")

    print("\n--- Test 3: POST /recommend for Sara (Gender & Clothes Check) ---")
    res_rec_sara = client.post("/recommend", json={"user_id": "sara", "mode": "closet"})
    assert res_rec_sara.status_code == 200
    rec_sara = res_rec_sara.json()
    prompt_sara = rec_sara["image_prompt"].lower()
    print("Sara prompt:", rec_sara["image_prompt"][:120], "...")
    assert "female" in prompt_sara or "sara" in prompt_sara, "Sara prompt missing female model descriptor"
    assert not re.search(r"(?<!fe)male\s+model", prompt_sara), "Male model descriptor incorrectly present for Sara"
    assert not re.search(r"\b(man|masculine)\b", prompt_sara), "Male terms incorrectly present for Sara"
    print("PASS: Sara outfit generates female model image prompt.")

    print("\n--- Test 4: POST /recommend in Discover Mode (Photo Check) ---")
    res_rec_disc = client.post("/recommend", json={"user_id": "arjun", "mode": "discover"})
    assert res_rec_disc.status_code == 200
    rec_disc = res_rec_disc.json()
    new_item = rec_disc.get("new_item")
    assert new_item is not None, "new_item missing in discover mode"
    print("Discovered piece:", new_item.get("name"))
    print("Discovered photo URL:", new_item.get("photo"))
    assert new_item.get("photo", "").startswith("https://image.pollinations.ai/"), "Discovered piece missing Pollinations photo URL"
    discovered_in_items = [it for it in rec_disc.get("items", []) if it.get("attributes", {}).get("is_new")]
    assert len(discovered_in_items) > 0, "Discovered item not present in items list"
    assert discovered_in_items[0].get("photo", "").startswith("https://image.pollinations.ai/"), "Discovered item in items list missing photo URL"
    print("PASS: Discovered piece has full luxury product photo URL.")

    print("\n" + "=" * 60)
    print("  ALL 4 VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    test_all_fixes()
