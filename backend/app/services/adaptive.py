"""Adaptive Testing Engine.

Adjusts question difficulty based on candidate performance during the test.
Uses Item Response Theory (IRT) simplified model:
  - Track running accuracy
  - Select next question difficulty based on performance band
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

# Difficulty ordering
DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "expert"]
DIFFICULTY_INDEX = {d: i for i, d in enumerate(DIFFICULTY_ORDER)}


@dataclass
class PerformanceTracker:
    """Tracks running performance during an adaptive session."""
    total_answered: int = 0
    total_correct: int = 0
    current_difficulty_index: int = 1  # Start at intermediate
    difficulty_history: list[str] = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        if self.total_answered == 0:
            return 0.5
        return self.total_correct / self.total_answered

    @property
    def current_difficulty(self) -> str:
        return DIFFICULTY_ORDER[self.current_difficulty_index]

    def record_answer(self, is_correct: bool) -> None:
        self.total_answered += 1
        if is_correct:
            self.total_correct += 1
        self._adjust_difficulty()

    def _adjust_difficulty(self) -> None:
        """Adjust difficulty based on rolling accuracy."""
        acc = self.accuracy

        if acc >= 0.8 and self.current_difficulty_index < len(DIFFICULTY_ORDER) - 1:
            # Performing well — increase difficulty
            self.current_difficulty_index += 1
        elif acc < 0.4 and self.current_difficulty_index > 0:
            # Struggling — decrease difficulty
            self.current_difficulty_index -= 1

        self.difficulty_history.append(self.current_difficulty)


def select_next_question(
    tracker: PerformanceTracker,
    available_questions: list[dict],
    answered_question_ids: set[str],
) -> dict | None:
    """Select the next question based on adaptive difficulty.

    Args:
        tracker: Current performance tracker state
        available_questions: List of question dicts with 'id' and 'difficulty' keys
        answered_question_ids: Set of already-answered question IDs

    Returns:
        Selected question dict, or None if no questions remain.
    """
    unanswered = [
        q for q in available_questions
        if q["id"] not in answered_question_ids
    ]

    if not unanswered:
        return None

    target_difficulty = tracker.current_difficulty

    # Try to find questions at the target difficulty
    matching = [
        q for q in unanswered
        if _normalize_difficulty(q.get("difficulty", "")) == target_difficulty
    ]

    if matching:
        return random.choice(matching)

    # Fallback: find closest difficulty
    target_idx = tracker.current_difficulty_index

    # Search adjacent difficulties (closer first)
    for offset in range(1, len(DIFFICULTY_ORDER)):
        for direction in [1, -1]:
            check_idx = target_idx + (offset * direction)
            if 0 <= check_idx < len(DIFFICULTY_ORDER):
                check_diff = DIFFICULTY_ORDER[check_idx]
                matching = [
                    q for q in unanswered
                    if _normalize_difficulty(q.get("difficulty", "")) == check_diff
                ]
                if matching:
                    return random.choice(matching)

    # Last resort: any unanswered question
    return random.choice(unanswered)


def _normalize_difficulty(diff: str) -> str:
    """Normalize difficulty value to lowercase string."""
    d = diff.lower().strip() if isinstance(diff, str) else str(diff).lower().strip()
    return d if d in DIFFICULTY_INDEX else "intermediate"
