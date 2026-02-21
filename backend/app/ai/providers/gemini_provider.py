"""Google Gemini provider implementation."""

import json
import logging
from typing import Any

from google import generativeai as genai

from app.ai.providers.base import AIProvider
from app.config import settings

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    """Google Gemini provider."""

    def __init__(self, model: str = "gemini-2.0-flash"):
        genai.configure(api_key=settings.gemini_api_key)
        self.model_name = model
        self.model = genai.GenerativeModel(model)

    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        full_prompt = ""
        if system_prompt:
            full_prompt = f"System instructions: {system_prompt}\n\n"
        full_prompt += prompt

        generation_config = genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=generation_config,
        )

        return response.text or ""

    async def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4000,
    ) -> dict[str, Any]:
        json_instruction = "\n\nYou must respond with valid JSON only. No markdown, no code blocks, just raw JSON."
        full_prompt = ""
        if system_prompt:
            full_prompt = f"System instructions: {system_prompt}{json_instruction}\n\n"
        else:
            full_prompt = f"System instructions:{json_instruction}\n\n"
        full_prompt += prompt

        generation_config = genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            response_mime_type="application/json",
        )

        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=generation_config,
        )

        content = (response.text or "").strip()

        # Clean up potential markdown wrapping
        if content.startswith("```"):
            lines = content.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            content = "\n".join(lines).strip()

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Gemini JSON response: %s", content[:200])
            return {}
