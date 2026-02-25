"""Seed script to populate initial data."""
import asyncio

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import async_session_factory
from app.models.organization import OrgSettings, Organization
from app.models.user import User, UserRole
from app.models.taxonomy import Technology, Skill
from app.models.question import Question, QuestionOption, QuestionTag, QuestionType, DifficultyLevel


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
    "C#": {
        "category": "language",
        "skills": [
            "Core C#", "LINQ", "Async/Await",
            "Delegates & Events", "Generics", "Entity Framework",
            "Dependency Injection", "Unit Testing (NUnit/xUnit)",
        ],
    },
    "Go": {
        "category": "language",
        "skills": [
            "Goroutines & Channels", "Interfaces", "Error Handling",
            "Packages & Modules", "Concurrency Patterns",
            "Testing", "Standard Library",
        ],
    },
    "Rust": {
        "category": "language",
        "skills": [
            "Ownership & Borrowing", "Lifetimes", "Enums & Pattern Matching",
            "Traits", "Error Handling (Result/Option)",
            "Concurrency", "Cargo & Crates",
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
    "Django": {
        "category": "framework",
        "skills": [
            "Models & ORM", "Views & URLs", "Templates",
            "Forms & Validation", "Admin Panel",
            "Middleware", "REST Framework", "Authentication",
        ],
    },
    "Spring Boot": {
        "category": "framework",
        "skills": [
            "Dependency Injection", "Spring Data JPA", "REST Controllers",
            "Security", "Actuator", "Testing",
            "Microservices", "Configuration",
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
    "Redis": {
        "category": "database",
        "skills": [
            "Data Types", "Pub/Sub", "Caching Patterns",
            "Persistence", "Lua Scripting", "Clustering",
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
    "Kubernetes": {
        "category": "tool",
        "skills": [
            "Pods & Deployments", "Services & Ingress",
            "ConfigMaps & Secrets", "Helm Charts",
            "Namespaces", "Resource Limits",
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


# --------------------------------------------------------------------------
# Questions seed data – keyed by (technology_name, skill_name)
# Each question: type, difficulty, title, body, explanation, options, time
# --------------------------------------------------------------------------
QUESTIONS_DATA = [
    # ── Python ────────────────────────────────────────────────────────
    {
        "technology": "Python", "skill": "Core Python",
        "type": "mcq", "difficulty": "beginner",
        "title": "What is the output of `print(type([]))`?",
        "body": "What does the following Python expression evaluate to?\n\n```python\nprint(type([]))\n```",
        "explanation": "`[]` creates an empty list, so `type([])` returns `<class 'list'>`.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "<class 'list'>", "is_correct": True},
            {"label": "B", "text": "<class 'tuple'>", "is_correct": False},
            {"label": "C", "text": "<class 'dict'>", "is_correct": False},
            {"label": "D", "text": "<class 'set'>", "is_correct": False},
        ],
    },
    {
        "technology": "Python", "skill": "Core Python",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is the output of `print(3 * 'ab')`?",
        "body": "What does the following expression output?\n\n```python\nprint(3 * 'ab')\n```",
        "explanation": "String repetition operator `*` repeats the string 3 times.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "ababab", "is_correct": True},
            {"label": "B", "text": "ab3", "is_correct": False},
            {"label": "C", "text": "Error", "is_correct": False},
            {"label": "D", "text": "3ab", "is_correct": False},
        ],
    },
    {
        "technology": "Python", "skill": "OOP in Python",
        "type": "mcq", "difficulty": "intermediate",
        "title": "Which keyword is used to inherit from a parent class?",
        "body": "In Python, which syntax correctly defines a class `Dog` that inherits from `Animal`?",
        "explanation": "Python uses parentheses after the class name to specify the parent class: `class Dog(Animal):`.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "class Dog(Animal):", "is_correct": True},
            {"label": "B", "text": "class Dog extends Animal:", "is_correct": False},
            {"label": "C", "text": "class Dog inherits Animal:", "is_correct": False},
            {"label": "D", "text": "class Dog <- Animal:", "is_correct": False},
        ],
    },
    {
        "technology": "Python", "skill": "Decorators & Generators",
        "type": "mcq", "difficulty": "advanced",
        "title": "What does the `yield` keyword do?",
        "body": "What happens when a Python function contains a `yield` statement?",
        "explanation": "A function with `yield` becomes a generator function. It produces values lazily, pausing execution between yields.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "It turns the function into a generator that produces values lazily", "is_correct": True},
            {"label": "B", "text": "It returns a value and terminates the function", "is_correct": False},
            {"label": "C", "text": "It raises a StopIteration exception", "is_correct": False},
            {"label": "D", "text": "It imports a module dynamically", "is_correct": False},
        ],
    },
    {
        "technology": "Python", "skill": "Error Handling",
        "type": "mcq", "difficulty": "beginner",
        "title": "Which block always executes regardless of exceptions?",
        "body": "In a try/except/finally structure, which block always executes?",
        "explanation": "The `finally` block always executes, whether or not an exception occurred.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "finally", "is_correct": True},
            {"label": "B", "text": "except", "is_correct": False},
            {"label": "C", "text": "else", "is_correct": False},
            {"label": "D", "text": "try", "is_correct": False},
        ],
    },
    # ── JavaScript ────────────────────────────────────────────────────
    {
        "technology": "JavaScript", "skill": "ES6+ Features",
        "type": "mcq", "difficulty": "beginner",
        "title": "What is the difference between `let` and `var`?",
        "body": "Which statement best describes the difference between `let` and `var` in JavaScript?",
        "explanation": "`let` is block-scoped while `var` is function-scoped. `let` was introduced in ES6.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "let is block-scoped, var is function-scoped", "is_correct": True},
            {"label": "B", "text": "let is function-scoped, var is block-scoped", "is_correct": False},
            {"label": "C", "text": "They are identical", "is_correct": False},
            {"label": "D", "text": "let cannot be reassigned", "is_correct": False},
        ],
    },
    {
        "technology": "JavaScript", "skill": "Closures & Scope",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is a closure in JavaScript?",
        "body": "Which statement best defines a closure?",
        "explanation": "A closure is a function that retains access to variables from its outer (enclosing) scope even after the outer function has returned.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "A function that has access to its outer scope's variables even after the outer function returns", "is_correct": True},
            {"label": "B", "text": "A function that cannot access global variables", "is_correct": False},
            {"label": "C", "text": "A function that is immediately invoked", "is_correct": False},
            {"label": "D", "text": "A function without parameters", "is_correct": False},
        ],
    },
    {
        "technology": "JavaScript", "skill": "Promises & Async/Await",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What does `Promise.all()` do?",
        "body": "What is the behavior of `Promise.all([p1, p2, p3])`?",
        "explanation": "`Promise.all` waits for all promises to resolve. If any reject, the whole result rejects.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "Resolves when all promises resolve; rejects if any reject", "is_correct": True},
            {"label": "B", "text": "Resolves when the first promise resolves", "is_correct": False},
            {"label": "C", "text": "Always resolves, ignoring rejected promises", "is_correct": False},
            {"label": "D", "text": "Executes promises sequentially", "is_correct": False},
        ],
    },
    {
        "technology": "JavaScript", "skill": "Event Loop",
        "type": "mcq", "difficulty": "advanced",
        "title": "What is the order of execution?",
        "body": "What is the output of the following code?\n\n```javascript\nconsole.log('1');\nsetTimeout(() => console.log('2'), 0);\nPromise.resolve().then(() => console.log('3'));\nconsole.log('4');\n```",
        "explanation": "Synchronous code runs first (1, 4), then microtasks (Promise → 3), then macrotasks (setTimeout → 2).",
        "time_limit_seconds": 120, "max_score": 10,
        "options": [
            {"label": "A", "text": "1, 4, 3, 2", "is_correct": True},
            {"label": "B", "text": "1, 2, 3, 4", "is_correct": False},
            {"label": "C", "text": "1, 4, 2, 3", "is_correct": False},
            {"label": "D", "text": "1, 3, 4, 2", "is_correct": False},
        ],
    },
    {
        "technology": "JavaScript", "skill": "Array Methods",
        "type": "mcq", "difficulty": "beginner",
        "title": "Which method adds an element to the end of an array?",
        "body": "Which JavaScript array method adds one or more elements to the end of an array?",
        "explanation": "`push()` adds elements to the end of an array and returns the new length.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "push()", "is_correct": True},
            {"label": "B", "text": "unshift()", "is_correct": False},
            {"label": "C", "text": "pop()", "is_correct": False},
            {"label": "D", "text": "shift()", "is_correct": False},
        ],
    },
    # ── TypeScript ────────────────────────────────────────────────────
    {
        "technology": "TypeScript", "skill": "Type System",
        "type": "mcq", "difficulty": "beginner",
        "title": "What is the TypeScript type for a variable that can be a string or number?",
        "body": "How do you declare a variable in TypeScript that can hold either a string or a number?",
        "explanation": "Union types use the `|` operator: `string | number`.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "let x: string | number", "is_correct": True},
            {"label": "B", "text": "let x: string & number", "is_correct": False},
            {"label": "C", "text": "let x: string + number", "is_correct": False},
            {"label": "D", "text": "let x: any", "is_correct": False},
        ],
    },
    {
        "technology": "TypeScript", "skill": "Generics",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What are generics used for in TypeScript?",
        "body": "What is the primary purpose of generics in TypeScript?",
        "explanation": "Generics allow you to write reusable components that work with multiple types while maintaining type safety.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "To create reusable components that work with multiple types while preserving type safety", "is_correct": True},
            {"label": "B", "text": "To make all types nullable", "is_correct": False},
            {"label": "C", "text": "To convert JavaScript to TypeScript", "is_correct": False},
            {"label": "D", "text": "To remove type checking", "is_correct": False},
        ],
    },
    # ── Java ──────────────────────────────────────────────────────────
    {
        "technology": "Java", "skill": "Core Java",
        "type": "mcq", "difficulty": "beginner",
        "title": "What is the entry point of a Java application?",
        "body": "Which method signature is the entry point of a standard Java application?",
        "explanation": "The JVM looks for a `public static void main(String[] args)` method to start execution.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "public static void main(String[] args)", "is_correct": True},
            {"label": "B", "text": "public void main(String args)", "is_correct": False},
            {"label": "C", "text": "static void main()", "is_correct": False},
            {"label": "D", "text": "public static int main(String[] args)", "is_correct": False},
        ],
    },
    {
        "technology": "Java", "skill": "Collections Framework",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is the difference between ArrayList and LinkedList?",
        "body": "Which statement best describes the key difference between `ArrayList` and `LinkedList` in Java?",
        "explanation": "ArrayList uses a dynamic array (fast random access, O(1) get), while LinkedList uses a doubly-linked list (fast insertions/deletions, O(1) add at ends).",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "ArrayList provides O(1) random access; LinkedList provides O(1) insertions/deletions at ends", "is_correct": True},
            {"label": "B", "text": "They are identical in performance", "is_correct": False},
            {"label": "C", "text": "LinkedList provides O(1) random access", "is_correct": False},
            {"label": "D", "text": "ArrayList is thread-safe, LinkedList is not", "is_correct": False},
        ],
    },
    {
        "technology": "Java", "skill": "Multithreading",
        "type": "mcq", "difficulty": "advanced",
        "title": "What does the `synchronized` keyword do?",
        "body": "What is the effect of using the `synchronized` keyword in Java?",
        "explanation": "The `synchronized` keyword ensures that only one thread can execute the synchronized block/method at a time, preventing race conditions.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "Ensures only one thread can execute the block at a time", "is_correct": True},
            {"label": "B", "text": "Makes the method run faster", "is_correct": False},
            {"label": "C", "text": "Allows multiple threads to access simultaneously", "is_correct": False},
            {"label": "D", "text": "Stops all other threads permanently", "is_correct": False},
        ],
    },
    # ── React ─────────────────────────────────────────────────────────
    {
        "technology": "React", "skill": "Hooks (useState, useEffect)",
        "type": "mcq", "difficulty": "beginner",
        "title": "What does `useState` return?",
        "body": "What does the `useState` hook return in React?",
        "explanation": "`useState` returns an array with two elements: the current state value and a setter function to update it.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "An array with the current state value and a setter function", "is_correct": True},
            {"label": "B", "text": "Only the current state value", "is_correct": False},
            {"label": "C", "text": "A Promise", "is_correct": False},
            {"label": "D", "text": "An object with get and set methods", "is_correct": False},
        ],
    },
    {
        "technology": "React", "skill": "Components & JSX",
        "type": "mcq", "difficulty": "beginner",
        "title": "What is JSX?",
        "body": "What is JSX in React?",
        "explanation": "JSX is a syntax extension for JavaScript that looks like HTML and is used to describe the UI in React components.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "A syntax extension that lets you write HTML-like code in JavaScript", "is_correct": True},
            {"label": "B", "text": "A new programming language", "is_correct": False},
            {"label": "C", "text": "A CSS framework", "is_correct": False},
            {"label": "D", "text": "A database query language", "is_correct": False},
        ],
    },
    {
        "technology": "React", "skill": "State Management",
        "type": "mcq", "difficulty": "intermediate",
        "title": "When should you use useReducer over useState?",
        "body": "In which scenario is `useReducer` preferred over `useState`?",
        "explanation": "`useReducer` is preferred when state logic is complex, involves multiple sub-values, or when the next state depends on the previous one.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "When state logic is complex or involves multiple related values", "is_correct": True},
            {"label": "B", "text": "When you only need a single boolean toggle", "is_correct": False},
            {"label": "C", "text": "When you want to avoid re-renders", "is_correct": False},
            {"label": "D", "text": "When dealing with CSS styles", "is_correct": False},
        ],
    },
    # ── SQL ────────────────────────────────────────────────────────────
    {
        "technology": "SQL", "skill": "SELECT & Joins",
        "type": "mcq", "difficulty": "beginner",
        "title": "What does INNER JOIN return?",
        "body": "What rows does an `INNER JOIN` return?",
        "explanation": "An INNER JOIN returns only the rows where there is a matching value in both tables.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "Only rows that have matching values in both tables", "is_correct": True},
            {"label": "B", "text": "All rows from both tables", "is_correct": False},
            {"label": "C", "text": "All rows from the left table", "is_correct": False},
            {"label": "D", "text": "Only rows from the right table", "is_correct": False},
        ],
    },
    {
        "technology": "SQL", "skill": "Aggregations",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is the difference between WHERE and HAVING?",
        "body": "What is the key difference between `WHERE` and `HAVING` in SQL?",
        "explanation": "`WHERE` filters rows before grouping, while `HAVING` filters groups after aggregation.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "WHERE filters rows before GROUP BY; HAVING filters groups after aggregation", "is_correct": True},
            {"label": "B", "text": "They are interchangeable", "is_correct": False},
            {"label": "C", "text": "WHERE works only with numbers", "is_correct": False},
            {"label": "D", "text": "HAVING filters rows before GROUP BY", "is_correct": False},
        ],
    },
    {
        "technology": "SQL", "skill": "Window Functions",
        "type": "mcq", "difficulty": "advanced",
        "title": "What does ROW_NUMBER() do?",
        "body": "What is the purpose of the `ROW_NUMBER()` window function in SQL?",
        "explanation": "`ROW_NUMBER()` assigns a unique sequential integer to each row within a partition, ordered by the specified column(s).",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "Assigns a unique sequential number to each row within a partition", "is_correct": True},
            {"label": "B", "text": "Returns the total number of rows in a table", "is_correct": False},
            {"label": "C", "text": "Deletes duplicate rows", "is_correct": False},
            {"label": "D", "text": "Counts all rows matching a condition", "is_correct": False},
        ],
    },
    # ── Docker ────────────────────────────────────────────────────────
    {
        "technology": "Docker", "skill": "Dockerfiles",
        "type": "mcq", "difficulty": "beginner",
        "title": "What does the FROM instruction do in a Dockerfile?",
        "body": "What is the purpose of the `FROM` instruction in a Dockerfile?",
        "explanation": "`FROM` specifies the base image for the Docker build. Every Dockerfile must start with a FROM instruction.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "Specifies the base image for the build", "is_correct": True},
            {"label": "B", "text": "Copies files into the container", "is_correct": False},
            {"label": "C", "text": "Sets environment variables", "is_correct": False},
            {"label": "D", "text": "Starts the container", "is_correct": False},
        ],
    },
    {
        "technology": "Docker", "skill": "Docker Compose",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What does `docker compose up -d` do?",
        "body": "What is the effect of running `docker compose up -d`?",
        "explanation": "The `-d` flag runs the containers in detached mode (in the background).",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "Starts all services defined in the Compose file in detached (background) mode", "is_correct": True},
            {"label": "B", "text": "Destroys all containers", "is_correct": False},
            {"label": "C", "text": "Downloads images only", "is_correct": False},
            {"label": "D", "text": "Starts in debug mode", "is_correct": False},
        ],
    },
    # ── Git ────────────────────────────────────────────────────────────
    {
        "technology": "Git", "skill": "Branching & Merging",
        "type": "mcq", "difficulty": "beginner",
        "title": "What does `git merge` do?",
        "body": "What is the purpose of the `git merge` command?",
        "explanation": "`git merge` integrates changes from one branch into the current branch.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "Integrates changes from one branch into the current branch", "is_correct": True},
            {"label": "B", "text": "Deletes a branch", "is_correct": False},
            {"label": "C", "text": "Creates a new branch", "is_correct": False},
            {"label": "D", "text": "Undoes the last commit", "is_correct": False},
        ],
    },
    # ── AWS ────────────────────────────────────────────────────────────
    {
        "technology": "AWS", "skill": "S3",
        "type": "mcq", "difficulty": "beginner",
        "title": "What is Amazon S3?",
        "body": "What is the primary purpose of Amazon S3 (Simple Storage Service)?",
        "explanation": "Amazon S3 is an object storage service designed for storing and retrieving any amount of data from anywhere on the web.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "Object storage service for storing and retrieving data", "is_correct": True},
            {"label": "B", "text": "A relational database service", "is_correct": False},
            {"label": "C", "text": "A compute service for running servers", "is_correct": False},
            {"label": "D", "text": "A DNS management service", "is_correct": False},
        ],
    },
    {
        "technology": "AWS", "skill": "Lambda",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is AWS Lambda?",
        "body": "What is the key feature of AWS Lambda?",
        "explanation": "AWS Lambda is a serverless compute service that runs code in response to events without provisioning or managing servers.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "Serverless compute that runs code in response to events without managing servers", "is_correct": True},
            {"label": "B", "text": "A managed virtual machine service", "is_correct": False},
            {"label": "C", "text": "A container orchestration platform", "is_correct": False},
            {"label": "D", "text": "A storage service", "is_correct": False},
        ],
    },
    # ── System Design ─────────────────────────────────────────────────
    {
        "technology": "System Design", "skill": "Scalability",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is horizontal scaling?",
        "body": "What is the difference between horizontal and vertical scaling?",
        "explanation": "Horizontal scaling adds more machines to distribute load, while vertical scaling increases the resources (CPU, RAM) of a single machine.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "Horizontal: add more machines; Vertical: add more resources to one machine", "is_correct": True},
            {"label": "B", "text": "They are the same concept", "is_correct": False},
            {"label": "C", "text": "Horizontal: add more CPU; Vertical: add more machines", "is_correct": False},
            {"label": "D", "text": "Horizontal scaling is always worse", "is_correct": False},
        ],
    },
    {
        "technology": "System Design", "skill": "Caching",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is a cache invalidation strategy?",
        "body": "Which is a common cache invalidation strategy?",
        "explanation": "TTL (Time-To-Live) automatically expires cached data after a set duration. Write-through updates the cache when the database is updated.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "TTL (Time-To-Live) and Write-Through", "is_correct": True},
            {"label": "B", "text": "Deleting the entire cache on every request", "is_correct": False},
            {"label": "C", "text": "Never invalidating the cache", "is_correct": False},
            {"label": "D", "text": "Restarting the server", "is_correct": False},
        ],
    },
    # ── Data Structures & Algorithms ──────────────────────────────────
    {
        "technology": "Data Structures & Algorithms", "skill": "Big O Analysis",
        "type": "mcq", "difficulty": "beginner",
        "title": "What is O(n) time complexity?",
        "body": "What does O(n) time complexity mean?",
        "explanation": "O(n) means the algorithm's runtime grows linearly with the input size.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "Runtime grows linearly with input size", "is_correct": True},
            {"label": "B", "text": "Runtime is constant regardless of input", "is_correct": False},
            {"label": "C", "text": "Runtime grows quadratically", "is_correct": False},
            {"label": "D", "text": "Runtime grows logarithmically", "is_correct": False},
        ],
    },
    {
        "technology": "Data Structures & Algorithms", "skill": "Hash Tables",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is the average time complexity of hash table lookup?",
        "body": "What is the average-case time complexity for looking up a key in a hash table?",
        "explanation": "Hash tables provide O(1) average-case lookup through direct indexing via a hash function.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "O(1)", "is_correct": True},
            {"label": "B", "text": "O(n)", "is_correct": False},
            {"label": "C", "text": "O(log n)", "is_correct": False},
            {"label": "D", "text": "O(n²)", "is_correct": False},
        ],
    },
    {
        "technology": "Data Structures & Algorithms", "skill": "Dynamic Programming",
        "type": "mcq", "difficulty": "advanced",
        "title": "What is memoization?",
        "body": "What is memoization in the context of dynamic programming?",
        "explanation": "Memoization is a technique of caching the results of expensive function calls to avoid redundant computations.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "Caching results of expensive function calls to avoid redundant computation", "is_correct": True},
            {"label": "B", "text": "Writing notes about the algorithm", "is_correct": False},
            {"label": "C", "text": "Storing data in a database", "is_correct": False},
            {"label": "D", "text": "A sorting technique", "is_correct": False},
        ],
    },
    # ── Go ────────────────────────────────────────────────────────────
    {
        "technology": "Go", "skill": "Goroutines & Channels",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is a goroutine?",
        "body": "What is a goroutine in Go?",
        "explanation": "A goroutine is a lightweight thread of execution managed by the Go runtime, started with the `go` keyword.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "A lightweight thread of execution managed by the Go runtime", "is_correct": True},
            {"label": "B", "text": "A system-level thread", "is_correct": False},
            {"label": "C", "text": "A type of loop", "is_correct": False},
            {"label": "D", "text": "A package manager", "is_correct": False},
        ],
    },
    # ── MongoDB ───────────────────────────────────────────────────────
    {
        "technology": "MongoDB", "skill": "CRUD Operations",
        "type": "mcq", "difficulty": "beginner",
        "title": "Which method inserts a document in MongoDB?",
        "body": "Which MongoDB method is used to insert a single document into a collection?",
        "explanation": "`insertOne()` inserts a single document into a MongoDB collection.",
        "time_limit_seconds": 60, "max_score": 5,
        "options": [
            {"label": "A", "text": "insertOne()", "is_correct": True},
            {"label": "B", "text": "addDocument()", "is_correct": False},
            {"label": "C", "text": "insert()", "is_correct": False},
            {"label": "D", "text": "create()", "is_correct": False},
        ],
    },
    # ── Kubernetes ────────────────────────────────────────────────────
    {
        "technology": "Kubernetes", "skill": "Pods & Deployments",
        "type": "mcq", "difficulty": "intermediate",
        "title": "What is a Pod in Kubernetes?",
        "body": "What is the smallest deployable unit in Kubernetes?",
        "explanation": "A Pod is the smallest deployable unit in Kubernetes. It can contain one or more containers that share storage and network.",
        "time_limit_seconds": 90, "max_score": 10,
        "options": [
            {"label": "A", "text": "A Pod — one or more containers sharing storage and network", "is_correct": True},
            {"label": "B", "text": "A Container", "is_correct": False},
            {"label": "C", "text": "A Node", "is_correct": False},
            {"label": "D", "text": "A Cluster", "is_correct": False},
        ],
    },
]


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

        # Seed taxonomy (upsert — adds missing technologies and skills)
        tech_count = 0
        skill_count = 0
        for tech_name, tech_data in TAXONOMY_DATA.items():
            existing = await session.execute(
                select(Technology).where(Technology.name == tech_name, Technology.organization_id == None)
            )
            tech = existing.scalar_one_or_none()
            if not tech:
                tech = Technology(name=tech_name, category=tech_data["category"])
                session.add(tech)
                await session.flush()
                await session.refresh(tech)
                tech_count += 1

            for skill_name in tech_data["skills"]:
                existing_skill = await session.execute(
                    select(Skill).where(Skill.technology_id == tech.id, Skill.name == skill_name)
                )
                if not existing_skill.scalar_one_or_none():
                    session.add(Skill(technology_id=tech.id, name=skill_name))
                    skill_count += 1

        await session.flush()
        if tech_count or skill_count:
            print(f"Taxonomy seeded: {tech_count} new technologies, {skill_count} new skills")
        else:
            print("Taxonomy already up to date.")

        # Seed questions
        existing_q = await session.execute(select(Question).limit(1))
        if existing_q.scalar_one_or_none():
            print("Questions already seeded. Skipping.")
        else:
            # Build a lookup of technology+skill → skill_id
            tech_result = await session.execute(select(Technology))
            tech_map = {t.name: t for t in tech_result.scalars().all()}

            skill_result = await session.execute(select(Skill))
            skill_map = {}  # (tech_id, skill_name) -> skill
            for s in skill_result.scalars().all():
                skill_map[(s.technology_id, s.name)] = s

            q_count = 0
            for q_data in QUESTIONS_DATA:
                tech = tech_map.get(q_data["technology"])
                if not tech:
                    print(f"  ⚠ Technology '{q_data['technology']}' not found, skipping question")
                    continue

                skill = skill_map.get((tech.id, q_data["skill"]))

                question = Question(
                    type=q_data["type"],
                    difficulty=q_data["difficulty"],
                    title=q_data["title"],
                    body=q_data["body"],
                    explanation=q_data.get("explanation"),
                    time_limit_seconds=q_data.get("time_limit_seconds"),
                    max_score=q_data.get("max_score", 10.0),
                    organization_id=None,  # global / platform-level
                )
                session.add(question)
                await session.flush()

                # Add options
                for idx, opt in enumerate(q_data.get("options", [])):
                    option = QuestionOption(
                        question_id=question.id,
                        label=opt["label"],
                        text=opt["text"],
                        is_correct=opt["is_correct"],
                        order_index=idx,
                    )
                    session.add(option)

                # Tag with skill
                if skill:
                    tag = QuestionTag(
                        question_id=question.id,
                        skill_id=skill.id,
                    )
                    session.add(tag)

                q_count += 1

            await session.flush()
            print(f"Questions seeded: {q_count} questions")

        await session.commit()
        print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
