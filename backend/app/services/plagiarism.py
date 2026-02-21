"""Plagiarism Detection Service.

Compares code submissions between candidates using:
1. Token-based similarity (structural comparison via tokenization)
2. Normalized string similarity (whitespace/comment-stripped comparison)
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


@dataclass
class SimilarityResult:
    """Result of comparing two code submissions."""
    session_a_id: str
    session_b_id: str
    question_id: str
    token_similarity: float  # 0.0 - 1.0
    normalized_similarity: float  # 0.0 - 1.0
    combined_score: float  # Weighted average
    is_suspicious: bool


# ---------------------------------------------------------------------------
# Text normalization
# ---------------------------------------------------------------------------

def _strip_comments(code: str, language: str) -> str:
    """Remove comments from code based on language."""
    if language in ("python", "py"):
        # Remove # comments and triple-quoted strings
        code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)
        code = re.sub(r'"""[\s\S]*?"""', '', code)
        code = re.sub(r"'''[\s\S]*?'''", '', code)
    elif language in ("javascript", "js", "typescript", "ts", "java", "c", "cpp", "c++", "csharp", "cs"):
        code = re.sub(r'//.*$', '', code, flags=re.MULTILINE)
        code = re.sub(r'/\*[\s\S]*?\*/', '', code)

    return code


def _normalize_code(code: str, language: str) -> str:
    """Normalize code by stripping comments, whitespace, and variable names."""
    code = _strip_comments(code, language)

    # Remove all whitespace
    code = re.sub(r'\s+', ' ', code).strip()

    # Lowercase
    code = code.lower()

    return code


# ---------------------------------------------------------------------------
# Token-based similarity
# ---------------------------------------------------------------------------

def _tokenize(code: str) -> list[str]:
    """Break code into structural tokens."""
    # Split on non-alphanumeric characters, keeping operators
    tokens = re.findall(r'[a-zA-Z_]\w*|[0-9]+|[^\s\w]', code)
    return tokens


def _ngrams(tokens: list[str], n: int = 3) -> set[tuple[str, ...]]:
    """Generate n-grams from a list of tokens."""
    if len(tokens) < n:
        return {tuple(tokens)} if tokens else set()
    return {tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)}


def _jaccard_similarity(set_a: set, set_b: set) -> float:
    """Compute Jaccard similarity between two sets."""
    if not set_a and not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


# ---------------------------------------------------------------------------
# Normalized string similarity
# ---------------------------------------------------------------------------

def _levenshtein_ratio(s1: str, s2: str) -> float:
    """Compute the normalized Levenshtein similarity ratio.

    Uses a simplified comparison for performance:
    returns 1.0 for identical strings, 0.0 for completely different.
    """
    if s1 == s2:
        return 1.0

    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0

    # For very long strings, use hash-based comparison
    if len1 > 5000 or len2 > 5000:
        h1 = hashlib.md5(s1.encode()).hexdigest()
        h2 = hashlib.md5(s2.encode()).hexdigest()
        return 1.0 if h1 == h2 else 0.0

    # Simplified edit distance using 2-row approach
    if len1 > len2:
        s1, s2 = s2, s1
        len1, len2 = len2, len1

    current_row = list(range(len1 + 1))
    for i in range(1, len2 + 1):
        previous_row = current_row
        current_row = [i] + [0] * len1
        for j in range(1, len1 + 1):
            add = previous_row[j] + 1
            delete = current_row[j - 1] + 1
            change = previous_row[j - 1]
            if s1[j - 1] != s2[i - 1]:
                change += 1
            current_row[j] = min(add, delete, change)

    distance = current_row[len1]
    max_len = max(len1, len2)
    return 1.0 - (distance / max_len)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

SUSPICION_THRESHOLD = 0.85


def compare_submissions(
    code_a: str,
    code_b: str,
    language: str,
    session_a_id: str,
    session_b_id: str,
    question_id: str,
    threshold: float = SUSPICION_THRESHOLD,
) -> SimilarityResult:
    """Compare two code submissions for similarity.

    Args:
        code_a: First submission code
        code_b: Second submission code
        language: Programming language
        session_a_id: ID of the first session
        session_b_id: ID of the second session
        question_id: ID of the question
        threshold: Similarity threshold to flag as suspicious

    Returns:
        SimilarityResult with similarity scores and suspicion flag
    """
    # Token-based similarity
    tokens_a = _tokenize(_strip_comments(code_a, language))
    tokens_b = _tokenize(_strip_comments(code_b, language))

    ngrams_a = _ngrams(tokens_a, n=4)
    ngrams_b = _ngrams(tokens_b, n=4)

    token_sim = _jaccard_similarity(ngrams_a, ngrams_b)

    # Normalized string similarity
    norm_a = _normalize_code(code_a, language)
    norm_b = _normalize_code(code_b, language)
    norm_sim = _levenshtein_ratio(norm_a, norm_b)

    # Combined score (weighted)
    combined = 0.6 * token_sim + 0.4 * norm_sim

    return SimilarityResult(
        session_a_id=session_a_id,
        session_b_id=session_b_id,
        question_id=question_id,
        token_similarity=round(token_sim, 4),
        normalized_similarity=round(norm_sim, 4),
        combined_score=round(combined, 4),
        is_suspicious=combined >= threshold,
    )


async def check_plagiarism_for_question(
    question_id: str,
    submissions: list[dict],
    language: str,
    threshold: float = SUSPICION_THRESHOLD,
) -> list[SimilarityResult]:
    """Check all pairs of submissions for a given question.

    Args:
        question_id: The question ID
        submissions: List of dicts with 'session_id' and 'code' keys
        language: Programming language
        threshold: Suspicion threshold

    Returns:
        List of SimilarityResults for suspicious pairs
    """
    results: list[SimilarityResult] = []

    for i in range(len(submissions)):
        for j in range(i + 1, len(submissions)):
            sub_a = submissions[i]
            sub_b = submissions[j]

            result = compare_submissions(
                code_a=sub_a["code"],
                code_b=sub_b["code"],
                language=language,
                session_a_id=sub_a["session_id"],
                session_b_id=sub_b["session_id"],
                question_id=question_id,
                threshold=threshold,
            )

            if result.is_suspicious:
                results.append(result)

    return results
