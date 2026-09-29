import json
import os
import sys
import unittest

BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)

from starlette.testclient import TestClient
from main import app
from memory.client import MemoryClient
from memory.pdf_processor import get_or_create_pdf_chunks
from memory.seed_kb import FASHION_KB_DOCUMENTS, seed_fashion_kb


class TestPrompt45(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.mem_client = MemoryClient()

    def test_criterion_1_and_2_extraction_and_chunk_metadata(self):
        """
        1. All PDF text is extracted and chunked without loss or corruption.
        2. Each chunk is seeded as a separate document with correct doc_id and metadata.
        """
        chunks = get_or_create_pdf_chunks()
        self.assertGreater(len(chunks), 50, "Expected significant chunk count from the book")

        # Verify word count ranges and metadata formatting
        for idx, chunk in enumerate(chunks, start=1):
            self.assertIn("doc_id", chunk)
            self.assertIn("content", chunk)
            self.assertIn("metadata", chunk)

            # Metadata verification
            meta = chunk["metadata"]
            self.assertEqual(meta.get("source"), "dress_code")
            self.assertEqual(meta.get("chunk"), idx)
            self.assertEqual(meta.get("type"), "fashion_knowledge")

            # Doc ID format: pdf_chunk_dress_code_001
            expected_doc_id = f"pdf_chunk_dress_code_{idx:03d}"
            self.assertEqual(chunk["doc_id"], expected_doc_id)

            # Text content validity
            words = chunk["content"].split()
            self.assertGreaterEqual(len(words), 200, f"Chunk {expected_doc_id} has fewer than 200 words")
            self.assertLessEqual(len(words), 800, f"Chunk {expected_doc_id} exceeds 800 words")

        print(f"Criteria 1 & 2 passed: {len(chunks)} chunks verified with valid doc_ids and metadata.")

    def test_criterion_3_idempotency_no_duplicates(self):
        """
        3. Idempotency: restarting the server/seeding does not duplicate PDF chunks.
        """
        docs_before = self.mem_client.list_documents("fashion_kb", limit=1000)
        count_before = len(docs_before)

        # Run seed_fashion_kb again
        seed_result = seed_fashion_kb(client=self.mem_client)
        self.assertTrue(seed_result)

        docs_after = self.mem_client.list_documents("fashion_kb", limit=1000)
        count_after = len(docs_after)

        self.assertEqual(count_before, count_after, "Document count changed after re-seeding!")
        print(f"Criterion 3 passed: Re-seeding was completely idempotent ({count_after} docs unchanged).")

    def test_criterion_4_kb_search_returns_original_and_pdf_chunks(self):
        """
        4. GET /kb/search returns both original 6 documents and PDF chunks in ranked order by relevance.
        """
        res = self.client.get("/kb/search?q=color pairing Japanese tradition")
        self.assertEqual(res.status_code, 200)
        results = res.json()
        self.assertGreaterEqual(len(results), 2)

        doc_ids = [r["doc_id"] for r in results]
        # Should contain original base doc
        has_base = any(d in FASHION_KB_DOCUMENTS for d in doc_ids)
        # Should contain PDF chunk
        has_pdf = any(d.startswith("pdf_chunk_") for d in doc_ids)

        self.assertTrue(has_base, f"Expected base KB document in search results: {doc_ids}")
        self.assertTrue(has_pdf, f"Expected PDF chunk in search results: {doc_ids}")

        # Check ranking: scores must be in descending order
        scores = [r["score"] for r in results]
        for i in range(len(scores) - 1):
            self.assertGreaterEqual(scores[i], scores[i + 1], "Search results are not sorted by score descending")

        print(f"Criterion 4 passed: /kb/search returned mix of base docs and PDF chunks: {doc_ids}")


if __name__ == "__main__":
    unittest.main()
