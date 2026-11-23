"""Import the scripts in this folder and keep every test offline."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
AGENTS = ROOT / "agents"
AGENT_NAMES = sorted(p.name for p in AGENTS.iterdir() if p.is_dir())
sys.path.insert(0, str(ROOT))


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    """No real key in tests, so nothing can reach the API by accident."""
    monkeypatch.delenv("SMALLEST_API_KEY", raising=False)
