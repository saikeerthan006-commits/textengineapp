import os
import subprocess
import sys
from tools.files import workspace_root

ALLOWED_COMMANDS = {"npm run build": ["npm", "run", "build"], "python -m compileall .": ["python", "-m", "compileall", "."]}


def run_command(command: str, timeout: int = 60) -> dict[str, str | int]:
    """Run one exact allowlisted command, with no shell, inside the workspace."""
    argv = ALLOWED_COMMANDS.get(command)
    if not argv:
        raise ValueError("Command is not in the local prototype allowlist.")
    if os.name == "nt" and command == "npm run build":
        argv = ["cmd.exe", "/d", "/s", "/c", "npm.cmd run build"]
    elif command == "python -m compileall .":
        argv = [sys.executable, "-m", "compileall", "."]
    result = subprocess.run(argv, cwd=workspace_root(), capture_output=True, text=True, timeout=min(max(timeout, 1), 120), shell=False)
    return {"returncode": result.returncode, "stdout": result.stdout[-12000:], "stderr": result.stderr[-12000:]}
