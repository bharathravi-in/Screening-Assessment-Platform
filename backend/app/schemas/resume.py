"""Schemas for resume upload and AI parsing."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ResumeUploadResponse(BaseModel):
    id: str
    candidate_email: str
    candidate_name: str | None = None
    file_type: str
    status: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ParsedResumeData(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    summary: str | None = None
    experience_years: int | None = None
    education: list[dict[str, Any]] = []
    work_experience: list[dict[str, Any]] = []
    skills: list[str] = []
    certifications: list[str] = []
    languages: list[str] = []


class MatchedSkill(BaseModel):
    extracted_skill: str
    taxonomy_technology: str
    taxonomy_skill: str
    confidence: float


class ResumeDetailResponse(BaseModel):
    id: str
    organization_id: str | None = None
    candidate_email: str
    candidate_name: str | None = None
    file_type: str
    status: str
    parsed_data: dict[str, Any] | None = None
    matched_skills: dict[str, Any] | None = None
    error_message: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ResumeListResponse(BaseModel):
    resumes: list[ResumeUploadResponse]
    total: int


class AIQuestionGenerateRequest(BaseModel):
    skills: list[str] = Field(..., description="Skills to generate questions for")
    difficulty: str = Field("intermediate", description="Difficulty level")
    question_type: str = Field("mcq", description="Question type")
    count: int = Field(1, ge=1, le=10, description="Number of questions to generate")


class AIQuestionGenerateResponse(BaseModel):
    questions: list[dict[str, Any]]
    count: int


class AIAssessmentBuildRequest(BaseModel):
    job_description: str = Field(..., description="Job description text")
    question_count: int = Field(20, ge=5, le=50, description="Target question count")
    time_limit: int = Field(60, ge=15, le=240, description="Time limit in minutes")
    difficulty_mix: dict[str, int] | None = Field(
        None,
        description="Difficulty distribution, e.g. {\"beginner\": 20, \"intermediate\": 40, \"advanced\": 30, \"expert\": 10}",
    )


class AIAssessmentBuildResponse(BaseModel):
    blueprint: dict[str, Any]
    jd_analysis: dict[str, Any]
    generated_questions: list[dict[str, Any]]


class AIEvaluateSessionRequest(BaseModel):
    session_id: str


class AIEvaluateSessionResponse(BaseModel):
    session_summary: dict[str, Any]
    ai_evaluations: dict[str, Any]
    proctoring_report: dict[str, Any]
    total_score: float
    total_max_score: float
    score_pct: float | None = None
