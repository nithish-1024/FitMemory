import json
import os
import sys
import unittest

BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)

from starlette.testclient import TestClient
from main import app


class TestRecommendEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_criterion_1_recommend_basic(self):
        """POST /recommend with {"user_id": "arjun", "exclude": []} returns 2-4 items + reasoning + kb_rules + image_url + image_prompt"""
        res = self.client.post("/recommend", json={"user_id": "arjun", "exclude": []})
        self.assertEqual(res.status_code, 200, f"Error: {res.text}")
        data = res.json()

        # Check items
        self.assertIn("items", data)
        self.assertIn("item_ids", data)
        self.assertTrue(2 <= len(data["items"]) <= 4)
        for item in data["items"]:
            self.assertTrue(item["id"].startswith("arjun_"))
            self.assertIn("name", item)
            self.assertIn("photo", item)
            self.assertIn("attributes", item)

        # Check reasoning
        self.assertIn("reasoning", data)
        self.assertTrue(len(data["reasoning"]) > 10)

        # Check kb_rules_used
        self.assertIn("kb_rules_used", data)
        self.assertTrue(len(data["kb_rules_used"]) >= 1)

        # Check image_prompt & image_url
        self.assertIn("image_prompt", data)
        self.assertIn("image_url", data)
        self.assertTrue(data["image_url"].startswith("https://image.pollinations.ai/prompt/"))

        print("Test 1 passed: /recommend returned valid items, reasoning, kb_rules, image_prompt, image_url.")

    def test_criterion_2_items_never_in_exclude_list(self):
        """Items in the response are never in the exclude list."""
        excluded = ["arjun_w1", "arjun_w2", "arjun_w3", "arjun_w4"]
        res = self.client.post("/recommend", json={"user_id": "arjun", "exclude": excluded})
        self.assertEqual(res.status_code, 200, f"Error: {res.text}")
        data = res.json()

        item_ids = [item["id"] for item in data["items"]]
        for ex in excluded:
            self.assertNotIn(ex, item_ids, f"Excluded item {ex} was found in response!")

        print(f"Test 2 passed: Excluded items {excluded} were absent from {item_ids}.")

    def test_empty_wardrobe_after_exclude_returns_400(self):
        """Excluding all items in a wardrobe returns 400 with clear message."""
        # Arjun has 12 items (arjun_w1 through arjun_w12)
        all_arjun_items = [f"arjun_w{i}" for i in range(1, 13)]
        res = self.client.post("/recommend", json={"user_id": "arjun", "exclude": all_arjun_items})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Empty wardrobe after exclude", res.json()["detail"])
        print("Test 3 passed: Empty wardrobe after exclude correctly returned 400.")

    def test_unknown_user_returns_404(self):
        """Unknown user returns 404."""
        res = self.client.post("/recommend", json={"user_id": "unknown_person_xyz"})
        self.assertEqual(res.status_code, 404)
        print("Test 4 passed: Unknown user returned 404.")

    def test_2d_exclude_compatibility(self):
        """2D list of excluded outfit combos (Prompt 2 format) returns a different outfit."""
        res1 = self.client.post("/recommend", json={"user_id": "arjun"})
        self.assertEqual(res1.status_code, 200)
        outfit1 = res1.json()["item_ids"]

        res2 = self.client.post("/recommend", json={"user_id": "arjun", "exclude": [outfit1]})
        self.assertEqual(res2.status_code, 200)
        outfit2 = res2.json()["item_ids"]

        self.assertNotEqual(set(outfit1), set(outfit2))
        print("Test 5 passed: 2D outfit exclusion returned a distinct outfit.")


if __name__ == "__main__":
    unittest.main()
