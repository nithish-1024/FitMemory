import json
import os
import sys
import unittest
from datetime import datetime, timezone
from uuid import uuid4

# Ensure backend directory is in python path
BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)

from starlette.testclient import TestClient
from main import app
from memory.client import MemoryClient
from memory.profile import (
    get_profile,
    increment_mood_flag,
    reset_mood_flags,
    write_preference,
)
from memory.feedback_log import get_feedback_log, log_feedback
from services.feedback import submit_feedback


class TestPrompt3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.mem_client = MemoryClient()
        # Use isolated test users so tests are idempotent and deterministic
        cls.user_p3 = f"test_p3_{uuid4().hex[:6]}"

    def test_criterion_1_accept_single_value_color_type(self):
        """
        1. Accept with attributes_used having single-value color+type writes 2 preferences
           with sentiment +0.5, confidence 0.33 each on first write.
        """
        user = f"u1_{uuid4().hex[:6]}"
        payload = {
            "user_id": user,
            "item_ids": [f"{user}_w1", f"{user}_w2"],
            "action": "accept",
            "attributes_used": {
                "color": ["indigo"],
                "type": ["tshirt"],
                "fit": ["regular", "slim"],  # multi-value, should be ignored
            },
        }
        res = self.client.post("/feedback", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["needs_clarification"])
        self.assertTrue(data["written"])
        self.assertIn("Learned: likes", data["memory_write_summary"])

        snapshot = data["profile_confidence_snapshot"]
        pref_dict = {p["attribute"]: p for p in snapshot}
        self.assertIn("color:indigo", pref_dict)
        self.assertIn("type:tshirt", pref_dict)
        self.assertNotIn("fit:regular", pref_dict)

        self.assertAlmostEqual(pref_dict["color:indigo"]["sentiment"], 0.5, places=2)
        self.assertAlmostEqual(pref_dict["color:indigo"]["confidence"], 0.33, places=2)
        self.assertEqual(pref_dict["color:indigo"]["evidence"], 1)

        self.assertAlmostEqual(pref_dict["type:tshirt"]["sentiment"], 0.5, places=2)
        self.assertAlmostEqual(pref_dict["type:tshirt"]["confidence"], 0.33, places=2)
        self.assertEqual(pref_dict["type:tshirt"]["evidence"], 1)
        print("Criterion 1 passed: Accept writes 2 preferences (+0.5, 0.33 confidence).")

    def test_criterion_2_reject_single_attribute_category(self):
        """
        2. Reject with a single-attribute-category outfit writes one preference at
           -0.6 directly, no clarification step.
        """
        user = f"u2_{uuid4().hex[:6]}"
        payload = {
            "user_id": user,
            "item_ids": [f"{user}_w1"],
            "action": "reject",
            "attributes_used": {
                "color": ["crimson"],
            },
        }
        res = self.client.post("/feedback", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["needs_clarification"])
        self.assertTrue(data["written"])
        self.assertIn("dislikes color:crimson", data["memory_write_summary"])

        pref_dict = {p["attribute"]: p for p in data["profile_confidence_snapshot"]}
        self.assertIn("color:crimson", pref_dict)
        self.assertAlmostEqual(pref_dict["color:crimson"]["sentiment"], -0.6, places=2)
        self.assertAlmostEqual(pref_dict["color:crimson"]["confidence"], 0.33, places=2)
        self.assertEqual(pref_dict["color:crimson"]["evidence"], 1)
        print("Criterion 2 passed: Reject single category writes preference at -0.6 directly without clarification.")

    def test_criterion_3_reject_multi_category_probe(self):
        """
        3. Reject with a 2+-category outfit and no 'clarification' field returns
           needs_clarification:true with an options list containing a 'mood' option.
        """
        user = f"u3_{uuid4().hex[:6]}"
        payload = {
            "user_id": user,
            "item_ids": [f"{user}_w1", f"{user}_w2"],
            "action": "reject",
            "attributes_used": {
                "color": ["red"],
                "type": ["hoodie"],
            },
        }
        res = self.client.post("/feedback", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["needs_clarification"])
        self.assertIn("options", data)
        self.assertEqual(data["item_ids"], payload["item_ids"])

        option_keys = [opt["key"] for opt in data["options"]]
        self.assertIn("color", option_keys)
        self.assertIn("type", option_keys)
        self.assertIn("mood", option_keys)

        mood_opt = next(opt for opt in data["options"] if opt["key"] == "mood")
        self.assertEqual(mood_opt["label"], "Just not my mood today")

        color_opt = next(opt for opt in data["options"] if opt["key"] == "color")
        self.assertEqual(color_opt["label"], "The red color")

        type_opt = next(opt for opt in data["options"] if opt["key"] == "type")
        self.assertEqual(type_opt["label"], "The hoodie style")

        # Verify nothing was written to profile yet
        profile = get_profile(user, client=self.mem_client)
        self.assertEqual(len(profile["preferences"]), 0)
        print("Criterion 3 passed: Multi-category reject probe returns options list including 'mood'.")

    def test_criterion_4_reject_with_clarification_color(self):
        """
        4. Same reject, then a second call with clarification:'color' writes exactly
           one preference (the color one) at -0.8, nothing for the other categories.
        """
        user = f"u4_{uuid4().hex[:6]}"
        payload = {
            "user_id": user,
            "item_ids": [f"{user}_w1", f"{user}_w2"],
            "action": "reject",
            "attributes_used": {
                "color": ["burgundy"],
                "type": ["boots"],
            },
            "clarification": "color",
        }
        res = self.client.post("/feedback", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["needs_clarification"])
        self.assertTrue(data["written"])
        self.assertIn("dislikes color:burgundy", data["memory_write_summary"])

        snapshot = data["profile_confidence_snapshot"]
        pref_dict = {p["attribute"]: p for p in snapshot}
        self.assertIn("color:burgundy", pref_dict)
        self.assertNotIn("type:boots", pref_dict)
        self.assertAlmostEqual(pref_dict["color:burgundy"]["sentiment"], -0.8, places=2)
        self.assertAlmostEqual(pref_dict["color:burgundy"]["confidence"], 0.33, places=2)
        print("Criterion 4 passed: Clarified reject writes only the chosen category at -0.8.")

    def test_criterion_5_same_attribute_rejected_twice(self):
        """
        5. Same attribute rejected twice total (two separate feedback calls,
           clarified both times) results in confidence = min(1, 2/3) ≈ 0.67 on that preference.
        """
        user = f"u5_{uuid4().hex[:6]}"
        payload1 = {
            "user_id": user,
            "item_ids": [f"{user}_w1"],
            "action": "reject",
            "attributes_used": {
                "color": ["gold"],
                "type": ["earrings"],
            },
            "clarification": "color",
        }
        res1 = self.client.post("/feedback", json=payload1)
        self.assertEqual(res1.status_code, 200)
        pref1 = next(p for p in res1.json()["profile_confidence_snapshot"] if p["attribute"] == "color:gold")
        self.assertAlmostEqual(pref1["confidence"], 0.33, places=2)
        self.assertEqual(pref1["evidence"], 1)

        payload2 = {
            "user_id": user,
            "item_ids": [f"{user}_w2"],
            "action": "reject",
            "attributes_used": {
                "color": ["gold"],
                "fit": ["oversized"],
            },
            "clarification": "color",
        }
        res2 = self.client.post("/feedback", json=payload2)
        self.assertEqual(res2.status_code, 200)
        pref2 = next(p for p in res2.json()["profile_confidence_snapshot"] if p["attribute"] == "color:gold")
        self.assertEqual(pref2["evidence"], 2)
        self.assertAlmostEqual(pref2["sentiment"], -0.8, places=2)
        self.assertAlmostEqual(pref2["confidence"], 0.67, places=2)
        print("Criterion 5 passed: Same attribute rejected twice results in confidence 0.67 (2/3).")

    def test_criterion_6_mood_flag_and_suggestion(self):
        """
        6. clarification:'mood' writes no preference, increments mood_flags, and
           after a 2nd mood submission, response includes suggestion:'mood_flags_high'.
        """
        user = f"u6_{uuid4().hex[:6]}"
        payload = {
            "user_id": user,
            "item_ids": [f"{user}_w1", f"{user}_w2"],
            "action": "reject",
            "attributes_used": {
                "color": ["navy"],
                "type": ["jacket"],
            },
            "clarification": "mood",
        }

        # 1st mood reject
        res1 = self.client.post("/feedback", json=payload)
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertFalse(data1["needs_clarification"])
        self.assertEqual(len(data1["profile_confidence_snapshot"]), 0)
        self.assertNotIn("suggestion", data1)

        profile1 = get_profile(user, client=self.mem_client)
        self.assertEqual(profile1["mood_flags"], 1)
        self.assertEqual(len(profile1["preferences"]), 0)

        # 2nd mood reject
        res2 = self.client.post("/feedback", json=payload)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertFalse(data2["needs_clarification"])
        self.assertEqual(len(data2["profile_confidence_snapshot"]), 0)
        self.assertEqual(data2.get("suggestion"), "mood_flags_high")

        profile2 = get_profile(user, client=self.mem_client)
        self.assertEqual(profile2["mood_flags"], 2)
        self.assertEqual(len(profile2["preferences"]), 0)
        print("Criterion 6 passed: mood rejection increments mood_flags and suggests 'mood_flags_high' on 2nd submission.")

    def test_criterion_7_feedback_log_newest_first(self):
        """
        7. GET /feedback-log/arjun returns entries with newest first.
        """
        user = "arjun"
        # Seed 3 distinct log entries for user arjun
        for i in range(3):
            entry = {
                "timestamp": f"2026-09-29T10:0{i}:00Z",
                "item_ids": [f"arjun_w{i}"],
                "action": "accept" if i % 2 == 0 else "reject",
                "clarification": None,
                "attributes_used": {"color": ["indigo"]},
                "reasoning": f"Interaction {i}",
            }
            log_feedback(user, entry, client=self.mem_client)

        res = self.client.get(f"/feedback-log/{user}?limit=10")
        self.assertEqual(res.status_code, 200)
        logs = res.json()
        self.assertIsInstance(logs, list)
        self.assertGreaterEqual(len(logs), 3)

        # Verify sorted newest first
        timestamps = [item.get("timestamp") for item in logs if item.get("timestamp")]
        for idx in range(len(timestamps) - 1):
            self.assertGreaterEqual(timestamps[idx], timestamps[idx + 1])
        print("Criterion 7 passed: Feedback log entries returned newest first.")


if __name__ == "__main__":
    unittest.main()
