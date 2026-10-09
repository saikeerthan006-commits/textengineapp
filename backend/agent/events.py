import json
import uuid


def activity(message: str, status: str = "running", event_id: str | None = None) -> dict:
    return {"type": "activity", "id": event_id or str(uuid.uuid4()), "message": message, "status": status}


def event_frame(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
