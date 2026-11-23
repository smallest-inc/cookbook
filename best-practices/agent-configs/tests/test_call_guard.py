"""test_call.py: the guards that run before any call is placed."""

from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

import test_call

IST = ZoneInfo("Asia/Kolkata")
NUMBER = "+15550000000"  # fictional


def at(hour, minute=0):
    return datetime(2026, 11, 23, hour, minute, tzinfo=IST)


@pytest.mark.parametrize(
    ("hour", "minute", "ok"),
    [
        (7, 59, False),
        (8, 0, True),
        (13, 30, True),
        (18, 59, True),
        (19, 0, False),
        (23, 0, False),
    ],
)
def test_rbi_call_window(hour, minute, ok):
    assert test_call.within_call_window(at(hour, minute)) is ok


class FakeClient:
    def __init__(self):
        self.calls = []
        self.atoms = SimpleNamespace(
            calls=SimpleNamespace(start_outbound_call=self._start)
        )

    def _start(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(data=SimpleNamespace(conversation_id="conv_test_1"))


@pytest.fixture
def agent_id_file(tmp_path, monkeypatch):
    path = tmp_path / ".created_agent_id"
    path.write_text("new_agent_0001\n", encoding="utf-8")
    monkeypatch.setattr(test_call, "ID_FILE", path)
    monkeypatch.setattr("dotenv.load_dotenv", lambda *_a, **_k: False)
    return path


@pytest.mark.usefixtures("agent_id_file")
def test_outside_hours_refuses_before_anything_else(capsys):
    client = FakeClient()
    code = test_call.main(
        ["--to", NUMBER, "--i-own-this-number", "--call"], now=at(20), client=client
    )
    assert code == 3
    assert client.calls == []
    assert "08:00 and 19:00" in capsys.readouterr().err


@pytest.mark.usefixtures("agent_id_file")
def test_window_is_checked_in_the_callee_timezone():
    client = FakeClient()
    # 14:00 in India is 03:30 in New York, so a US number is refused
    code = test_call.main(
        [
            "--to",
            NUMBER,
            "--timezone",
            "America/New_York",
            "--i-own-this-number",
            "--call",
        ],
        now=at(14),
        client=client,
    )
    assert code == 3
    assert client.calls == []


@pytest.mark.usefixtures("agent_id_file")
def test_bad_number_is_refused():
    client = FakeClient()
    assert (
        test_call.main(
            ["--to", "98000 00000", "--i-own-this-number", "--call"],
            now=at(10),
            client=client,
        )
        == 2
    )
    assert client.calls == []


def test_needs_the_agent_you_created(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(test_call, "ID_FILE", tmp_path / "missing")
    client = FakeClient()
    assert (
        test_call.main(
            ["--to", NUMBER, "--i-own-this-number", "--call"], now=at(10), client=client
        )
        == 2
    )
    assert client.calls == []
    assert "create_agent.py loan-collections-hi-en --create" in capsys.readouterr().err


@pytest.mark.usefixtures("agent_id_file")
def test_dry_run_without_ownership_confirmation(capsys):
    client = FakeClient()
    assert test_call.main(["--to", NUMBER, "--call"], now=at(10), client=client) == 0
    assert client.calls == []
    out = capsys.readouterr().out
    assert "Dry run" in out
    assert NUMBER not in out  # the number is masked


@pytest.mark.usefixtures("agent_id_file")
def test_places_one_test_call_through_the_created_agent():
    client = FakeClient()
    code = test_call.main(
        ["--to", NUMBER, "--name", "Asha", "--i-own-this-number", "--call"],
        now=at(10),
        client=client,
    )
    assert code == 0
    assert len(client.calls) == 1
    call = client.calls[0]
    assert call["agent_id"] == "new_agent_0001"
    assert call["phone_number"] == NUMBER
    assert call["test_call"] == "true"
    assert call["variables"]["customer_name"] == "Asha"
