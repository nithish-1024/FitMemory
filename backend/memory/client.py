import asyncio
import logging
import threading
from typing import Any, Optional

from hindsight_client import Hindsight
from hindsight_client_api.exceptions import NotFoundException
from config import settings

logger = logging.getLogger(__name__)


class _BackgroundLoop:
    """Dedicated background event loop to manage a single persistent Hindsight client and aiohttp session."""

    def __init__(self):
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def run(self, coro):
        fut = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return fut.result()


_bg_loop = _BackgroundLoop()


class MemoryClient:
    """
    Hindsight Memory Client wrapper providing:
      - seed_document(bank, doc_id, content, metadata)
      - retrieve(bank, query, top_k=3) -> list[dict]
      - get_document(bank, doc_id) -> dict | None
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.base_url = base_url or settings.hindsight_api_url
        self.api_key = api_key or settings.hindsight_api_key
        self.timeout = timeout
        self._client: Optional[Hindsight] = None

    @property
    def client(self) -> Hindsight:
        if self._client is None:
            self._client = Hindsight(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
            )
        return self._client

    def ensure_bank(self, bank: str) -> None:
        """Ensure that the memory bank exists in Hindsight."""
        async def _ensure():
            try:
                await self.client.aget_bank_config(bank_id=bank)
            except Exception:
                try:
                    await self.client.acreate_bank(
                        bank_id=bank,
                        name=bank,
                        mission=f"Memory bank for {bank}",
                    )
                except Exception as e:
                    logger.debug(f"Bank creation note for {bank}: {e}")

        _bg_loop.run(_ensure())

    def is_bank_empty(self, bank: str) -> bool:
        """Check if bank is empty or has no documents."""
        async def _check():
            try:
                docs = await self.client.documents.list_documents(bank_id=bank)
                return len(docs.items) == 0
            except Exception:
                return True

        return _bg_loop.run(_check())

    def delete_document(self, bank: str, doc_id: str) -> bool:
        """Delete a document from Hindsight bank if it exists."""
        async def _delete():
            try:
                await self.client.documents.delete_document(bank_id=bank, document_id=doc_id)
                return True
            except NotFoundException:
                return False
            except Exception as e:
                if "404" in str(e) or "not found" in str(e).lower():
                    return False
                logger.warning(f"Error deleting document '{doc_id}' from bank '{bank}': {e}")
                return False

        return _bg_loop.run(_delete())

    def list_documents(self, bank: str, limit: int = 100) -> list[str]:
        """List document IDs in a bank."""
        async def _list():
            try:
                docs = await self.client.documents.list_documents(bank_id=bank, limit=limit)
                return [d.id for d in docs.items]
            except Exception as e:
                if "404" in str(e) or "not found" in str(e).lower():
                    return []
                logger.warning(f"Error listing documents in bank '{bank}': {e}")
                return []

        return _bg_loop.run(_list())

    def seed_document(
        self, bank: str, doc_id: str, content: str, metadata: dict, overwrite: bool = False
    ) -> dict:
        """
        Seed a document into Hindsight bank.
        If overwrite is False, existing documents are skipped (idempotent seeding).
        If overwrite is True, existing documents are replaced (delete-then-retain).
        """
        self.ensure_bank(bank)

        async def _seed():
            existing = await self._aget_document(bank, doc_id)
            if existing is not None:
                if not overwrite:
                    logger.info(f"Document '{doc_id}' already exists in bank '{bank}'. Skipping.")
                    return existing
                # Overwrite: Hindsight requires delete-then-retain
                try:
                    await self.client.documents.delete_document(bank_id=bank, document_id=doc_id)
                except Exception as e:
                    logger.debug(f"Delete before overwrite note: {e}")

            meta = {str(k): str(v) for k, v in (metadata or {}).items()}
            meta["doc_id"] = doc_id

            await self.client.aretain(
                bank_id=bank,
                content=content,
                document_id=doc_id,
                metadata=meta,
                retain_async=False,
            )
            return {
                "doc_id": doc_id,
                "content": content,
                "metadata": metadata,
            }

        return _bg_loop.run(_seed())

    def seed_documents_batch(
        self, bank: str, docs: list[dict], concurrency: int = 8
    ) -> list[str]:
        """
        Batch seed multiple documents concurrently into Hindsight bank.
        Each item in docs is: {"doc_id": str, "content": str, "metadata": dict}.
        """
        self.ensure_bank(bank)

        async def _batch():
            sem = asyncio.Semaphore(concurrency)
            seeded_ids = []

            async def _seed_one(d):
                doc_id = d["doc_id"]
                content = d["content"]
                metadata = d.get("metadata", {})
                meta = {str(k): str(v) for k, v in (metadata or {}).items()}
                meta["doc_id"] = doc_id

                async with sem:
                    try:
                        await self.client.aretain(
                            bank_id=bank,
                            content=content,
                            document_id=doc_id,
                            metadata=meta,
                            retain_async=False,
                        )
                        seeded_ids.append(doc_id)
                    except Exception as e:
                        logger.warning(f"Error seeding doc '{doc_id}': {e}")

            await asyncio.gather(*(_seed_one(d) for d in docs))
            return seeded_ids

        return _bg_loop.run(_batch())

    async def _aget_document(self, bank: str, doc_id: str) -> Optional[dict]:
        try:
            doc = await self.client.documents.get_document(bank_id=bank, document_id=doc_id)
            return {
                "doc_id": doc.id,
                "content": getattr(doc, "original_text", "") or "",
                "metadata": getattr(doc, "document_metadata", {}) or {},
                "created_at": getattr(doc, "created_at", None),
                "updated_at": getattr(doc, "updated_at", None),
            }
        except NotFoundException:
            return None
        except Exception as e:
            if "404" in str(e) or "not found" in str(e).lower():
                return None
            raise

    def get_document(self, bank: str, doc_id: str) -> Optional[dict]:
        """Fetch document by doc_id from bank. Returns None if not found."""
        return _bg_loop.run(self._aget_document(bank, doc_id))

    def retrieve(self, bank: str, query: str, top_k: int = 3) -> list[dict]:
        """
        Recall relevant documents/facts from bank for query.
        Returns a list of dicts: [{"doc_id": str, "content": str, "score": float}].
        """
        async def _retrieve():
            try:
                recalled = await self.client.arecall(
                    bank_id=bank,
                    query=query,
                    types=["world"],
                    include_chunks=True,
                )
            except Exception as e:
                if "404" in str(e) or "not found" in str(e).lower():
                    return []
                raise

            doc_results: dict[str, dict] = {}
            for r in recalled.results:
                d_id = r.document_id
                if not d_id:
                    continue

                chunk = recalled.chunks.get(r.chunk_id) if recalled.chunks and r.chunk_id else None
                content = (chunk.text if chunk and getattr(chunk, "text", None) else None) or r.text
                score = float(r.scores.final) if (r.scores and getattr(r.scores, "final", None) is not None) else 1.0

                if d_id not in doc_results or score > doc_results[d_id]["score"]:
                    doc_results[d_id] = {
                        "doc_id": d_id,
                        "content": content,
                        "score": score,
                    }

            # Fallback if world facts didn't yield results
            if not doc_results:
                try:
                    recalled_all = await self.client.arecall(
                        bank_id=bank,
                        query=query,
                        include_chunks=True,
                    )
                    for r in recalled_all.results:
                        d_id = r.document_id
                        if not d_id and r.chunk_id and recalled_all.chunks:
                            c = recalled_all.chunks.get(r.chunk_id)
                            if c and hasattr(c, "document_id"):
                                d_id = c.document_id

                        if not d_id:
                            continue

                        chunk = recalled_all.chunks.get(r.chunk_id) if recalled_all.chunks and r.chunk_id else None
                        content = (chunk.text if chunk and getattr(chunk, "text", None) else None) or r.text
                        score = float(r.scores.final) if (r.scores and getattr(r.scores, "final", None) is not None) else 1.0

                        if d_id not in doc_results or score > doc_results[d_id]["score"]:
                            doc_results[d_id] = {
                                "doc_id": d_id,
                                "content": content,
                                "score": score,
                            }
                except Exception:
                    pass

            sorted_docs = sorted(doc_results.values(), key=lambda x: x["score"], reverse=True)
            return sorted_docs[:top_k]

        return _bg_loop.run(_retrieve())
