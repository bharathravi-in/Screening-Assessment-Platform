"""AI provider factory."""

from app.ai.providers.base import AIProvider
from app.config import settings


def get_ai_provider(name: str | None = None) -> AIProvider:
    """Get an AI provider instance by name.

    Args:
        name: Provider name ('openai', 'anthropic', 'gemini').
              Defaults to settings.default_ai_provider.

    Returns:
        AIProvider instance.
    """
    provider_name = name or settings.default_ai_provider

    if provider_name == "openai":
        from app.ai.providers.openai_provider import OpenAIProvider
        return OpenAIProvider()
    elif provider_name == "anthropic":
        from app.ai.providers.anthropic_provider import AnthropicProvider
        return AnthropicProvider()
    elif provider_name == "gemini":
        from app.ai.providers.gemini_provider import GeminiProvider
        return GeminiProvider()
    else:
        raise ValueError(f"Unknown AI provider: {provider_name}. Supported: openai, anthropic, gemini")
