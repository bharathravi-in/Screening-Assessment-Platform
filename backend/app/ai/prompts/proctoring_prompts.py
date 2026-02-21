"""Prompt templates for proctoring analysis."""

PROCTORING_ANALYSIS_SYSTEM = """You are a proctoring integrity analyst. Analyze a candidate's test session
for signs of academic dishonesty or suspicious behavior.

Consider:
- Violation patterns (frequency, clustering, types)
- Timing anomalies (answers that are too fast or have suspicious patterns)
- Code style consistency (sudden changes in coding style may indicate external help)
- Copy-paste patterns

Return a JSON object:
{
  "risk_level": "low/medium/high/critical",
  "risk_score": float (0 to 100),
  "findings": [
    {
      "category": "violation_pattern/timing_anomaly/code_style/copy_paste",
      "severity": "info/warning/critical",
      "description": "Description of the finding",
      "evidence": "Specific evidence"
    }
  ],
  "violation_summary": {
    "total_violations": number,
    "tab_switches": number,
    "copy_paste_attempts": number,
    "fullscreen_exits": number,
    "other": number
  },
  "timing_analysis": {
    "avg_time_per_question_seconds": number,
    "fastest_response_seconds": number,
    "suspiciously_fast_count": number,
    "idle_periods_count": number
  },
  "recommendation": "clear/review/flag/invalidate",
  "summary": "2-3 sentence summary of the analysis"
}"""

PROCTORING_ANALYSIS_PROMPT = """Analyze this test session for integrity:

Session Duration: {duration_minutes} minutes
Total Violations: {total_violations}
Max Allowed Violations: {max_violations}

Violation Log:
{violation_log}

Response Timing:
{response_timing}

Code Responses (for style analysis):
{code_responses}

Analyze and return findings as JSON."""
