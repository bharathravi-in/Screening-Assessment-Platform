"""Sandbox code execution API router.

Provides endpoints for executing code in sandboxed Docker containers.
Used by both authenticated users (HR testing questions) and candidates (running code during tests).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_candidate_session, get_current_user
from app.db.session import get_db
from app.models.candidate import CandidateSession
from app.models.user import User
from app.schemas.sandbox import (
    ExecutionRequest,
    ExecutionResponse,
    RunTestCasesRequest,
    RunTestCasesResponse,
    TestCaseResultResponse,
)
from app.services.sandbox import sandbox_executor

router = APIRouter(prefix="/sandbox", tags=["sandbox"])


# ---------------------------------------------------------------------------
# POST /sandbox/execute  — Authenticated users (admin/hr)
# ---------------------------------------------------------------------------

@router.post("/execute", response_model=ExecutionResponse)
async def execute_code(
    body: ExecutionRequest,
    current_user: User = Depends(get_current_user),
):
    """Execute code in a sandboxed container (for HR/admin testing)."""
    result = await sandbox_executor.execute(
        code=body.code,
        language=body.language,
        stdin=body.stdin,
        timeout_ms=body.timeout_ms,
        memory_limit_mb=body.memory_limit_mb,
    )

    if result.error:
        return ExecutionResponse(
            error=result.error,
            exit_code=result.exit_code,
            execution_time_ms=result.execution_time_ms,
        )

    return ExecutionResponse(
        stdout=result.stdout,
        stderr=result.stderr,
        exit_code=result.exit_code,
        timed_out=result.timed_out,
        execution_time_ms=result.execution_time_ms,
    )


# ---------------------------------------------------------------------------
# POST /sandbox/run-tests  — Authenticated users (admin/hr)
# ---------------------------------------------------------------------------

@router.post("/run-tests", response_model=RunTestCasesResponse)
async def run_test_cases(
    body: RunTestCasesRequest,
    current_user: User = Depends(get_current_user),
):
    """Run code against test cases (for HR/admin testing)."""
    tc_dicts = [tc.model_dump() for tc in body.test_cases]
    results = await sandbox_executor.run_test_cases(
        code=body.code,
        language=body.language,
        test_cases=tc_dicts,
        timeout_ms=body.timeout_ms,
        memory_limit_mb=body.memory_limit_mb,
    )

    response_results = [
        TestCaseResultResponse(
            test_case_id=r.test_case_id,
            input=r.input,
            expected_output=r.expected_output,
            actual_output=r.actual_output,
            passed=r.passed,
            execution_time_ms=r.execution_time_ms,
            error=r.error,
        )
        for r in results
    ]

    passed_count = sum(1 for r in results if r.passed)

    return RunTestCasesResponse(
        results=response_results,
        total=len(results),
        passed=passed_count,
        failed=len(results) - passed_count,
    )


# ---------------------------------------------------------------------------
# POST /sandbox/candidate/execute  — Candidate JWT
# ---------------------------------------------------------------------------

@router.post("/candidate/execute", response_model=ExecutionResponse)
async def candidate_execute_code(
    body: ExecutionRequest,
    session: CandidateSession = Depends(get_candidate_session),
):
    """Execute code in a sandboxed container (for candidates during test)."""
    result = await sandbox_executor.execute(
        code=body.code,
        language=body.language,
        stdin=body.stdin,
        timeout_ms=body.timeout_ms,
        memory_limit_mb=body.memory_limit_mb,
    )

    if result.error:
        return ExecutionResponse(
            error=result.error,
            exit_code=result.exit_code,
            execution_time_ms=result.execution_time_ms,
        )

    return ExecutionResponse(
        stdout=result.stdout,
        stderr=result.stderr,
        exit_code=result.exit_code,
        timed_out=result.timed_out,
        execution_time_ms=result.execution_time_ms,
    )


# ---------------------------------------------------------------------------
# POST /sandbox/candidate/run-tests  — Candidate JWT
# ---------------------------------------------------------------------------

@router.post("/candidate/run-tests", response_model=RunTestCasesResponse)
async def candidate_run_test_cases(
    body: RunTestCasesRequest,
    session: CandidateSession = Depends(get_candidate_session),
):
    """Run code against test cases (for candidates during test)."""
    tc_dicts = [tc.model_dump() for tc in body.test_cases]
    results = await sandbox_executor.run_test_cases(
        code=body.code,
        language=body.language,
        test_cases=tc_dicts,
        timeout_ms=body.timeout_ms,
        memory_limit_mb=body.memory_limit_mb,
    )

    response_results = [
        TestCaseResultResponse(
            test_case_id=r.test_case_id,
            input=r.input,
            expected_output=r.expected_output,
            actual_output=r.actual_output,
            passed=r.passed,
            execution_time_ms=r.execution_time_ms,
            error=r.error,
        )
        for r in results
    ]

    passed_count = sum(1 for r in results if r.passed)

    return RunTestCasesResponse(
        results=response_results,
        total=len(results),
        passed=passed_count,
        failed=len(results) - passed_count,
    )
