"""Schemas for sandbox code execution."""

from pydantic import BaseModel, Field


class ExecutionRequest(BaseModel):
    """Request to execute code in the sandbox."""
    code: str = Field(..., description="Source code to execute")
    language: str = Field(..., description="Programming language (python, javascript, java)")
    stdin: str = Field("", description="Standard input")
    timeout_ms: int = Field(5000, ge=100, le=30000, description="Timeout in milliseconds")
    memory_limit_mb: int = Field(256, ge=32, le=512, description="Memory limit in MB")


class ExecutionResponse(BaseModel):
    """Result of code execution."""
    stdout: str = ""
    stderr: str = ""
    exit_code: int = -1
    timed_out: bool = False
    execution_time_ms: int = 0
    error: str | None = None


class TestCaseInput(BaseModel):
    """A single test case for code execution."""
    id: str | None = None
    input: str = ""
    expected_output: str = ""


class TestCaseResultResponse(BaseModel):
    """Result of running a single test case."""
    test_case_id: str | None = None
    input: str = ""
    expected_output: str = ""
    actual_output: str = ""
    passed: bool = False
    execution_time_ms: int = 0
    error: str | None = None


class RunTestCasesRequest(BaseModel):
    """Request to run code against test cases."""
    code: str = Field(..., description="Source code to execute")
    language: str = Field(..., description="Programming language")
    test_cases: list[TestCaseInput] = Field(..., description="Test cases to run")
    timeout_ms: int = Field(5000, ge=100, le=30000, description="Per-test-case timeout")
    memory_limit_mb: int = Field(256, ge=32, le=512, description="Memory limit in MB")


class RunTestCasesResponse(BaseModel):
    """Result of running multiple test cases."""
    results: list[TestCaseResultResponse]
    total: int = 0
    passed: int = 0
    failed: int = 0
