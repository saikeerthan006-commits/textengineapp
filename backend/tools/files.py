import os
from pathlib import Path
from flask import has_request_context, g


def workspace_root() -> Path:
    configured = Path(os.getenv("TEXDEV_WORKSPACE", "./workspace/project_001"))
    root = configured if configured.is_absolute() else Path(__file__).resolve().parents[1] / configured
    if has_request_context() and getattr(g, "user_id", None):
        root = root / "users" / g.user_id
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def resolve_workspace_path(path: str = ".") -> Path:
    root = workspace_root()
    target = (root / path).resolve()
    if target != root and root not in target.parents:
        raise ValueError("Path is outside the configured workspace.")
    return target


def list_files(path: str = ".") -> list[dict[str, str]]:
    folder = resolve_workspace_path(path)
    if not folder.is_dir():
        raise NotADirectoryError(path)
    return [{"name": item.name, "path": str(item.relative_to(workspace_root())), "kind": "directory" if item.is_dir() else "file"} for item in sorted(folder.iterdir()) if not item.name.startswith(".")]


def list_workspace_files(max_files: int = 250) -> list[dict[str, str | int]]:
    root = workspace_root()
    found: list[dict[str, str | int]] = []
    for item in sorted(root.rglob("*")):
        relative = item.relative_to(root)
        if any(part.startswith(".") or part in {"node_modules", "dist", "build", "__pycache__"} for part in relative.parts):
            continue
        try:
            resolved = resolve_workspace_path(str(relative))
            if not resolved.is_file():
                continue
            found.append({"name": resolved.name, "path": str(relative).replace("\\", "/"), "size": resolved.stat().st_size})
            if len(found) >= max_files:
                break
        except (OSError, ValueError):
            continue
    return found


def read_file(path: str, max_bytes: int = 200_000) -> str:
    target = resolve_workspace_path(path)
    if not target.is_file() or target.stat().st_size > max_bytes:
        raise ValueError("File is missing or exceeds the read limit.")
    return target.read_text(encoding="utf-8")


def write_file(path: str, content: str) -> None:
    target = resolve_workspace_path(path)
    if len(content.encode("utf-8")) > 500_000:
        raise ValueError("File exceeds the write limit.")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
