"""Code Playback & Behavioral Analytics Service.

Analyzes code snapshots recorded during test-taking to provide:
1. Playback data for reviewing candidate coding sessions
2. Typing speed and behavioral analytics
3. Anomaly detection (paste events, idle periods, unusually fast completion)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class CodeSnapshot:
    """A single snapshot of the candidate's code at a point in time."""
    timestamp: str
    code: str
    chars_added: int = 0
    chars_deleted: int = 0
    total_chars: int = 0
    event_type: str = "edit"  # edit, paste, cut, initial


@dataclass
class BehaviorMetrics:
    """Behavioral metrics derived from code snapshots."""
    total_snapshots: int = 0
    total_time_seconds: float = 0
    active_time_seconds: float = 0
    idle_time_seconds: float = 0
    avg_typing_speed_cpm: float = 0  # chars per minute
    peak_typing_speed_cpm: float = 0
    paste_events: int = 0
    paste_char_ratio: float = 0  # ratio of pasted chars to total
    large_paste_events: int = 0  # pastes > 50 chars
    total_chars_typed: int = 0
    total_chars_pasted: int = 0
    idle_periods: list[dict] = field(default_factory=list)
    anomaly_score: float = 0  # 0-100
    anomalies: list[dict] = field(default_factory=list)


@dataclass
class PlaybackFrame:
    """A single frame in the code playback timeline."""
    index: int
    timestamp: str
    elapsed_seconds: float
    code: str
    diff_summary: str
    chars_added: int
    chars_deleted: int
    event_type: str
    typing_speed_cpm: float


# ---------------------------------------------------------------------------
# Diff computation
# ---------------------------------------------------------------------------

def _compute_diff_summary(old_code: str, new_code: str) -> str:
    """Compute a human-readable diff summary between two code strings."""
    old_lines = old_code.splitlines()
    new_lines = new_code.splitlines()

    added = 0
    removed = 0

    old_set = set(old_lines)
    new_set = set(new_lines)

    for line in new_lines:
        if line not in old_set:
            added += 1
    for line in old_lines:
        if line not in new_set:
            removed += 1

    parts = []
    if added:
        parts.append(f"+{added} lines")
    if removed:
        parts.append(f"-{removed} lines")
    return ", ".join(parts) if parts else "no change"


def _detect_paste(chars_added: int, time_delta_seconds: float) -> bool:
    """Heuristic: if a large block of code appears in < 1 second, it's likely a paste."""
    if time_delta_seconds <= 0:
        return chars_added > 20
    cpm = (chars_added / time_delta_seconds) * 60
    return cpm > 2000 and chars_added > 30  # > 2000 CPM with 30+ chars = paste


# ---------------------------------------------------------------------------
# Analysis Engine
# ---------------------------------------------------------------------------

IDLE_THRESHOLD_SECONDS = 30  # seconds without changes = idle
ANOMALY_PASTE_THRESHOLD = 50  # chars in a single paste = suspicious


