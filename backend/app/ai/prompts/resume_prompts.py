"""Prompt templates for resume parsing."""

RESUME_EXTRACTION_SYSTEM = """You are an expert resume parser. Extract structured information from the resume text provided.
Return a JSON object with the following fields:

{
  "name": "Full name of the candidate",
  "email": "Email address",
  "phone": "Phone number",
  "location": "City, State/Country",
  "summary": "Professional summary (2-3 sentences)",
  "experience_years": number or null,
  "education": [
    {"degree": "...", "institution": "...", "year": "...", "field": "..."}
  ],
  "work_experience": [
    {"title": "...", "company": "...", "duration": "...", "description": "..."}
  ],
  "skills": ["skill1", "skill2", ...],
  "certifications": ["cert1", "cert2", ...],
  "languages": ["lang1", "lang2", ...]
}

Be thorough but concise. Extract ALL technical skills mentioned anywhere in the resume.
If a field cannot be determined, use null or an empty list as appropriate."""

RESUME_EXTRACTION_PROMPT = """Parse the following resume text and extract structured information:

---
{resume_text}
---

Return the extracted data as a JSON object."""

SKILL_MATCHING_SYSTEM = """You are a technical skill matching expert. Given a list of extracted skills from a resume
and a taxonomy of technologies and skills, match each extracted skill to the most relevant taxonomy entry.

Return a JSON object:
{
  "matched_skills": [
    {
      "extracted_skill": "The skill as found in the resume",
      "taxonomy_technology": "The matching technology name",
      "taxonomy_skill": "The matching skill name",
      "confidence": 0.0 to 1.0
    }
  ],
  "unmatched_skills": ["skill1", "skill2"]
}

Only include matches with confidence >= 0.5. Be precise in matching."""

SKILL_MATCHING_PROMPT = """Match these extracted skills to the taxonomy:

Extracted skills: {extracted_skills}

Available taxonomy:
{taxonomy}

Return matched and unmatched skills as JSON."""
