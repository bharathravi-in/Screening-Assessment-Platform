# Intelligent Technical Screening & Assessment Platform

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Python + FastAPI
- **Database**: PostgreSQL (SQLAlchemy async + Alembic)
- **AI**: Multi-provider (OpenAI, Anthropic, Gemini) with LangGraph agents
- **Code Sandbox**: Docker-based isolated execution
- **Auth**: Custom JWT

## Quick Start

```bash
# Start all services
make dev

# Or manually:
docker-compose up -d db
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

## Services
| Service | Port |
|---------|------|
| Frontend | 5173 |
| Backend | 8000 |
| PostgreSQL | 5432 |
# Screening-Assessment-Platform
