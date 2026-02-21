"""Abstract base class for AI providers."""

from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    """Abstract AI provider interface."""

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """Generate a text completion.

        Args:
            prompt: User prompt.
            system_prompt: Optional system prompt.
            temperature: Sampling temperature.
            max_tokens: Max tokens in response.

        Returns:
            Generated text.
        """
        ...

    @abstractmethod
    async def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4000,
    ) -> dict[str, Any]:
        """Generate a structured JSON completion.

        Args:
            prompt: User prompt requesting JSON output.
            system_prompt: Optional system prompt.
            temperature: Sampling temperature (lower for structured).
            max_tokens: Max tokens in response.

        Returns:
            Parsed JSON dict.
        """
        ...
