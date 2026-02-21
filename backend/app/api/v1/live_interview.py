"""Live Interview API endpoints.

Provides endpoints for creating, managing, and conducting live technical interviews
with real-time collaborative coding.
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.db.session import get_db
from app.models.user import User

router = APIRouter(tags=["live-interview"])


# ---------------------------------------------------------------------------
# In-memory room management (for MVP; move to Redis for production)
# ---------------------------------------------------------------------------

class InterviewRoom:
    """Manages an active live interview room."""

    def __init__(self, room_id: str, interviewer_id: str, candidate_name: str, candidate_email: str):
        self.room_id = room_id
        self.interviewer_id = interviewer_id
        self.candidate_name = candidate_name
        self.candidate_email = candidate_email
        self.created_at = datetime.now(timezone.utc)
        self.ended_at = None
        self.status = "active"
        self.code = ""
        self.language = "python"
        self.notes: list[dict] = []
        self.chat_messages: list[dict] = []
        self.code_history: list[dict] = []
        self.connections: list[WebSocket] = []
        self.overall_rating: int | None = None

    def to_dict(self):
        return {
            "room_id": self.room_id,
            "interviewer_id": self.interviewer_id,
            "candidate_name": self.candidate_name,
            "candidate_email": self.candidate_email,
            "status": self.status,
            "language": self.language,
            "created_at": self.created_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "notes_count": len(self.notes),
            "overall_rating": self.overall_rating,
        }


# In-memory store
_rooms: dict[str, InterviewRoom] = {}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateInterviewRequest(BaseModel):
    candidate_name: str
    candidate_email: str
    language: str = "python"


class InterviewNoteRequest(BaseModel):
    content: str
    rating: int | None = None  # 1-5
    tag: str | None = None  # "positive", "negative", "neutral"


class EndInterviewRequest(BaseModel):
    overall_rating: int | None = None  # 1-5
    summary: str | None = None


# ---------------------------------------------------------------------------
# POST /live-interview/create
# ---------------------------------------------------------------------------

@router.post("/create")
async def create_interview(
    body: CreateInterviewRequest,
    user: User = Depends(require_roles("admin", "hr", "tech")),
):
    """Create a new live interview room."""
    room_id = str(uuid4())[:8]
    room = InterviewRoom(
        room_id=room_id,
        interviewer_id=str(user.id),
        candidate_name=body.candidate_name,
        candidate_email=body.candidate_email,
    )
    room.language = body.language
    _rooms[room_id] = room

    return {
        "room_id": room_id,
        "join_url": f"/interview/{room_id}",
        "candidate_join_url": f"/interview/{room_id}/candidate",
        **room.to_dict(),
    }


# ---------------------------------------------------------------------------
# GET /live-interview/{room_id}
# ---------------------------------------------------------------------------

@router.get("/{room_id}")
async def get_interview(room_id: str):
    """Get interview room details."""
    room = _rooms.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Interview room not found")
    return room.to_dict()


# ---------------------------------------------------------------------------
# GET /live-interview/
# ---------------------------------------------------------------------------

@router.get("/")
async def list_interviews(
    user: User = Depends(require_roles("admin", "hr", "tech")),
):
    """List all interview rooms for the current user."""
    user_rooms = [
        r.to_dict()
        for r in _rooms.values()
        if r.interviewer_id == str(user.id)
    ]
    return {"rooms": user_rooms, "total": len(user_rooms)}


# ---------------------------------------------------------------------------
# POST /live-interview/{room_id}/notes
# ---------------------------------------------------------------------------

@router.post("/{room_id}/notes")
async def add_interview_note(
    room_id: str,
    body: InterviewNoteRequest,
    user: User = Depends(require_roles("admin", "hr", "tech")),
):
    """Add an interviewer note to the session."""
    room = _rooms.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Interview room not found")

    note = {
        "id": str(uuid4()),
        "content": body.content,
        "rating": body.rating,
        "tag": body.tag,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "author_id": str(user.id),
    }
    room.notes.append(note)

    return {"note": note, "total_notes": len(room.notes)}


# ---------------------------------------------------------------------------
# GET /live-interview/{room_id}/notes
# ---------------------------------------------------------------------------

@router.get("/{room_id}/notes")
async def get_interview_notes(
    room_id: str,
    user: User = Depends(require_roles("admin", "hr", "tech")),
):
    """Get all notes for an interview session."""
    room = _rooms.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Interview room not found")
    return {"notes": room.notes, "total": len(room.notes)}


# ---------------------------------------------------------------------------
# POST /live-interview/{room_id}/end
# ---------------------------------------------------------------------------

@router.post("/{room_id}/end")
async def end_interview(
    room_id: str,
    body: EndInterviewRequest,
    user: User = Depends(require_roles("admin", "hr", "tech")),
):
    """End the interview session with an optional summary and rating."""
    room = _rooms.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Interview room not found")

    room.status = "ended"
    room.ended_at = datetime.now(timezone.utc)
    room.overall_rating = body.overall_rating

    if body.summary:
        room.notes.append({
            "id": str(uuid4()),
            "content": f"[SUMMARY] {body.summary}",
            "rating": body.overall_rating,
            "tag": "summary",
            "timestamp": room.ended_at.isoformat(),
            "author_id": str(user.id),
        })

    # Close all WebSocket connections
    for ws in room.connections:
        try:
            await ws.close()
        except Exception:
            pass
    room.connections.clear()

    return {
        **room.to_dict(),
        "code_snapshots": len(room.code_history),
        "chat_messages": len(room.chat_messages),
    }


# ---------------------------------------------------------------------------
# WebSocket /live-interview/{room_id}/ws
# ---------------------------------------------------------------------------

@router.websocket("/{room_id}/ws")
async def interview_websocket(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for real-time code collaboration.

    Message types:
    - code_update: {type: "code_update", code: str, language: str}
    - cursor_move: {type: "cursor_move", line: int, column: int}
    - chat_message: {type: "chat_message", sender: str, message: str}
    - execution_request: {type: "execution_request", code: str, language: str}
    """
    room = _rooms.get(room_id)
    if not room or room.status != "active":
        await websocket.close(code=4004)
        return

    await websocket.accept()
    room.connections.append(websocket)

    # Send current state
    await websocket.send_json({
        "type": "room_state",
        "code": room.code,
        "language": room.language,
        "participants": len(room.connections),
    })

    # Broadcast join
    for conn in room.connections:
        if conn != websocket:
            try:
                await conn.send_json({
                    "type": "participant_joined",
                    "participants": len(room.connections),
                })
            except Exception:
                pass

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "code_update":
                room.code = data.get("code", "")
                room.language = data.get("language", room.language)
                room.code_history.append({
                    "code": room.code,
                    "language": room.language,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                # Broadcast to other connections
                for conn in room.connections:
                    if conn != websocket:
                        try:
                            await conn.send_json(data)
                        except Exception:
                            pass

            elif msg_type == "chat_message":
                data["timestamp"] = datetime.now(timezone.utc).isoformat()
                room.chat_messages.append(data)
                for conn in room.connections:
                    if conn != websocket:
                        try:
                            await conn.send_json(data)
                        except Exception:
                            pass

            elif msg_type == "cursor_move":
                for conn in room.connections:
                    if conn != websocket:
                        try:
                            await conn.send_json(data)
                        except Exception:
                            pass

            elif msg_type == "execution_request":
                # Execute code in sandbox
                try:
                    from app.services.sandbox import sandbox_executor
                    result = await sandbox_executor.execute(
                        code=data.get("code", ""),
                        language=data.get("language", "python"),
                        stdin=data.get("stdin", ""),
                    )
                    exec_result = {
                        "type": "execution_result",
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                        "exit_code": result.exit_code,
                        "execution_time_ms": result.execution_time_ms,
                        "timed_out": result.timed_out,
                    }
                    # Send to all participants
                    for conn in room.connections:
                        try:
                            await conn.send_json(exec_result)
                        except Exception:
                            pass
                except Exception as e:
                    await websocket.send_json({
                        "type": "execution_error",
                        "error": str(e),
                    })

    except WebSocketDisconnect:
        room.connections.remove(websocket)
        # Broadcast leave
        for conn in room.connections:
            try:
                await conn.send_json({
                    "type": "participant_left",
                    "participants": len(room.connections),
                })
            except Exception:
                pass
