"""Seed coding questions with test cases and code stubs into the database.

Reads from seed_data/coding_questions.json and inserts questions using raw SQL
via asyncpg, matching the pattern from seed_direct.py.
"""
import asyncio
import json
import uuid
from pathlib import Path

import asyncpg


DB_DSN = "postgresql://poc_user:poc_password@localhost:5433/assessments_db"
SEED_FILE = Path(__file__).parent.parent / "seed_data" / "coding_questions.json"


async def seed_coding_questions():
    conn = await asyncpg.connect(DB_DSN)
    try:
        with open(SEED_FILE) as f:
            questions = json.load(f)

        # Get a user to set as creator (prefer admin)
        creator_id = await conn.fetchval(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        )
        if not creator_id:
            creator_id = await conn.fetchval("SELECT id FROM users LIMIT 1")

        org_id = await conn.fetchval(
            "SELECT id FROM organizations LIMIT 1"
        )

        created = 0
        skipped = 0

        for q_data in questions:
            # Check if question with same title already exists
            existing = await conn.fetchval(
                "SELECT id FROM questions WHERE title = $1", q_data["title"]
            )
            if existing:
                print(f"  [skip] '{q_data['title']}' already exists")
                skipped += 1
                continue

            question_id = uuid.uuid4()

            await conn.execute(
                """INSERT INTO questions
                   (id, organization_id, created_by_id, type, difficulty,
                    title, body, explanation, time_limit_seconds, max_score,
                    is_ai_generated, is_active, usage_count, created_at, updated_at)
                   VALUES ($1, $2, $3, $4::questiontype, $5::difficultylevel,
                           $6, $7, $8, $9, $10,
                           false, true, 0, now(), now())""",
                question_id,
                org_id,
                creator_id,
                q_data["type"].upper(),
                q_data["difficulty"].upper(),
                q_data["title"],
                q_data["body"],
                q_data.get("explanation"),
                q_data.get("time_limit_seconds"),
                q_data.get("max_score", 10),
            )

            # Insert test cases
            for tc in q_data.get("test_cases", []):
                tc_id = uuid.uuid4()
                await conn.execute(
                    """INSERT INTO question_test_cases
                       (id, question_id, input, expected_output, is_hidden,
                        is_sample, order_index, time_limit_ms, memory_limit_mb,
                        created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())""",
                    tc_id,
                    question_id,
                    tc["input"],
                    tc["expected_output"],
                    tc.get("is_hidden", False),
                    tc.get("is_sample", True),
                    tc.get("order_index", 0),
                    tc.get("time_limit_ms", 5000),
                    tc.get("memory_limit_mb", 256),
                )

            # Insert code stubs
            for cs in q_data.get("code_stubs", []):
                cs_id = uuid.uuid4()
                await conn.execute(
                    """INSERT INTO question_code_stubs
                       (id, question_id, language, stub_code, solution_code,
                        created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, now(), now())""",
                    cs_id,
                    question_id,
                    cs["language"],
                    cs["stub_code"],
                    cs.get("solution_code"),
                )

            # Tag with skills by name (if they exist)
            for skill_name in q_data.get("skill_names", []):
                skill_id = await conn.fetchval(
                    "SELECT id FROM skills WHERE name = $1 LIMIT 1", skill_name
                )
                if skill_id:
                    await conn.execute(
                        """INSERT INTO question_tags (question_id, skill_id)
                           VALUES ($1, $2)
                           ON CONFLICT DO NOTHING""",
                        question_id, skill_id,
                    )

            created += 1
            tc_count = len(q_data.get("test_cases", []))
            cs_count = len(q_data.get("code_stubs", []))
            print(
                f"  ✓ Created: '{q_data['title']}' "
                f"({q_data['type']}/{q_data['difficulty']}) "
                f"— {tc_count} test cases, {cs_count} code stubs"
            )

        print(f"\nDone! Created {created} questions, skipped {skipped}.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_coding_questions())
