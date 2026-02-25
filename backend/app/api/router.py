from fastapi import APIRouter

from app.api.v1 import (
    auth, users, organizations, health, taxonomy, questions, assessments,
    candidates, test_taking, sandbox, resumes, analytics, system_settings,
    code_playback, insights, templates, reports, live_interview, proctoring,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(taxonomy.router, prefix="/taxonomy", tags=["taxonomy"])
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
api_router.include_router(test_taking.router, tags=["test-taking"])
api_router.include_router(sandbox.router, tags=["sandbox"])
api_router.include_router(resumes.router, tags=["resumes"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(system_settings.router, prefix="/system-settings", tags=["system-settings"])
api_router.include_router(code_playback.router, tags=["code-playback"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(live_interview.router, prefix="/live-interview", tags=["live-interview"])
api_router.include_router(proctoring.router, prefix="/proctoring", tags=["proctoring"])
