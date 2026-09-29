import logging
from typing import Optional
from config import settings
from .client import MemoryClient
from .pdf_processor import get_or_create_pdf_chunks

logger = logging.getLogger(__name__)

FASHION_KB_DOCUMENTS = {
    "kb_color_theory": (
        "60-30-10 rule: 60% dominant neutral base, 30% secondary color, 10% accent. "
        "Complementary colors sit opposite on the wheel and create high contrast. "
        "Analogous colors create harmony. Neutrals: black, white, beige, grey, navy, indigo."
    ),
    "kb_japanese_pairings": (
        "Traditional Japanese pairings: indigo (藍 ai) x white, clean everyday minimalism. "
        "Charcoal x crimson, accent discipline. Matcha x cream, soft and natural. "
        "Pair one strong color with one muted color, never two loud colors."
    ),
    "kb_proportion": (
        "Balance silhouettes: oversized top needs fitted or straight bottom; "
        "wide-leg bottom needs fitted or cropped top. "
        "Never oversized on both halves unless deliberately streetwear."
    ),
    "kb_texture": (
        "Texture mixing adds depth without color risk: cotton x denim, knit x leather, "
        "linen x wool. One smooth + one rough texture minimum."
    ),
    "kb_formality": (
        "Formality scale 1-5: 1 gym/street, 3 smart casual, 5 formal. "
        "Keep all items within 1 point of each other."
    ),
    "kb_trend_monochrome_layering": (
        "2026 trend: monochrome layering, same color family in 2-3 shades, "
        "broken by one accent accessory."
    ),
}


def seed_fashion_kb(client: Optional[MemoryClient] = None, bank_id: Optional[str] = None) -> bool:
    """
    Seed the 'fashion_kb' bank automatically on startup:
    1. Base 6 hardcoded documents (kb_color_theory, etc.).
    2. Extracted and chunked PDF documents.
    Seeding is fully idempotent (checks doc_id, skips already seeded documents).
    Logs which chunks were seeded on startup.
    """
    bank = bank_id or settings.fashion_kb_bank_id
    mem_client = client or MemoryClient()
    mem_client.ensure_bank(bank)

    # 1. Fetch existing document IDs to ensure per-document idempotency
    existing_docs = set(mem_client.list_documents(bank, limit=1000))
    logger.info(f"Memory bank '{bank}' currently has {len(existing_docs)} documents.")

    # 2. Seed original 6 hardcoded documents
    for doc_id, content in FASHION_KB_DOCUMENTS.items():
        if doc_id not in existing_docs:
            mem_client.seed_document(
                bank=bank,
                doc_id=doc_id,
                content=content,
                metadata={"doc_id": doc_id, "type": "knowledge_base"},
                overwrite=False,
            )
            logger.info(f"Seeded base KB document: {doc_id}")
            existing_docs.add(doc_id)

    # 3. Seed PDF chunks
    pdf_chunks = get_or_create_pdf_chunks()
    to_seed = [c for c in pdf_chunks if c["doc_id"] not in existing_docs]

    if not to_seed:
        logger.info(f"All {len(pdf_chunks)} PDF chunks already exist in '{bank}'. Skipping.")
        return True

    logger.info(f"Seeding {len(to_seed)} PDF chunks into '{bank}'...")
    seeded_ids = mem_client.seed_documents_batch(bank, to_seed, concurrency=8)
    for sid in seeded_ids:
        logger.info(f"Seeded PDF chunk: {sid}")

    logger.info(f"Finished seeding '{bank}'. Successfully seeded {len(seeded_ids)} new PDF chunks.")
    return True
