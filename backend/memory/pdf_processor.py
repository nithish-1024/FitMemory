import json
import logging
import os
import re
from typing import Any
from pypdf import PdfReader

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PDFS_DIR = os.path.join(DATA_DIR, "pdfs")
CHUNKS_FILE = os.path.join(DATA_DIR, "pdf_chunks.json")


def clean_text(text: str) -> str:
    """Normalize whitespace, clean typographic artifacts, and join line breaks."""
    # Remove common digital watermarks / footers
    cleaned = re.sub(r"OceanofPDF\.com", "", text, flags=re.IGNORECASE)
    # Fix hyphenation across line breaks (e.g. "connec-\ntions" -> "connections")
    cleaned = re.sub(r"(\b[a-zA-Z]+)-\s*\n\s*([a-zA-Z]+\b)", r"\1\2", cleaned)
    # Normalize unicode quotation marks and dashes to clean characters
    cleaned = (
        cleaned.replace("\u2014", " - ")
        .replace("\u2013", " - ")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    # Replace single linebreaks with space, multiple linebreaks with \n\n
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    return cleaned.strip()


def extract_and_chunk_pdf(
    pdf_path: str,
    pdf_name: str = "dress_code",
    target_min_words: int = 300,
    target_max_words: int = 600,
) -> list[dict[str, Any]]:
    """
    Extract readable text from PDF and split into logical, self-contained chunks of 300-600 words.
    Assigns:
      - doc_id: f"pdf_chunk_{pdf_name}_{chunk_index:03d}"
      - metadata: {"source": pdf_name, "chunk": chunk_index, "type": "fashion_knowledge"}
    """
    if not os.path.exists(pdf_path):
        logger.warning(f"PDF not found at {pdf_path}")
        return []

    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    logger.info(f"Extracting text from '{pdf_path}' ({total_pages} pages)...")

    # Group pages into chapters based on header detection or flow
    # Skip front matter (pages 1-7: cover, dedication, TOC) and end matter (pages 205+: acknowledgments, etc.)
    # In dress_code.pdf: page 8 (index 7) is Introduction; page 204 (index 203) is end of Epilogue.
    start_page = 7
    end_page = min(204, total_pages - 1)

    page_texts: list[str] = []
    for p in range(start_page, end_page + 1):
        raw = reader.pages[p].extract_text() or ""
        cleaned = clean_text(raw)
        if len(cleaned.split()) > 30:  # Skip blank or divider pages like "Part I"
            page_texts.append(cleaned)

    # Combine into a single text flow, splitting on double newlines or major headings
    # Each page in this book is ~350-450 words, so combining or splitting natural page boundaries
    # aligns with the 300-600 words per chunk requirement.
    chunks: list[dict[str, Any]] = []
    chunk_index = 1
    current_words: list[str] = []

    for page_str in page_texts:
        words = page_str.split()
        if not words:
            continue

        # If adding this page stays within target_max_words, accumulate
        if len(current_words) + len(words) <= target_max_words:
            current_words.extend(words)
        else:
            # If current accumulation meets minimum, flush as a chunk
            if len(current_words) >= target_min_words:
                chunk_content = " ".join(current_words)
                doc_id = f"pdf_chunk_{pdf_name}_{chunk_index:03d}"
                chunks.append({
                    "doc_id": doc_id,
                    "content": chunk_content,
                    "metadata": {
                        "source": pdf_name,
                        "chunk": chunk_index,
                        "type": "fashion_knowledge",
                    },
                    "word_count": len(current_words),
                })
                chunk_index += 1
                current_words = list(words)
            else:
                # Still smaller than target_min_words, append to avoid undersized chunk
                current_words.extend(words)

    # Flush any remaining words
    if current_words:
        chunk_content = " ".join(current_words)
        doc_id = f"pdf_chunk_{pdf_name}_{chunk_index:03d}"
        chunks.append({
            "doc_id": doc_id,
            "content": chunk_content,
            "metadata": {
                "source": pdf_name,
                "chunk": chunk_index,
                "type": "fashion_knowledge",
            },
            "word_count": len(current_words),
        })

    logger.info(f"Generated {len(chunks)} chunks from '{pdf_name}' (average words: {sum(c['word_count'] for c in chunks)//len(chunks)}).")
    return chunks


def get_or_create_pdf_chunks(force_recompute: bool = False) -> list[dict[str, Any]]:
    """
    Get cached chunks from pdf_chunks.json, or extract from data/pdfs if missing.
    """
    if not force_recompute and os.path.exists(CHUNKS_FILE):
        try:
            with open(CHUNKS_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if isinstance(cached, list) and len(cached) > 0:
                    return cached
        except Exception as e:
            logger.warning(f"Error loading cached chunks from {CHUNKS_FILE}: {e}")

    # Process PDFs in data/pdfs
    all_chunks: list[dict[str, Any]] = []
    if os.path.exists(PDFS_DIR):
        for fname in os.listdir(PDFS_DIR):
            if fname.lower().endswith(".pdf"):
                pdf_path = os.path.join(PDFS_DIR, fname)
                pdf_name = os.path.splitext(fname)[0].lower()
                # sanitize pdf_name for doc_id
                pdf_name = re.sub(r"[^a-z0-9_]", "_", pdf_name)
                chunks = extract_and_chunk_pdf(pdf_path, pdf_name=pdf_name)
                all_chunks.extend(chunks)

    if all_chunks:
        os.makedirs(os.path.dirname(CHUNKS_FILE), exist_ok=True)
        with open(CHUNKS_FILE, "w", encoding="utf-8") as f:
            json.dump(all_chunks, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved {len(all_chunks)} chunks to {CHUNKS_FILE}")

    return all_chunks
