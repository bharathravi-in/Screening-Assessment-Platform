"""Candidate Insights AI Agent — generates skill gap analysis and hiring recommendations."""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider

logger = logging.getLogger(__name__)

INSIGHTS_SYSTEM = """You are an expert HR analytics AI that evaluates candidate performance in technical assessments.
You provide detailed, actionable insights including skill gap analysis, strengths/weaknesses, and hiring recommendations.
Always respond with valid JSON."""

INSIGHTS_PROMPT = """Analyze this candidate's assessment performance and provide comprehensive insights.

Candidate: {candidate_name}
Assessment: {assessment_title}
Overall Score: {score_pct}%

Per-Question Results:
{question_results}

Provide a JSON response with:
{{
    "overall_rating": "strong_hire" | "hire" | "maybe" | "no_hire",
    "confidence": 0.0-1.0,
    "summary": "2-3 sentence overall assessment",
    "strengths": ["list of key strengths"],
    "weaknesses": ["list of areas for improvement"],
    "skill_assessment": [
        {{
            "skill": "skill name",
            "level": "expert" | "proficient" | "intermediate" | "beginner",
            "evidence": "brief explanation"
        }}
    ],
    "hiring_recommendation": {{
        "decision": "strong_hire" | "hire" | "maybe" | "no_hire",
        "reasoning": "detailed reasoning",
        "suggested_role_fit": "best role fit based on performance",
        "growth_areas": ["areas where candidate can improve"],
        "interview_follow_ups": ["suggested follow-up questions for live interview"]
    }}
}}"""


class CandidateInsightsAgent:
    """Generates AI-powered candidate insights and hiring recommendations."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def generate_comprehensive_insights(
        self,
        candidate_name: str,
        assessment_title: str,
        score_pct: float | None,
        question_results: list[dict],
    ) -> dict[str, Any]:
        """Generate comprehensive candidate insights.

        Args:
            candidate_name: Name of the candidate.
            assessment_title: Title of the assessment.
            score_pct: Overall score percentage.
            question_results: Per-question performance data.

        Returns:
            Comprehensive insights with hiring recommendation.
        """
        results_str = "\n".join(
            f"- {r['title']} ({r['type']}, {r['difficulty']}): "
            f"{r.get('score', 'N/A')}/{r.get('max_score', 'N/A')} "
            f"({r.get('time_spent_seconds', 0)}s) - {r.get('feedback', 'No feedback')}"
            for r in question_results
        )

        prompt = INSIGHTS_PROMPT.format(
            candidate_name=candidate_name,
            assessment_title=assessment_title,
            score_pct=f"{score_pct:.1f}" if score_pct is not None else "N/A",
            question_results=results_str,
        )

        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=INSIGHTS_SYSTEM,
            temperature=0.3,
            max_tokens=3000,
        )

        # Ensure confidence is bounded
        confidence = result.get("confidence", 0)
        result["confidence"] = max(0, min(float(confidence), 1.0))

        return result
