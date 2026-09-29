"""
FitMemory Recommendation Module
Re-exports the recommendation service logic.
"""
from services.recommend import (
    recommend,
    build_image_url,
    compute_attributes_used,
    ensure_two_sentences,
    get_rule_based_fallback,
    validate_outfit,
)

__all__ = [
    "recommend",
    "build_image_url",
    "compute_attributes_used",
    "ensure_two_sentences",
    "get_rule_based_fallback",
    "validate_outfit",
]
