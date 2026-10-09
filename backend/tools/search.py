from tools.files import resolve_workspace_path, workspace_root


def search_files(query: str, path: str = ".", max_results: int = 100) -> list[dict[str, str]]:
    if not query:
        return []
    base = resolve_workspace_path(path)
    results = []
    for file in base.rglob("*"):
        if not file.is_file() or any(part.startswith(".") or part in {"node_modules", "dist", "build"} for part in file.relative_to(workspace_root()).parts):
            continue
        try:
            for number, line in enumerate(file.read_text(encoding="utf-8").splitlines(), 1):
                if query.casefold() in line.casefold():
                    results.append({"path": str(file.relative_to(workspace_root())), "line": str(number), "text": line[:500]})
                    if len(results) >= max_results:
                        return results
        except (UnicodeDecodeError, OSError):
            continue
    return results
