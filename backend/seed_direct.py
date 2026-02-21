"""Direct seed script using raw SQL via asyncpg — bypasses SQLAlchemy enum issue."""
import asyncio
import asyncpg
import bcrypt
import uuid


DB_DSN = "postgresql://poc_user:poc_password@localhost:5432/assessments_db"


def make_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


USERS = [
    {
        "email": "superadmin@platform.com",
        "password": "SuperAdmin@123",
        "full_name": "Platform Super Admin",
        "role": "super_admin",
        "org": False,
    },
    {
        "email": "admin@assessment.local",
        "password": "admin123",
        "full_name": "System Admin",
        "role": "admin",
        "org": True,
    },
    {
        "email": "hr@assessment.local",
        "password": "hr123456",
        "full_name": "HR Manager",
        "role": "hr",
        "org": True,
    },
    {
        "email": "tech@assessment.local",
        "password": "tech123456",
        "full_name": "Tech Reviewer",
        "role": "tech",
        "org": True,
    },
]


async def seed():
    conn = await asyncpg.connect(DB_DSN)
    try:
        # Check / create org
        org_id = await conn.fetchval(
            "SELECT id FROM organizations WHERE slug = 'default-org' LIMIT 1"
        )
        if not org_id:
            org_id = await conn.fetchval(
                """INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, true, now(), now())
                   ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                   RETURNING id""",
                uuid.uuid4(), "Default Organization", "default-org"
            )
            # org settings
            try:
                await conn.execute(
                    """INSERT INTO org_settings
                       (id, organization_id, theme_config, proctoring_defaults,
                        max_violation_warnings, auto_terminate_on_violations,
                        allowed_ai_providers, created_at, updated_at)
                       VALUES ($1, $2, '{}', $3, 3, true, '["openai"]', now(), now())
                       ON CONFLICT DO NOTHING""",
                    uuid.uuid4(), org_id,
                    '{"copy_paste_disabled":true,"tab_switch_detection":true,"fullscreen_enforced":true,"right_click_disabled":true,"keyboard_shortcuts_restricted":true}'
                )
            except Exception as e:
                print(f"  [warn] org_settings: {e}")
            print(f"  Created org: Default Organization ({org_id})")
        else:
            print(f"  Org exists: {org_id}")

        for u in USERS:
            existing = await conn.fetchval(
                "SELECT id FROM users WHERE email = $1", u["email"]
            )
            if existing:
                print(f"  [skip] {u['email']} already exists")
                continue

            uid = uuid.uuid4()
            pw_hash = make_hash(u["password"])
            org = org_id if u["org"] else None

            await conn.execute(
                """INSERT INTO users
                   (id, email, password_hash, full_name, role, organization_id,
                    is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5::userrole, $6, true, now(), now())""",
                uid, u["email"], pw_hash, u["full_name"], u["role"], org
            )
            print(f"  Created: {u['email']} / {u['password']}  [{u['role']}]")

        print("\nSeed complete!")
        print("\n=== Login credentials ===")
        for u in USERS:
            print(f"  {u['role']:12s}  {u['email']:35s}  {u['password']}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
