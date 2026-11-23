"""Make the kit's modules importable and keep every test offline."""
import sys
from pathlib import Path

import pytest

KIT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KIT))

FIXTURES = KIT / "fixtures"


@pytest.fixture(autouse=True)
def _no_real_key(monkeypatch):
    """Tests never see a real key, so nothing can reach the API by accident."""
    monkeypatch.delenv("SMALLEST_API_KEY", raising=False)
