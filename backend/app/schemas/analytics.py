"""Analytics schemas."""

from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_assessments: int
    active_assessments: int
    total_invitations: int
    total_sessions: int
    completed_sessions: int
    completion_rate: float
    avg_score_pct: float | None
    pass_rate: float | None


class ScoreBucket(BaseModel):
    range: str
    count: int


class StatusCount(BaseModel):
    status: str
    count: int


class AssessmentStat(BaseModel):
    assessment_id: str
    title: str
    sessions: int
    avg_score: float | None
    pass_rate: float | None
    completions: int


class DifficultyPerformance(BaseModel):
    difficulty: str
    avg_score_pct: float | None
    count: int


class TypePerformance(BaseModel):
    question_type: str
    avg_score_pct: float | None
    count: int


class DailyCount(BaseModel):
    date: str
    count: int


class AnalyticsOverview(BaseModel):
    overview: OverviewStats
    score_distribution: list[ScoreBucket]
    session_statuses: list[StatusCount]
    invitation_statuses: list[StatusCount]
    top_assessments: list[AssessmentStat]
    difficulty_performance: list[DifficultyPerformance]
    type_performance: list[TypePerformance]
    daily_sessions: list[DailyCount]