def analyze_snapshots(snapshots: list[dict]) -> dict[str, Any]:
    """Analyze a list of code snapshots and return behavioral metrics + playback frames.

    Args:
        snapshots: List of dicts with keys: timestamp, code, event_type (optional)

    Returns:
        Dict with 'metrics' (BehaviorMetrics) and 'frames' (list of PlaybackFrame dicts)
    """
    if not snapshots or len(snapshots) < 2:
        return {
            "metrics": _metrics_to_dict(BehaviorMetrics(total_snapshots=len(snapshots))),
            "frames": [],
        }

    # Parse timestamps
    parsed: list[tuple[datetime, str, str]] = []
    for s in snapshots:
        ts_str = s.get("timestamp", "")
        code = s.get("code", "")
        event = s.get("event_type", "edit")
        try:
            ts = datetime.fromisoformat(ts_str)
        except (ValueError, TypeError):
            continue
        parsed.append((ts, code, event))

    parsed.sort(key=lambda x: x[0])
    if len(parsed) < 2:
        return {
            "metrics": _metrics_to_dict(BehaviorMetrics(total_snapshots=len(parsed))),
            "frames": [],
        }

    base_time = parsed[0][0]
    total_time = (parsed[-1][0] - parsed[0][0]).total_seconds()

    frames: list[dict] = []
    metrics = BehaviorMetrics(total_snapshots=len(parsed), total_time_seconds=total_time)

    prev_code = ""
    prev_ts = parsed[0][0]
    window_chars: list[tuple[float, int]] = []  # (elapsed, chars_added) for speed calculation
    last_active_time = parsed[0][0]

    for i, (ts, code, event_type) in enumerate(parsed):
        elapsed = (ts - base_time).total_seconds()
        time_delta = (ts - prev_ts).total_seconds()

        chars_added = max(0, len(code) - len(prev_code))
        chars_deleted = max(0, len(prev_code) - len(code))

        # Detect paste events
        is_paste = _detect_paste(chars_added, time_delta) or event_type == "paste"
        actual_event = "paste" if is_paste else event_type

        if is_paste:
            metrics.paste_events += 1
            metrics.total_chars_pasted += chars_added
            if chars_added > ANOMALY_PASTE_THRESHOLD:
                metrics.large_paste_events += 1
                metrics.anomalies.append({
                    "type": "large_paste",
                    "timestamp": ts.isoformat(),
                    "elapsed_seconds": round(elapsed, 1),
                    "chars_pasted": chars_added,
                    "detail": f"Pasted {chars_added} characters at once",
                })
        else:
            metrics.total_chars_typed += chars_added

        # Track idle periods
        if time_delta > IDLE_THRESHOLD_SECONDS:
            metrics.idle_time_seconds += time_delta
            metrics.idle_periods.append({
                "start_elapsed": round((prev_ts - base_time).total_seconds(), 1),
                "end_elapsed": round(elapsed, 1),
                "duration_seconds": round(time_delta, 1),
            })
            if time_delta > 120:  # > 2 minutes idle = suspicious
                metrics.anomalies.append({
                    "type": "long_idle",
                    "timestamp": ts.isoformat(),
                    "elapsed_seconds": round(elapsed, 1),
                    "duration_seconds": round(time_delta, 1),
                    "detail": f"Idle for {round(time_delta / 60, 1)} minutes",
                })
        else:
            metrics.active_time_seconds += time_delta

        # Typing speed (rolling window)
        window_chars.append((elapsed, chars_added))
        # Calculate instantaneous CPM over last 30 seconds
        recent = [(e, c) for e, c in window_chars if elapsed - e <= 30]
        window_chars = recent
        if len(recent) >= 2 and recent[-1][0] - recent[0][0] > 0:
            window_time_min = (recent[-1][0] - recent[0][0]) / 60
            window_total_chars = sum(c for _, c in recent)
            typing_speed = window_total_chars / window_time_min if window_time_min > 0 else 0
        else:
            typing_speed = 0

        if typing_speed > metrics.peak_typing_speed_cpm:
            metrics.peak_typing_speed_cpm = typing_speed

        diff_summary = _compute_diff_summary(prev_code, code)

        frames.append({
            "index": i,
            "timestamp": ts.isoformat(),
            "elapsed_seconds": round(elapsed, 1),
            "code": code,
            "diff_summary": diff_summary,
            "chars_added": chars_added,
            "chars_deleted": chars_deleted,
            "event_type": actual_event,
            "typing_speed_cpm": round(typing_speed, 1),
        })

        prev_code = code
        prev_ts = ts

    # Calculate averages
    if metrics.active_time_seconds > 0:
        metrics.avg_typing_speed_cpm = round(
            (metrics.total_chars_typed / (metrics.active_time_seconds / 60)), 1
        )

    total_input_chars = metrics.total_chars_typed + metrics.total_chars_pasted
    if total_input_chars > 0:
        metrics.paste_char_ratio = round(metrics.total_chars_pasted / total_input_chars, 3)

    # Calculate anomaly score (0-100)
    anomaly_score = 0
    if metrics.paste_char_ratio > 0.5:
        anomaly_score += 30  # >50% pasted
    if metrics.large_paste_events > 2:
        anomaly_score += 20
    if metrics.idle_time_seconds > metrics.active_time_seconds:
        anomaly_score += 15  # More idle than active
    long_idles = [a for a in metrics.anomalies if a["type"] == "long_idle"]
    if len(long_idles) > 1:
        anomaly_score += 15
    if metrics.avg_typing_speed_cpm > 1500:
        anomaly_score += 20  # Unrealistically fast typing

    metrics.anomaly_score = min(100, anomaly_score)
    metrics.peak_typing_speed_cpm = round(metrics.peak_typing_speed_cpm, 1)
    metrics.active_time_seconds = round(metrics.active_time_seconds, 1)
    metrics.idle_time_seconds = round(metrics.idle_time_seconds, 1)

    return {
        "metrics": _metrics_to_dict(metrics),
        "frames": frames,
    }


def _metrics_to_dict(m: BehaviorMetrics) -> dict[str, Any]:
    """Convert BehaviorMetrics to a JSON-serializable dict."""
    return {
        "total_snapshots": m.total_snapshots,
        "total_time_seconds": m.total_time_seconds,
        "active_time_seconds": m.active_time_seconds,
        "idle_time_seconds": m.idle_time_seconds,
        "avg_typing_speed_cpm": m.avg_typing_speed_cpm,
        "peak_typing_speed_cpm": m.peak_typing_speed_cpm,
        "paste_events": m.paste_events,
        "paste_char_ratio": m.paste_char_ratio,
        "large_paste_events": m.large_paste_events,
        "total_chars_typed": m.total_chars_typed,
        "total_chars_pasted": m.total_chars_pasted,
        "idle_periods": m.idle_periods,
        "anomaly_score": m.anomaly_score,
        "anomalies": m.anomalies,
    }
