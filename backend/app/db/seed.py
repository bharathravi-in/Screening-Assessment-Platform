"""Seed script to populate initial data."""
import asyncio

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import async_session_factory
from app.models.organization import OrgSettings, Organization
from app.models.user import User, UserRole
from app.models.taxonomy import Technology, Skill


TAXONOMY_DATA = {
    "Python": {
        "category": "language",
        "skills": [
            "Core Python", "OOP in Python", "Decorators & Generators",
            "List Comprehensions", "Error Handling", "File I/O",
            "Async/Await", "Type Hints", "Unit Testing",
            "Data Structures", "Algorithms",
        ],
    },
    "JavaScript": {
        "category": "language",
        "skills": [
            "ES6+ Features", "Closures & Scope", "Promises & Async/Await",
            "DOM Manipulation", "Event Loop", "Prototypes & Classes",
            "Error Handling", "Modules", "Array Methods",
            "Destructuring & Spread",
        ],
    },
    "TypeScript": {
        "category": "language",
        "skills": [
            "Type System", "Interfaces & Types", "Generics",
            "Decorators", "Enums", "Utility Types",
            "Type Guards", "Module System",
        ],
    },
    "Java": {
        "category": "language",
        "skills": [
            "Core Java", "OOP Principles", "Collections Framework",
            "Exception Handling", "Multithreading", "Streams API",
            "Generics", "JVM Internals", "Design Patterns",
            "Unit Testing (JUnit)",
        ],
    },
    "React": {
        "category": "framework",
        "skills": [
            "Components & JSX", "Hooks (useState, useEffect)",
            "State Management", "Context API", "React Router",
            "Performance Optimization", "Custom Hooks",
            "Error Boundaries", "Testing (React Testing Library)",
        ],
    },
    "Angular": {
        "category": "framework",
        "skills": [
            "Components & Templates", "Dependency Injection",
            "Services", "RxJS & Observables", "Routing",
            "Forms (Reactive & Template)", "Pipes",
            "Modules & Lazy Loading", "Angular CLI",
        ],
    },
    "Node.js": {
        "category": "framework",
        "skills": [
            "Event Loop", "Streams", "Express.js",
            "Middleware", "REST API Design", "Authentication",
            "Error Handling", "File System", "NPM & Package Management",
        ],
    },
    "SQL": {
        "category": "database",
        "skills": [
            "SELECT & Joins", "Subqueries", "Aggregations",
            "Indexing", "Normalization", "Transactions",
            "Window Functions", "Query Optimization",
            "Stored Procedures", "Database Design",
        ],
    },
    "PostgreSQL": {
        "category": "database",
        "skills": [
            "JSONB Operations", "CTEs", "Partitioning",
            "Extensions", "Performance Tuning", "Replication",
        ],
    },
    "MongoDB": {
        "category": "database",
        "skills": [
            "CRUD Operations", "Aggregation Pipeline",
            "Indexing", "Schema Design", "Replica Sets",
            "Transactions",
        ],
    },
    "AWS": {
        "category": "cloud",
        "skills": [
            "EC2", "S3", "Lambda",
            "API Gateway", "DynamoDB", "CloudFormation",
            "IAM", "VPC & Networking", "ECS/EKS",
            "CloudWatch",
        ],
    },
    "Docker": {
        "category": "tool",
        "skills": [
            "Dockerfiles", "Docker Compose",
            "Image Management", "Networking",
            "Volumes", "Multi-stage Builds",
        ],
    },
    "Git": {
        "category": "tool",
        "skills": [
            "Branching & Merging", "Rebasing",
            "Conflict Resolution", "Git Flow",
            "Cherry Pick", "Hooks",
        ],
    },
    "Data Structures & Algorithms": {
        "category": "concept",
        "skills": [
            "Arrays & Strings", "Linked Lists",
            "Stacks & Queues", "Trees & Graphs",
            "Hash Tables", "Sorting Algorithms",
            "Searching Algorithms", "Dynamic Programming",
            "Recursion", "Big O Analysis",
            "Greedy Algorithms", "Backtracking",
        ],
    },
    "System Design": {
        "category": "concept",
        "skills": [
            "Scalability", "Load Balancing",
            "Caching", "Database Sharding",
            "Microservices", "Message Queues",
            "API Design", "CAP Theorem",
            "Rate Limiting", "Distributed Systems",
        ],
    },
}


async def seed():
    async with async_session_factory() as session:
        # Check if already seeded
        # Seed super_admin (no org)
        result_sa = await session.execute(select(User).where(User.email == "superadmin@platform.com"))
        if not result_sa.scalar_one_or_none():
            super_admin = User(
                email="superadmin@platform.com",
                password_hash=hash_password("SuperAdmin@123"),
                full_name="Platform Super Admin",
                role=UserRole.SUPER_ADMIN,
                organization_id=None,
                is_active=True,
            )
            session.add(super_admin)
            await session.flush()
            print("  Super Admin: superadmin@platform.com / SuperAdmin@123")

        result = await session.execute(select(User).where(User.email == "admin@assessment.local"))
        if result.scalar_one_or_none():
            print("Users already seeded. Checking taxonomy...")
        else:
            # Create default organization
            org = Organization(name="Default Organization", slug="default-org")
            session.add(org)
            await session.flush()

            org_settings = OrgSettings(organization_id=org.id)
            session.add(org_settings)

            admin = User(
                email="admin@assessment.local",
                password_hash=hash_password("admin123"),
                full_name="System Admin",
                role=UserRole.ADMIN,
                organization_id=org.id,
            )
            session.add(admin)

            hr_user = User(
                email="hr@assessment.local",
                password_hash=hash_password("hr123456"),
                full_name="HR Manager",
                role=UserRole.HR,
                organization_id=org.id,
            )
            session.add(hr_user)
            await session.flush()

            print("Users seeded:")
            print(f"  Admin: admin@assessment.local / admin123")
            print(f"  HR: hr@assessment.local / hr123456")

        # Seed taxonomy
        existing_tech = await session.execute(select(Technology).limit(1))
        if existing_tech.scalar_one_or_none():
            print("Taxonomy already seeded. Skipping.")
        else:
            tech_count = 0
            skill_count = 0
            for tech_name, tech_data in TAXONOMY_DATA.items():
                tech = Technology(name=tech_name, category=tech_data["category"])
                session.add(tech)
                await session.flush()
                tech_count += 1

                for skill_name in tech_data["skills"]:
                    skill = Skill(
                        technology_id=tech.id,
                        name=skill_name,
                    )
                    session.add(skill)
                    skill_count += 1

            await session.flush()
            print(f"Taxonomy seeded: {tech_count} technologies, {skill_count} skills")

        await session.commit()
        print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
