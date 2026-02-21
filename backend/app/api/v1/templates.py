"""Assessment Templates API endpoints.

Provides role-based assessment templates and template-driven assessment creation.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.db.session import get_db
from app.models.user import User

router = APIRouter(tags=["templates"])


# ---------------------------------------------------------------------------
# Pre-built role-based templates
# ---------------------------------------------------------------------------

ROLE_TEMPLATES = [
    {
        "id": "frontend-developer",
        "name": "Frontend Developer",
        "description": "Comprehensive assessment for frontend engineering roles covering HTML, CSS, JavaScript, React, and web performance.",
        "icon": "🖥️",
        "role_category": "engineering",
        "estimated_duration_minutes": 60,
        "question_distribution": {
            "mcq": 10,
            "coding": 5,
            "debugging": 3,
            "scenario": 2,
        },
        "difficulty_mix": {
            "beginner": 15,
            "intermediate": 45,
            "advanced": 30,
            "expert": 10,
        },
        "skills": ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Web Performance", "Responsive Design", "Accessibility"],
        "sections": [
            {"title": "Core Web Technologies", "skills": ["HTML", "CSS", "JavaScript"], "question_count": 8},
            {"title": "Framework Proficiency", "skills": ["React", "TypeScript"], "question_count": 7},
            {"title": "Best Practices", "skills": ["Web Performance", "Responsive Design", "Accessibility"], "question_count": 5},
        ],
    },
    {
        "id": "backend-developer",
        "name": "Backend Developer",
        "description": "Assessment for backend engineering covering APIs, databases, system design, and server-side programming.",
        "icon": "⚙️",
        "role_category": "engineering",
        "estimated_duration_minutes": 75,
        "question_distribution": {
            "mcq": 8,
            "coding": 6,
            "system_design": 3,
            "debugging": 3,
        },
        "difficulty_mix": {
            "beginner": 10,
            "intermediate": 40,
            "advanced": 35,
            "expert": 15,
        },
        "skills": ["Python", "Java", "SQL", "REST APIs", "Database Design", "System Design", "Docker", "Security"],
        "sections": [
            {"title": "Programming Fundamentals", "skills": ["Python", "Java"], "question_count": 6},
            {"title": "Data & APIs", "skills": ["SQL", "REST APIs", "Database Design"], "question_count": 7},
            {"title": "Architecture & Infrastructure", "skills": ["System Design", "Docker", "Security"], "question_count": 7},
        ],
    },
    {
        "id": "fullstack-developer",
        "name": "Full-Stack Developer",
        "description": "End-to-end assessment covering both frontend and backend technologies with system design questions.",
        "icon": "🔄",
        "role_category": "engineering",
        "estimated_duration_minutes": 90,
        "question_distribution": {
            "mcq": 12,
            "coding": 8,
            "system_design": 2,
            "debugging": 3,
        },
        "difficulty_mix": {
            "beginner": 12,
            "intermediate": 40,
            "advanced": 35,
            "expert": 13,
        },
        "skills": ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL", "REST APIs", "System Design"],
        "sections": [
            {"title": "Frontend", "skills": ["JavaScript", "TypeScript", "React"], "question_count": 8},
            {"title": "Backend", "skills": ["Node.js", "Python", "SQL", "REST APIs"], "question_count": 9},
            {"title": "System Design", "skills": ["System Design"], "question_count": 3},
        ],
    },
    {
        "id": "data-engineer",
        "name": "Data Engineer",
        "description": "Assessment for data engineering roles covering ETL pipelines, data warehousing, SQL, and big data tools.",
        "icon": "📊",
        "role_category": "data",
        "estimated_duration_minutes": 60,
        "question_distribution": {
            "mcq": 10,
            "coding": 5,
            "scenario": 3,
            "short_answer": 2,
        },
        "difficulty_mix": {
            "beginner": 10,
            "intermediate": 35,
            "advanced": 40,
            "expert": 15,
        },
        "skills": ["SQL", "Python", "ETL", "Data Warehousing", "Apache Spark", "Airflow", "Data Modeling"],
        "sections": [
            {"title": "SQL & Data Modeling", "skills": ["SQL", "Data Modeling", "Data Warehousing"], "question_count": 8},
            {"title": "Programming & ETL", "skills": ["Python", "ETL", "Airflow"], "question_count": 7},
            {"title": "Big Data", "skills": ["Apache Spark"], "question_count": 5},
        ],
    },
    {
        "id": "devops-engineer",
        "name": "DevOps Engineer",
        "description": "Assessment covering CI/CD, cloud infrastructure, containerization, monitoring, and IaC.",
        "icon": "🚀",
        "role_category": "infrastructure",
        "estimated_duration_minutes": 60,
        "question_distribution": {
            "mcq": 10,
            "scenario": 5,
            "short_answer": 3,
            "debugging": 2,
        },
        "difficulty_mix": {
            "beginner": 10,
            "intermediate": 35,
            "advanced": 40,
            "expert": 15,
        },
        "skills": ["Docker", "Kubernetes", "CI/CD", "AWS", "Terraform", "Linux", "Monitoring", "Security"],
        "sections": [
            {"title": "Containers & Orchestration", "skills": ["Docker", "Kubernetes"], "question_count": 7},
            {"title": "CI/CD & IaC", "skills": ["CI/CD", "Terraform"], "question_count": 6},
            {"title": "Cloud & Operations", "skills": ["AWS", "Linux", "Monitoring", "Security"], "question_count": 7},
        ],
    },
    {
        "id": "ai-ml-engineer",
        "name": "AI/ML Engineer",
        "description": "Assessment for AI and machine learning roles covering algorithms, deep learning, NLP, and MLOps.",
        "icon": "🧠",
        "role_category": "data",
        "estimated_duration_minutes": 75,
        "question_distribution": {
            "mcq": 10,
            "coding": 6,
            "scenario": 2,
            "short_answer": 2,
        },
        "difficulty_mix": {
            "beginner": 8,
            "intermediate": 32,
            "advanced": 40,
            "expert": 20,
        },
        "skills": ["Python", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "MLOps", "Statistics"],
        "sections": [
            {"title": "ML Foundations", "skills": ["Machine Learning", "Statistics"], "question_count": 7},
            {"title": "Deep Learning & NLP", "skills": ["Deep Learning", "NLP", "Computer Vision"], "question_count": 7},
            {"title": "Applied ML", "skills": ["Python", "MLOps"], "question_count": 6},
        ],
    },
    {
        "id": "qa-engineer",
        "name": "QA / Test Engineer",
        "description": "Assessment for quality assurance covering test strategies, automation frameworks, and performance testing.",
        "icon": "🧪",
        "role_category": "quality",
        "estimated_duration_minutes": 45,
        "question_distribution": {
            "mcq": 10,
            "coding": 3,
            "scenario": 5,
            "debugging": 2,
        },
        "difficulty_mix": {
            "beginner": 15,
            "intermediate": 45,
            "advanced": 30,
            "expert": 10,
        },
        "skills": ["Test Strategy", "Selenium", "API Testing", "Performance Testing", "Test Automation", "CI/CD"],
        "sections": [
            {"title": "Test Fundamentals", "skills": ["Test Strategy"], "question_count": 7},
            {"title": "Automation", "skills": ["Selenium", "API Testing", "Test Automation"], "question_count": 8},
            {"title": "Performance & CI", "skills": ["Performance Testing", "CI/CD"], "question_count": 5},
        ],
    },
    {
        "id": "cybersecurity-analyst",
        "name": "Cybersecurity Analyst",
        "description": "Assessment for security roles covering network security, cryptography, threat analysis, and compliance.",
        "icon": "🔐",
        "role_category": "security",
        "estimated_duration_minutes": 60,
        "question_distribution": {
            "mcq": 12,
            "scenario": 5,
            "short_answer": 3,
        },
        "difficulty_mix": {
            "beginner": 10,
            "intermediate": 35,
            "advanced": 40,
            "expert": 15,
        },
        "skills": ["Network Security", "Cryptography", "Threat Analysis", "OWASP", "Penetration Testing", "Compliance"],
        "sections": [
            {"title": "Security Fundamentals", "skills": ["Network Security", "Cryptography"], "question_count": 7},
            {"title": "Offensive Security", "skills": ["Penetration Testing", "OWASP"], "question_count": 7},
            {"title": "Governance & Compliance", "skills": ["Threat Analysis", "Compliance"], "question_count": 6},
        ],
    },
]


# ---------------------------------------------------------------------------
# GET /templates
# ---------------------------------------------------------------------------

@router.get("/")
async def list_templates(
    role_category: str | None = None,
    user: User = Depends(require_roles("admin", "hr", "tech")),
):
    """List all available assessment templates, optionally filtered by role category."""
    templates = ROLE_TEMPLATES
    if role_category:
        templates = [t for t in templates if t["role_category"] == role_category]

    return {
        "templates": templates,
        "total": len(templates),
        "categories": sorted(set(t["role_category"] for t in ROLE_TEMPLATES)),
    }


# ---------------------------------------------------------------------------
# GET /templates/{template_id}
# ---------------------------------------------------------------------------

@router.get("/{template_id}")
async def get_template(
    template_id: str,
    user: User = Depends(require_roles("admin", "hr", "tech")),
):
    """Get template details by ID."""
    template = next((t for t in ROLE_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


# ---------------------------------------------------------------------------
# POST /templates/generate-assessment
# ---------------------------------------------------------------------------

class GenerateFromTemplateRequest(BaseModel):
    template_id: str
    title: str | None = None
    time_limit_minutes: int | None = None
    question_count: int | None = None


@router.post("/generate-assessment")
async def generate_assessment_from_template(
    body: GenerateFromTemplateRequest,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Generate an assessment blueprint from a role-based template.

    Uses the template's skill definitions and question distribution to
    auto-generate a complete assessment via the AI assessment builder.
    """
    template = next((t for t in ROLE_TEMPLATES if t["id"] == body.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    from app.ai.agents.assessment_builder import AssessmentBuilderAgent
    from app.ai.agents.question_generator import QuestionGeneratorAgent

    # Generate questions using the template configuration
    qg = QuestionGeneratorAgent()
    all_questions = []

    for section in template["sections"]:
        count = section.get("question_count", 5)
        if body.question_count:
            # Proportional scaling
            total_template_q = sum(s.get("question_count", 5) for s in template["sections"])
            count = max(1, round(body.question_count * count / total_template_q))

        for q_type, q_count in template["question_distribution"].items():
            section_q_count = max(1, round(count * q_count / sum(template["question_distribution"].values())))
            for difficulty, pct in template["difficulty_mix"].items():
                diff_count = max(1, round(section_q_count * pct / 100))
                try:
                    questions = await qg.generate(
                        skills=section["skills"],
                        difficulty=difficulty,
                        question_type=q_type,
                        count=diff_count,
                    )
                    all_questions.extend(questions)
                except Exception:
                    pass  # Continue on generation failures

    return {
        "template": template,
        "assessment_blueprint": {
            "title": body.title or f"{template['name']} Assessment",
            "time_limit_minutes": body.time_limit_minutes or template["estimated_duration_minutes"],
            "sections": template["sections"],
            "difficulty_mix": template["difficulty_mix"],
        },
        "generated_questions": all_questions[:body.question_count or 20],
        "total_generated": len(all_questions),
    }
