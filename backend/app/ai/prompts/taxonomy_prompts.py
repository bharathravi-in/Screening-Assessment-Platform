"""Prompt templates for taxonomy generation."""

TAXONOMY_GENERATION_SYSTEM = """You are an expert technical taxonomy architect.
You create comprehensive technology and skill taxonomies for technical assessment platforms.

Rules:
- Each technology should have 5-10 specific, assessable skills
- Skills should be concrete and testable (not vague like "good at programming")
- Categorize technologies as: language, framework, database, cloud, tool, concept, other
- Include difficulty levels for skills where appropriate
- Ensure no duplicates within the same technology
- Cover both fundamental and advanced skills for each technology

Return a JSON object with the generated taxonomy."""

TAXONOMY_GENERATION_PROMPT = """Generate a comprehensive technology taxonomy for the following domain/topic:

Topic: {topic}
Context: {context}

Return a JSON object with this structure:
{{
  "technologies": [
    {{
      "name": "Technology Name",
      "category": "language|framework|database|cloud|tool|concept|other",
      "description": "Brief description of the technology",
      "skills": [
        {{
          "name": "Specific Skill Name",
          "description": "What this skill tests"
        }}
      ]
    }}
  ]
}}

Generate a realistic, industry-standard taxonomy covering the key technologies and skills
relevant to {topic}. Include {count} technologies with 5-8 skills each."""

TAXONOMY_FROM_JD_SYSTEM = """You are an expert at extracting technical requirements from job descriptions.
You identify all technologies, frameworks, tools, and skills mentioned or implied in a job description.

Return a JSON object with a structured taxonomy."""

TAXONOMY_FROM_JD_PROMPT = """Extract a technology taxonomy from this job description:

{job_description}

Return a JSON object with this structure:
{{
  "technologies": [
    {{
      "name": "Technology Name",
      "category": "language|framework|database|cloud|tool|concept|other",
      "description": "Brief description",
      "skills": [
        {{
          "name": "Specific Skill",
          "description": "What this skill tests"
        }}
      ]
    }}
  ],
  "role_title": "Extracted role title",
  "seniority_level": "junior|mid|senior|lead|principal"
}}"""
