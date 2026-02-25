import csv
import io
import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import is_super_admin, require_roles
from app.db.session import get_db
from app.models.taxonomy import DifficultyLevel, Skill, Technology
from app.models.user import User
from app.schemas.taxonomy import (
    DifficultyLevelCreate,
    DifficultyLevelResponse,
    SkillCreate,
    SkillResponse,
    SkillUpdate,
    TechnologyCreate,
    TechnologyResponse,
    TechnologyUpdate,
    TechnologyWithSkillsResponse,
)

router = APIRouter()


def _tech_scope_filter(current_user: User):
    """Return SQLAlchemy filter for technology visibility."""
    if is_super_admin(current_user):
        return None
    return or_(
        Technology.organization_id.is_(None),
        Technology.organization_id == current_user.organization_id,
    )


@router.get("/technologies", response_model=list[TechnologyResponse])
async def list_technologies(
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Technology).where(Technology.is_active == True).order_by(
        Technology.organization_id.is_(None).desc(),
        Technology.name,
    )
    scope = _tech_scope_filter(current_user)
    if scope is not None:
        q = q.where(scope)
    result = await db.execute(q)
    return [TechnologyResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/technologies", response_model=TechnologyResponse, status_code=status.HTTP_201_CREATED)
async def create_technology(
    request: TechnologyCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    org_id = None if is_super_admin(current_user) else current_user.organization_id
    existing = await db.execute(
        select(Technology).where(
            Technology.name == request.name,
            Technology.organization_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Technology already exists in this scope")

    tech = Technology(name=request.name, category=request.category, icon_url=request.icon_url, organization_id=org_id)
    db.add(tech)
    await db.flush()
    await db.refresh(tech)
    return TechnologyResponse.model_validate(tech)


@router.put("/technologies/{tech_id}", response_model=TechnologyResponse)
async def update_technology(
    tech_id: UUID,
    request: TechnologyUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Technology).where(Technology.id == tech_id))
    tech = result.scalar_one_or_none()
    if not tech:
        raise HTTPException(status_code=404, detail="Technology not found")
    if not is_super_admin(current_user) and tech.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="You can only edit your organization's technologies")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(tech, field, value)
    await db.flush()
    await db.refresh(tech)
    return TechnologyResponse.model_validate(tech)


@router.delete("/technologies/{tech_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_technology(
    tech_id: UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Technology).where(Technology.id == tech_id))
    tech = result.scalar_one_or_none()
    if not tech:
        raise HTTPException(status_code=404, detail="Technology not found")
    if not is_super_admin(current_user) and tech.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="You can only delete your organization's technologies")
    tech.is_active = False
    await db.flush()


@router.get("/technologies/{tech_id}/skills", response_model=TechnologyWithSkillsResponse)
async def get_technology_with_skills(
    tech_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Technology).where(Technology.id == tech_id).options(selectinload(Technology.skills))
    )
    tech = result.scalar_one_or_none()
    if not tech:
        raise HTTPException(status_code=404, detail="Technology not found")
    if not is_super_admin(current_user):
        if tech.organization_id is not None and tech.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Technology not found")
    return TechnologyWithSkillsResponse.model_validate(tech)


@router.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    request: SkillCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    tech_result = await db.execute(select(Technology).where(Technology.id == request.technology_id))
    tech = tech_result.scalar_one_or_none()
    if not tech:
        raise HTTPException(status_code=404, detail="Technology not found")
    if not is_super_admin(current_user):
        if tech.organization_id is not None and tech.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Cannot add skills to another org's technology")
    skill = Skill(
        technology_id=request.technology_id,
        name=request.name,
        description=request.description,
        difficulty_default=request.difficulty_default,
    )
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return SkillResponse.model_validate(skill)


@router.put("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: UUID,
    request: SkillUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id).options(selectinload(Skill.technology))
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if not is_super_admin(current_user):
        if skill.technology.organization_id is not None and skill.technology.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Cannot edit skills from another org's technology")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(skill, field, value)
    await db.flush()
    await db.refresh(skill)
    return SkillResponse.model_validate(skill)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id).options(selectinload(Skill.technology))
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if not is_super_admin(current_user):
        if skill.technology.organization_id is not None and skill.technology.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Cannot delete skills from another org's technology")
    skill.is_active = False
    await db.flush()


