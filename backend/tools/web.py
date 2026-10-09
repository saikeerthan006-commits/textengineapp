"""Small keyless web search adapter used by the TexDEV search tool."""
from __future__ import annotations

from html.parser import HTMLParser
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import requests


class _Results(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.items: list[dict[str, str]] = []
        self._current: dict[str, str] | None = None
        self._capture = ""
        self._target: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = (values.get("class", "") or "").split()
        if tag == "a" and "result-link" in classes:
            self._current = {"title": "", "url": values.get("href", "") or "", "snippet": ""}
            self._capture = "title"
            self._target = self._current
        elif tag == "td" and "result-snippet" in classes and self.items:
            self._capture = "snippet"
            self._target = self.items[-1]

    def handle_data(self, data: str) -> None:
        if self._target and self._capture:
            self._target[self._capture] += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._current and self._capture == "title":
            parsed = urlparse(self._current["url"])
            if parsed.netloc.endswith("duckduckgo.com"):
                target = parse_qs(parsed.query).get("uddg", [""])[0]
                if target:
                    self._current["url"] = unquote(target)
            if self._current["title"].strip() and self._current["url"].startswith("http"):
                self.items.append({key: value.strip() for key, value in self._current.items()})
            self._current = None
            self._capture = ""
            self._target = None
        elif tag == "td" and self._capture == "snippet":
            self._capture = ""
            self._target = None


def search_web(query: str) -> list[dict[str, str]]:
    query = str(query or "").strip()[:300]
    if not query:
        raise ValueError("Search query cannot be empty.")
    response = requests.get(
        f"https://lite.duckduckgo.com/lite/?q={quote_plus(query)}",
        headers={"User-Agent": "Mozilla/5.0 (compatible; TexDEV/1.0)", "Accept": "text/html"},
        timeout=(8, 20),
    )
    response.raise_for_status()
    parser = _Results()
    parser.feed(response.text)
    results = parser.items[:6]
    if not results:
        raise RuntimeError("The search provider returned no readable results. Try again or rephrase the query.")
    return results
