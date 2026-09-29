import json
import os
import sys
import unittest
from datetime import datetime, timezone
from uuid import uuid4

BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)

from starlette.testclient import TestClient
from main import app
from memory.client import MemoryClient
from memory.feedback_log import log_feedback
from memory.profile import get_profile


class TestPrompt4(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.mem_client = MemoryClient()

    def test_criterion_1_and_2_and_5_memory_view_flow(self):
        """
        Criteria 1, 2, 5:
        1. GET /memory/arjun with no prior feedback returns preferences: [], summary: 'No preferences learned yet.'
        2. After one accept and one clarified reject, returns 2 preference entries (one 'likes', one 'avoids') with correct strength buckets.
        5. Response matches exact JSON shape.
        """
        user = "arjun"
        # Reset arjun's profile and feedback log for test isolation
        bank_profile = f"user_{user}_profile"
        bank_log = f"user_{user}_feedback_log"
        self.mem_client.delete_document(bank_profile, "profile")
        for doc_id in self.mem_client.list_documents(bank_log, limit=50):
            self.mem_client.delete_document(bank_log, doc_id)

        # 1. Fresh memory check
        res1 = self.client.get(f"/memory/{user}")
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()

        # Check shape
        self.assertEqual(data1["user_id"], user)
        self.assertEqual(data1["preferences"], [])
        self.assertEqual(data1["mood_flags"], 0)
        self.assertEqual(data1["recent_activity"], [])
        self.assertEqual(data1["summary"], "No preferences learned yet.")
        print("Criterion 1 passed: Fresh profile returns empty preferences and 'No preferences learned yet.'")

        # 2. Perform 1 Accept (single-value attribute: type:tshirt)
        accept_payload = {
            "user_id": user,
            "item_ids": ["arjun_w1"],
            "action": "accept",
            "attributes_used": {
                "type": ["tshirt"]
            }
        }
        res_accept = self.client.post("/feedback", json=accept_payload)
        self.assertEqual(res_accept.status_code, 200)

        # 3. Perform 1 Clarified Reject (color:crimson)
        reject_payload = {
            "user_id": user,
            "item_ids": ["arjun_w2", "arjun_w3"],
            "action": "reject",
            "attributes_used": {
                "color": ["crimson"],
                "fit": ["regular"]
            },
            "clarification": "color"
        }
        res_reject = self.client.post("/feedback", json=reject_payload)
        self.assertEqual(res_reject.status_code, 200)

        # 4. Check memory view after 1 accept + 1 clarified reject
        res2 = self.client.get(f"/memory/{user}")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()

        # Validate exact shape fields
        self.assertIn("user_id", data2)
        self.assertIn("preferences", data2)
        self.assertIn("mood_flags", data2)
        self.assertIn("recent_activity", data2)
        self.assertIn("summary", data2)

        prefs = data2["preferences"]
        self.assertEqual(len(prefs), 2)

        likes_entry = next((p for p in prefs if p["direction"] == "likes"), None)
        avoids_entry = next((p for p in prefs if p["direction"] == "avoids"), None)

        self.assertIsNotNone(likes_entry, "Expected a 'likes' preference entry")
        self.assertIsNotNone(avoids_entry, "Expected an 'avoids' preference entry")

        # Check likes entry
        self.assertEqual(likes_entry["category"], "type")
        self.assertEqual(likes_entry["value"], "tshirt")
        self.assertEqual(likes_entry["label"], "Likes tshirt (type)")
        self.assertEqual(likes_entry["strength"], "moderate")
        self.assertEqual(likes_entry["evidence"], 1)
        self.assertAlmostEqual(likes_entry["confidence"], 0.33, places=2)

        # Check avoids entry
        self.assertEqual(avoids_entry["category"], "color")
        self.assertEqual(avoids_entry["value"], "crimson")
        self.assertEqual(avoids_entry["label"], "Avoids crimson (color)")
        self.assertEqual(avoids_entry["strength"], "moderate")
        self.assertEqual(avoids_entry["evidence"], 1)
        self.assertAlmostEqual(avoids_entry["confidence"], 0.33, places=2)

        # Check summary
        self.assertIn("2 learned preferences", data2["summary"])
        print("Criterion 2 passed: Returns 2 preferences with correct labels and strength buckets.")
        print("Criterion 5 passed: JSON structure matches required schema exactly.")

    def test_criterion_3_recent_activity_at_most_5_newest_first(self):
        """
        3. recent_activity has at most 5 entries, newest first.
        """
        user = "sara"
        bank_log = f"user_{user}_feedback_log"
        # Seed 7 log entries
        for i in range(7):
            entry = {
                "timestamp": f"2026-09-29T11:0{i}:00Z",
                "item_ids": [f"sara_w{i}"],
                "action": "accept" if i % 2 == 0 else "reject",
                "clarification": None,
                "attributes_used": {"color": ["emerald"]},
                "reasoning": f"Activity {i}"
            }
            log_feedback(user, entry, client=self.mem_client)

        res = self.client.get(f"/memory/{user}")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        recent = data["recent_activity"]
        self.assertLessEqual(len(recent), 5)
        self.assertGreaterEqual(len(recent), 1)

        # Verify newest first (descending timestamp order)
        timestamps = [item.get("timestamp") for item in recent if item.get("timestamp")]
        for idx in range(len(timestamps) - 1):
            self.assertGreaterEqual(timestamps[idx], timestamps[idx + 1])
        print("Criterion 3 passed: recent_activity has at most 5 entries, sorted newest first.")

    def test_criterion_4_unknown_user_returns_404(self):
        """
        4. GET /memory/unknown_user returns 404.
        """
        res = self.client.get("/memory/unknown_user_9999")
        self.assertEqual(res.status_code, 404)
        print("Criterion 4 passed: Unknown user returns 404.")


if __name__ == "__main__":
    unittest.main()
