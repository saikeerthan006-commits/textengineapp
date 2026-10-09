"""Creation of downloadable source-code files in the controlled artifact directory."""
from __future__ import annotations

from pathlib import Path

from tools.artifacts import ARTIFACT_DIR, register_artifact, safe_filename

LANGUAGES = {
    "python": ("py", "Python"), "javascript": ("js", "JavaScript"), "js": ("js", "JavaScript"),
    "typescript": ("ts", "TypeScript"), "ts": ("ts", "TypeScript"), "jsx": ("jsx", "JavaScript React"),
    "tsx": ("tsx", "TypeScript React"), "java": ("java", "Java"), "c": ("c", "C"),
    "c++": ("cpp", "C++"), "cpp": ("cpp", "C++"), "c#": ("cs", "C#"), "csharp": ("cs", "C#"),
    "go": ("go", "Go"), "golang": ("go", "Go"), "rust": ("rs", "Rust"), "php": ("php", "PHP"),
    "ruby": ("rb", "Ruby"), "swift": ("swift", "Swift"), "kotlin": ("kt", "Kotlin"),
    "sql": ("sql", "SQL"), "html": ("html", "HTML"), "css": ("css", "CSS"),
    "shell": ("sh", "Shell"), "bash": ("sh", "Shell"), "powershell": ("ps1", "PowerShell"),
    "r": ("r", "R"), "dart": ("dart", "Dart"), "scala": ("scala", "Scala"),
    "lua": ("lua", "Lua"), "perl": ("pl", "Perl"),
    "json": ("json", "JSON"), "markdown": ("md", "Markdown"), "yaml": ("yaml", "YAML"),
}


def create_code_file(filename: str, language: str, content: str) -> dict:
    selected = LANGUAGES.get(str(language or "").strip().lower())
    if not selected:
        raise ValueError("Choose a supported source-code language.")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("The generated code file cannot be empty.")
    if len(content.encode("utf-8")) > 1_000_000:
        raise ValueError("The generated code file exceeds the 1 MB limit.")
    extension, display_language = selected
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = safe_filename(filename, extension)
    path = (ARTIFACT_DIR / safe_name).resolve()
    if path.parent != ARTIFACT_DIR:
        raise ValueError("The filename is outside the artifact directory.")
    path.write_text(content, encoding="utf-8", newline="")
    artifact = register_artifact(path, safe_name, "code", display_language)
    return {"success": True, **artifact}
