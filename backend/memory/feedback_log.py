import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from config import settings
from memory.client import MemoryClient

logger = logging.getLogger(__name__)


def log_feedback(
    user_id: str,
    entry: dict[str, Any],
    client: Optional[MemoryClient] = None,
) -> None:
    """
    Log a feedback entry to user's feedback log bank: f"{user_bank_prefix}{user_id}_feedback_log".
    doc_id = f"fb_{uuid4().hex[:8]}"
    content = JSON string
    """
    try:
        mem_client = client or MemoryClient()
        bank = f"{settings.user_bank_prefix}{user_id}_feedback_log"
        doc_id = f"fb_{uuid4().hex[:8]}"
        content_str = json.dumps(entry)
        mem_client.seed_document(
            bank=bank,
            doc_id=doc_id,
            content=content_str,
            metadata={"doc_id": doc_id},
            overwrite=False,
        )
    except Exception as e:
        logger.warning(f"Failed to log feedback for user '{user_id}': {e}")


def get_feedback_log(
    user_id: str,
    limit: int = 20,
    client: Optional[MemoryClient] = None,
) -> list[dict[str, Any]]:
    """
    Fetch user's feedback log entries, sorted by timestamp descending.
    Returns newest `limit` items.
    """
    try:
        mem_client = client or MemoryClient()
        bank = f"{settings.user_bank_prefix}{user_id}_feedback_log"
        doc_ids = mem_client.list_documents(bank=bank, limit=limit)
        if not doc_ids:
            return []

        docs = mem_client.get_documents_batch(bank=bank, doc_ids=doc_ids[:limit])
        entries: list[dict[str, Any]] = []

        for doc in docs:
            if not doc:
                continue
            content = doc.get("content")
            if not content:
                continue
            try:
                data = json.loads(content) if isinstance(content, str) else content
                if isinstance(data, dict):
                    entries.append(data)
            except Exception:
                continue

        # Sort entries descending by ISO 8601 timestamp string
        entries.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
        return entries[:limit]
    except Exception as e:
        logger.warning(f"Failed to retrieve feedback log for user '{user_id}': {e}")
        return []
