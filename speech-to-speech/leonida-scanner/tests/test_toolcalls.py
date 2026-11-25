"""The channel 6 tool-call panel shows what Hydra asked for and what the map answered."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_tool_call_formatting() -> None:
    proc = subprocess.run(["node", str(ROOT / "tests/js/toolcalls.mjs")], capture_output=True, text=True, timeout=60, check=False)
    assert proc.returncode == 0, proc.stderr[-2000:]
    out = json.loads(proc.stdout)
    assert out["args"][:2] == ['{"place":"Ocean Drive"}', "{}"]
    assert out["args"][2] == 60
    assert out["unknown"] == "unknown place, suggest Seagrape Expressway"
    assert out["moved"] == "place: Coquina Row · eta_s: 6 · action: heading to"
    assert out["report"] == "over: Mango Heights · spotlight: on"
    assert out["bare"] == "failed"
    assert out["clocks"] == ["0:00", "1:05", "0:00"]
    assert out["order"] == [10, 9, 8, 7, 6, 5, 4, 3]