@router.get("/difficulty-levels", response_model=list[DifficultyLevelResponse])
async def list_difficulty_levels(
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DifficultyLevel).order_by(DifficultyLevel.numeric_value))
    return [DifficultyLevelResponse.model_validate(d) for d in result.scalars().all()]


@router.post("/difficulty-levels", response_model=DifficultyLevelResponse, status_code=status.HTTP_201_CREATED)
async def create_difficulty_level(
    request: DifficultyLevelCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    dl = DifficultyLevel(
        name=request.name,
        numeric_value=request.numeric_value,
        description=request.description,
        time_multiplier=request.time_multiplier,
        organization_id=request.organization_id,
    )
    db.add(dl)
    await db.flush()
    await db.refresh(dl)
    return DifficultyLevelResponse.model_validate(dl)


# ---------------------------------------------------------------------------
# POST /taxonomy/ai-generate  — Generate taxonomy from topic or JD using AI
# ---------------------------------------------------------------------------

@router.post("/ai-generate")
async def ai_generate_taxonomy(
    body: dict,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Generate taxonomy from a topic/domain or job description using AI.

    Body: {"topic": "...", "context": "...", "count": 5}
    OR:   {"job_description": "..."}
    """
    from app.ai.agents.taxonomy_generator import TaxonomyGeneratorAgent

    agent = TaxonomyGeneratorAgent()

    job_description = body.get("job_description", "")
    topic = body.get("topic", "")

    if not topic and not job_description:
        raise HTTPException(status_code=400, detail="Provide 'topic' or 'job_description'")

    if job_description:
        result = await agent.generate_from_jd(job_description)
        technologies = result["technologies"]
    else:
        context = body.get("context", "")
        count = min(body.get("count", 5), 15)
        technologies = await agent.generate_from_topic(topic, context, count)

    # If auto_save is True, persist to DB
    saved = []
    if body.get("auto_save", False):
        org_id = None if is_super_admin(current_user) else current_user.organization_id
        for tech_data in technologies:
            # Check if technology already exists
            existing = await db.execute(
                select(Technology).where(
                    Technology.name == tech_data["name"],
                    Technology.organization_id == org_id,
                )
            )
            tech = existing.scalar_one_or_none()
            if not tech:
                tech = Technology(
                    name=tech_data["name"],
                    category=tech_data.get("category", "other"),
                    organization_id=org_id,
                )
                db.add(tech)
                await db.flush()
                await db.refresh(tech)

            # Add skills
            for skill_data in tech_data.get("skills", []):
                skill_exists = await db.execute(
                    select(Skill).where(
                        Skill.technology_id == tech.id,
                        Skill.name == skill_data["name"],
                    )
                )
                if not skill_exists.scalar_one_or_none():
                    skill = Skill(
                        technology_id=tech.id,
                        name=skill_data["name"],
                        description=skill_data.get("description", ""),
                    )
                    db.add(skill)

            await db.flush()
            saved.append({"technology": tech_data["name"], "skill_count": len(tech_data.get("skills", []))})

    return {
        "technologies": technologies,
        "saved": saved,
        "total_technologies": len(technologies),
        "total_skills": sum(len(t.get("skills", [])) for t in technologies),
    }


# ---------------------------------------------------------------------------
# POST /taxonomy/bulk-upload  — Create taxonomy from CSV or JSON file
# ---------------------------------------------------------------------------

@router.post("/bulk-upload")
async def bulk_upload_taxonomy(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CSV or JSON file to bulk-create technologies and skills.

    CSV format: technology,category,skill,description
    JSON format: [{"name": "...", "category": "...", "skills": [{"name": "...", "description": "..."}]}]
    """
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    org_id = None if is_super_admin(current_user) else current_user.organization_id
    created_techs = 0
    created_skills = 0
    skipped = 0

    filename = (file.filename or "").lower()

    if filename.endswith(".json"):
        # JSON upload
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON file")

        items = data if isinstance(data, list) else data.get("technologies", [])
        for tech_data in items:
            tech_name = tech_data.get("name", "").strip()
            if not tech_name:
                skipped += 1
                continue

            existing = await db.execute(
                select(Technology).where(Technology.name == tech_name, Technology.organization_id == org_id)
            )
            tech = existing.scalar_one_or_none()
            if not tech:
                tech = Technology(
                    name=tech_name,
                    category=tech_data.get("category", "other"),
                    organization_id=org_id,
                )
                db.add(tech)
                await db.flush()
                await db.refresh(tech)
                created_techs += 1

            for skill_data in tech_data.get("skills", []):
                skill_name = skill_data.get("name", "").strip() if isinstance(skill_data, dict) else str(skill_data).strip()
                if not skill_name:
                    continue
                skill_desc = skill_data.get("description", "") if isinstance(skill_data, dict) else ""
                skill_exists = await db.execute(
                    select(Skill).where(Skill.technology_id == tech.id, Skill.name == skill_name)
                )
                if not skill_exists.scalar_one_or_none():
                    db.add(Skill(technology_id=tech.id, name=skill_name, description=skill_desc))
                    created_skills += 1
                else:
                    skipped += 1

    else:
        # CSV upload: columns = technology, category, skill, description
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="Empty or invalid CSV")

        normalized = {f.strip().lower().replace(" ", "_"): f for f in reader.fieldnames}
        tech_col = normalized.get("technology") or normalized.get("tech") or normalized.get("technology_name")
        skill_col = normalized.get("skill") or normalized.get("skill_name")
        cat_col = normalized.get("category") or normalized.get("type")
        desc_col = normalized.get("description") or normalized.get("desc")

        if not tech_col:
            raise HTTPException(status_code=400, detail="CSV must have a 'technology' column")

        tech_cache: dict[str, Technology] = {}
        for row in reader:
            tech_name = (row.get(tech_col) or "").strip()
            if not tech_name:
                skipped += 1
                continue

            category = (row.get(cat_col) or "other").strip() if cat_col else "other"

            if tech_name not in tech_cache:
                existing = await db.execute(
                    select(Technology).where(Technology.name == tech_name, Technology.organization_id == org_id)
                )
                tech = existing.scalar_one_or_none()
                if not tech:
                    tech = Technology(name=tech_name, category=category, organization_id=org_id)
                    db.add(tech)
                    await db.flush()
                    await db.refresh(tech)
                    created_techs += 1
                tech_cache[tech_name] = tech

            tech = tech_cache[tech_name]

            if skill_col:
                skill_name = (row.get(skill_col) or "").strip()
                if skill_name:
                    desc = (row.get(desc_col) or "").strip() if desc_col else ""
                    skill_exists = await db.execute(
                        select(Skill).where(Skill.technology_id == tech.id, Skill.name == skill_name)
                    )
                    if not skill_exists.scalar_one_or_none():
                        db.add(Skill(technology_id=tech.id, name=skill_name, description=desc))
                        created_skills += 1
                    else:
                        skipped += 1

    await db.flush()

    return {
        "created_technologies": created_techs,
        "created_skills": created_skills,
        "skipped": skipped,
    }


# ---------------------------------------------------------------------------
# GET /taxonomy/export  — Download taxonomy as CSV
# ---------------------------------------------------------------------------

@router.get("/export")
async def export_taxonomy(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Export all taxonomy data as a CSV file."""
    scope = _tech_scope_filter(current_user)
    query = (
        select(Technology)
        .options(selectinload(Technology.skills))
        .where(scope)
        .order_by(Technology.name)
    )
    result = await db.execute(query)
    technologies = result.unique().scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["technology", "category", "skill", "description"])

    for tech in technologies:
        if not tech.skills:
            writer.writerow([tech.name, tech.category or "other", "", ""])
        else:
            for skill in sorted(tech.skills, key=lambda s: s.name):
                writer.writerow([
                    tech.name,
                    tech.category or "other",
                    skill.name,
                    skill.description or "",
                ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=taxonomy_export.csv"},
    )

