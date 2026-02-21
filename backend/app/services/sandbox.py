"""Sandboxed code execution service using Docker containers.

Executes untrusted code in isolated Docker containers with resource limits:
- No network access (--network=none)
- Memory capped (--memory)
- CPU limited (--cpus)
- Process count limited (--pids-limit)
- Read-only root filesystem
- Non-root user inside container
"""

import asyncio
import logging
import os
import tempfile
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Map language to Docker image name and file extension
LANGUAGE_CONFIG: dict[str, dict] = {
    "python": {
        "image": "sandbox-python",
        "filename": "solution.py",
        "cmd": ["python3", "solution.py"],
    },
    "javascript": {
        "image": "sandbox-javascript",
        "filename": "solution.js",
        "cmd": ["node", "solution.js"],
    },
    "java": {
        "image": "sandbox-java",
        "filename": "Solution.java",
        "cmd": ["sh", "-c", "javac Solution.java && java Solution"],
    },
}


@dataclass
class ExecutionResult:
    stdout: str = ""
    stderr: str = ""
    exit_code: int = -1
    timed_out: bool = False
    execution_time_ms: int = 0
    error: str | None = None


@dataclass
class TestCaseResult:
    test_case_id: str | None = None
    input: str = ""
    expected_output: str = ""
    actual_output: str = ""
    passed: bool = False
    execution_time_ms: int = 0
    error: str | None = None


class SandboxExecutor:
    """Execute code in sandboxed Docker containers."""

    async def execute(
        self,
        code: str,
        language: str,
        stdin: str = "",
        timeout_ms: int = 5000,
        memory_limit_mb: int = 256,
    ) -> ExecutionResult:
        """Execute code in a sandboxed container.

        Args:
            code: Source code to execute.
            language: Programming language (python, javascript, java).
            stdin: Standard input to feed to the program.
            timeout_ms: Maximum execution time in milliseconds.
            memory_limit_mb: Maximum memory in megabytes.

        Returns:
            ExecutionResult with stdout, stderr, exit code, and timing info.
        """
        lang_config = LANGUAGE_CONFIG.get(language)
        if not lang_config:
            return ExecutionResult(
                error=f"Unsupported language: {language}. Supported: {list(LANGUAGE_CONFIG.keys())}"
            )

        tmpdir = tempfile.mkdtemp(prefix="sandbox_")
        code_file = os.path.join(tmpdir, lang_config["filename"])

        try:
            with open(code_file, "w") as f:
                f.write(code)

            timeout_seconds = max(1, timeout_ms // 1000)
            cmd = [
                "docker", "run", "--rm",
                "--network=none",
                f"--memory={memory_limit_mb}m",
                "--cpus=0.5",
                "--pids-limit=50",
                "--read-only",
                "--tmpfs", "/tmp:size=10m",
                "-v", f"{tmpdir}:/code:ro",
                "-w", "/code",
            ]

            # Add stdin via pipe
            image = lang_config["image"]
            run_cmd = lang_config["cmd"]
            cmd.extend([image] + run_cmd)

            start_time = time.monotonic()

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(input=stdin.encode() if stdin else None),
                    timeout=timeout_seconds + 2,  # small buffer beyond container timeout
                )
                elapsed_ms = int((time.monotonic() - start_time) * 1000)

                return ExecutionResult(
                    stdout=stdout_bytes.decode("utf-8", errors="replace").strip(),
                    stderr=stderr_bytes.decode("utf-8", errors="replace").strip(),
                    exit_code=proc.returncode or 0,
                    timed_out=False,
                    execution_time_ms=elapsed_ms,
                )

            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                elapsed_ms = int((time.monotonic() - start_time) * 1000)
                return ExecutionResult(
                    stderr="Execution timed out",
                    exit_code=-1,
                    timed_out=True,
                    execution_time_ms=elapsed_ms,
                )

        except FileNotFoundError:
            return ExecutionResult(
                error="Docker is not installed or not available on this system",
            )
        except Exception as e:
            logger.exception("Sandbox execution error")
            return ExecutionResult(error=str(e))
        finally:
            # Clean up temp directory
            try:
                for f in os.listdir(tmpdir):
                    os.remove(os.path.join(tmpdir, f))
                os.rmdir(tmpdir)
            except OSError:
                pass

    async def run_test_cases(
        self,
        code: str,
        language: str,
        test_cases: list[dict],
        timeout_ms: int = 5000,
        memory_limit_mb: int = 256,
    ) -> list[TestCaseResult]:
        """Run code against a list of test cases.

        Args:
            code: Source code to execute.
            language: Programming language.
            test_cases: List of dicts with keys: id, input, expected_output.
            timeout_ms: Per-test-case timeout in milliseconds.
            memory_limit_mb: Memory limit per execution.

        Returns:
            List of TestCaseResult with pass/fail for each test case.
        """
        results: list[TestCaseResult] = []

        for tc in test_cases:
            tc_input = tc.get("input", "")
            tc_expected = tc.get("expected_output", "").strip()
            tc_id = tc.get("id")

            exec_result = await self.execute(
                code=code,
                language=language,
                stdin=tc_input,
                timeout_ms=timeout_ms,
                memory_limit_mb=memory_limit_mb,
            )

            actual_output = exec_result.stdout.strip()
            passed = actual_output == tc_expected and exec_result.exit_code == 0 and not exec_result.timed_out

            error = None
            if exec_result.error:
                error = exec_result.error
            elif exec_result.timed_out:
                error = "Time limit exceeded"
            elif exec_result.exit_code != 0:
                error = exec_result.stderr or f"Exit code: {exec_result.exit_code}"

            results.append(
                TestCaseResult(
                    test_case_id=tc_id,
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output=actual_output,
                    passed=passed,
                    execution_time_ms=exec_result.execution_time_ms,
                    error=error,
                )
            )

        return results


# Module-level singleton
sandbox_executor = SandboxExecutor()
