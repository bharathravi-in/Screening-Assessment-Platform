"""GCA (General Coding Assessment) Benchmark Scoring Service.

Normalizes candidate coding scores against population data
to produce percentile rankings comparable to CodeSignal's GCA.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class GCAScore:
    """GCA benchmark score result."""
    raw_score: float
    normalized_score: float  # 0-850 scale (like CodeSignal)
    percentile: float  # 0-100
    level: str  # "beginner", "intermediate", "advanced", "expert", "elite"
    description: str


# Population statistics (simulated; in production, compute from real data)
POPULATION_MEAN = 55.0  # mean score percentage
POPULATION_STD = 18.0  # standard deviation

# GCA scale: 100-850 (like CodeSignal)
GCA_MIN = 100
GCA_MAX = 850


def _percentile_from_z(z: float) -> float:
    """Convert z-score to percentile using standard normal CDF approximation."""
    # Abramowitz and Stegun approximation
    a1 = 0.254829592
    a2 = -0.284496736
    a3 = 1.421413741
    a4 = -1.453152027
    a5 = 1.061405429
    p = 0.3275911

    sign = 1 if z >= 0 else -1
    z_abs = abs(z)
    t = 1.0 / (1.0 + p * z_abs)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-z_abs * z_abs / 2)
    return round(0.5 * (1.0 + sign * y) * 100, 1)


def _level_from_percentile(percentile: float) -> tuple[str, str]:
    """Determine level and description from percentile."""
    if percentile >= 95:
        return "elite", "Exceptional performance, top 5% of candidates"
    elif percentile >= 80:
        return "expert", "Strong performance, top 20% of candidates"
    elif percentile >= 55:
        return "advanced", "Above-average performance"
    elif percentile >= 30:
        return "intermediate", "Average performance"
    else:
        return "beginner", "Below-average performance, needs improvement"


def calculate_gca_score(
    score_pct: float,
    num_questions: int = 20,
    time_efficiency: float = 1.0,
    coding_quality: float = 1.0,
) -> GCAScore:
    """Calculate a General Coding Assessment benchmark score.

    Args:
        score_pct: Raw score percentage (0–100).
        num_questions: Number of questions in the assessment.
        time_efficiency: Ratio of expected time to actual time (>1 = faster, <1 = slower).
        coding_quality: Code quality multiplier (1.0 = baseline).

    Returns:
        GCAScore with normalized score, percentile, and level.
    """
    # Adjust raw score with efficiency and quality bonuses
    adjusted_score = score_pct * (0.85 + 0.1 * min(time_efficiency, 1.5) + 0.05 * min(coding_quality, 1.5))
    adjusted_score = max(0, min(100, adjusted_score))

    # Z-score against population
    z = (adjusted_score - POPULATION_MEAN) / POPULATION_STD

    # Convert to GCA scale (100 - 850)
    normalized = GCA_MIN + (GCA_MAX - GCA_MIN) * (adjusted_score / 100)
    normalized = round(max(GCA_MIN, min(GCA_MAX, normalized)), 0)

    # Percentile
    percentile = _percentile_from_z(z)

    # Level
    level, description = _level_from_percentile(percentile)

    return GCAScore(
        raw_score=round(score_pct, 1),
        normalized_score=normalized,
        percentile=percentile,
        level=level,
        description=description,
    )


def calculate_batch_gca(
    sessions: list[dict],
) -> list[dict]:
    """Calculate GCA scores for a batch of sessions.

    Args:
        sessions: List of dicts with 'session_id', 'score_pct',
                  optional 'time_efficiency' and 'coding_quality'.

    Returns:
        List of GCA score results.
    """
    results = []
    for s in sessions:
        gca = calculate_gca_score(
            score_pct=s.get("score_pct", 0) or 0,
            time_efficiency=s.get("time_efficiency", 1.0),
            coding_quality=s.get("coding_quality", 1.0),
        )
        results.append({
            "session_id": s.get("session_id"),
            "gca_score": gca.normalized_score,
            "percentile": gca.percentile,
            "level": gca.level,
            "description": gca.description,
            "raw_score": gca.raw_score,
        })

    return results
