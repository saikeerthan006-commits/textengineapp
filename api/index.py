"""Route Vercel API requests into the existing Flask service."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("TEXDEV_WORKSPACE", "/tmp/texengine-workspace")

from app import app as flask_app  # noqa: E402


def app(environ, start_response):
    """Restore the original /api route after Vercel's function rewrite."""
    query = parse_qsl(environ.get("QUERY_STRING", ""), keep_blank_values=True)
    route = next((value for key, value in query if key == "__route"), "")
    if route:
        environ = environ.copy()
        environ["PATH_INFO"] = "/api/" + route.lstrip("/")
        environ["QUERY_STRING"] = urlencode([(key, value) for key, value in query if key != "__route"])
    return flask_app(environ, start_response)
