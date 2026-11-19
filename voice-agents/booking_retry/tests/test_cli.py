import json
from pathlib import Path

import pytest

import booking_retry

SAMPLE = str(Path(__file__).resolve().parents[1] / "contacts.sample.csv")
# a dummy value the tests assert is never printed
SECRET = "sk-test-DO-NOT-LEAK-12345"  # nosec B105


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for k in ("SMALLEST_API_KEY", "ATOMS_AGENT_ID", "BOOKING_ALLOWED_PREFIXES", "ATOMS_FROM_PRODUCT_ID"):
        monkeypatch.delenv(k, raising=False)


def run(*argv):
    return booking_retry.main(list(argv))


def test_run_refuses_without_the_consent_flag(capsys):
    assert run("run", "--contacts", SAMPLE) == 2
    assert "--i-have-consent" in capsys.readouterr().err


def test_run_refuses_without_allowed_prefixes(capsys, monkeypatch):
    monkeypatch.setenv("SMALLEST_API_KEY", SECRET)
    monkeypatch.setenv("ATOMS_AGENT_ID", "64b7f0c2a1b2c3d4e5f60718")
    assert run("run", "--contacts", SAMPLE, "--i-have-consent") == 2
    assert "BOOKING_ALLOWED_PREFIXES" in capsys.readouterr().err


def test_run_refuses_without_key_or_agent(capsys, monkeypatch):
    monkeypatch.setenv("BOOKING_ALLOWED_PREFIXES", "+1")
    assert run("run", "--contacts", SAMPLE, "--i-have-consent") == 2
    assert "SMALLEST_API_KEY" in capsys.readouterr().err
    monkeypatch.setenv("SMALLEST_API_KEY", SECRET)
    assert run("run", "--contacts", SAMPLE, "--i-have-consent") == 2
    assert "ATOMS_AGENT_ID" in capsys.readouterr().err


def test_run_rejects_a_bad_agent_id_and_never_prints_the_key(capsys, monkeypatch, tmp_path):
    monkeypatch.setenv("BOOKING_ALLOWED_PREFIXES", "+1")
    monkeypatch.setenv("SMALLEST_API_KEY", SECRET)
    monkeypatch.setenv("ATOMS_AGENT_ID", "not-an-id")
    assert run("run", "--contacts", SAMPLE, "--i-have-consent", "--db", str(tmp_path / "x.sqlite")) == 2
    out = capsys.readouterr()
    assert SECRET not in out.out + out.err


def test_run_rejects_a_bad_contacts_file(capsys, monkeypatch, tmp_path):
    monkeypatch.setenv("BOOKING_ALLOWED_PREFIXES", "+1")
    monkeypatch.setenv("SMALLEST_API_KEY", SECRET)
    monkeypatch.setenv("ATOMS_AGENT_ID", "64b7f0c2a1b2c3d4e5f60718")
    bad = tmp_path / "bad.csv"
    bad.write_text("id,name,phone,timezone,service,consent,consent_source\nc1,A,+12025550101,UTC,checkup,no,x\n")
    assert run("run", "--contacts", str(bad), "--i-have-consent") == 2
    assert "consent" in capsys.readouterr().err


def test_max_calls_is_bounded(capsys):
    assert run("run", "--contacts", SAMPLE, "--max-calls", "1000", "--i-have-consent") == 2


def test_policy_and_status_commands(capsys, tmp_path):
    assert run("policy") == 0
    assert "max attempts" in capsys.readouterr().out
    assert run("status", "--db", str(tmp_path / "empty.sqlite")) == 0


def test_simulate_never_needs_a_key_and_prints_only_masked_numbers(capsys):
    assert run("simulate") == 0
    out = capsys.readouterr().out
    assert "+12025550101" not in out and "2025550" not in out


def test_scenarios_cannot_reach_numbers_outside_the_fixture(tmp_path, capsys):
    scenario = tmp_path / "s.json"
    scenario.write_text(json.dumps({}))
    assert run("simulate", "--scenarios", str(scenario)) == 0
    assert "start_rejected" in capsys.readouterr().out
