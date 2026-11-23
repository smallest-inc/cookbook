"""create_agent.py: validation, dry run, and the exact requests --create sends (against a mock API)."""

import json
import re

import httpx
import pytest

import create_agent
from conftest import AGENT_NAMES, AGENTS, ROOT

NEW_ID = "new_agent_0001"
BRANCH = "branch_main_0001"


def test_every_agent_folder_is_listed():
    assert create_agent.available() == AGENT_NAMES
    assert AGENT_NAMES == ["credit-card-emi-hi-en", "loan-collections-hi-en"]


@pytest.mark.parametrize("name", AGENT_NAMES)
def test_files_are_valid_and_use_the_pro_voice_model(name):
    cfg, prompt = create_agent.load(name)
    assert create_agent.validate(cfg, prompt) == []
    assert cfg["synthesizer"]["voiceConfig"]["model"] == "waves_lightning_v3_1_pro"


def test_unknown_agent_is_refused(capsys):
    assert create_agent.main(["../../etc"]) == 2
    assert "unknown agent" in capsys.readouterr().err


def test_retiring_lightning_v31_is_rejected():
    cfg, prompt = create_agent.load("loan-collections-hi-en")
    cfg["synthesizer"]["voiceConfig"]["model"] = "waves_lightning_v3_1"
    assert any("retires" in p for p in create_agent.validate(cfg, prompt))


def test_undefined_variable_and_unknown_key_are_caught():
    cfg, prompt = create_agent.load("credit-card-emi-hi-en")
    cfg["surprise"] = 1
    problems = create_agent.validate(cfg, prompt + "\n{{not_defined}}")
    assert any("not_defined" in p for p in problems)
    assert any("unknown keys" in p for p in problems)


@pytest.mark.parametrize("name", AGENT_NAMES)
def test_dry_run_sends_nothing_and_needs_no_key(name, capsys):
    assert create_agent.main([name]) == 0
    out = capsys.readouterr().out
    assert "Dry run. Nothing was created." in out
    assert not (AGENTS / name / ".created_agent_id").exists()


def test_create_without_key_fails_cleanly(capsys, monkeypatch):
    monkeypatch.setattr("dotenv.load_dotenv", lambda *_a, **_k: False)
    assert create_agent.main(["loan-collections-hi-en", "--create"]) == 2
    assert "SMALLEST_API_KEY" in capsys.readouterr().err


class FakeAtoms:
    """A tiny stand-in for the Atoms API. Records every request."""

    def __init__(self):
        self.requests = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        self.requests.append((request.method, request.url.path, body))
        path = request.url.path
        if request.method == "POST" and path == "/atoms/v1/agent":
            return httpx.Response(200, json={"status": True, "data": NEW_ID})
        if request.method == "GET" and path == f"/atoms/v1/agent/{NEW_ID}/branches":
            return httpx.Response(
                200,
                json={
                    "status": True,
                    "data": {
                        "branches": [
                            {
                                "branch": {
                                    "_id": BRANCH,
                                    "isDefault": True,
                                    "headRevisionId": "r0",
                                },
                                "isLive": True,
                            }
                        ]
                    },
                },
            )
        if request.method == "PUT" and path.endswith("/draft"):
            return httpx.Response(200, json={"status": True, "data": {}})
        if request.method == "GET" and path.endswith("/revisions"):
            return httpx.Response(200, json={"status": True, "data": {"revisions": []}})
        if request.method == "POST" and path.endswith("/draft/publish"):
            return httpx.Response(
                200,
                json={
                    "status": True,
                    "data": {
                        "state": "committed",
                        "revision": {"_id": "r1", "status": "published"},
                    },
                },
            )
        if request.method == "POST" and path.endswith("/live"):
            return httpx.Response(200, json={"status": True, "data": {}})
        return httpx.Response(
            404, json={"status": False, "error": f"unexpected {request.method} {path}"}
        )


class FakeAnalytics:
    def __init__(self):
        self.calls = []

    def set_post_call_config(self, **kwargs):
        self.calls.append(kwargs)
        return {"status": True}


@pytest.mark.parametrize("name", AGENT_NAMES)
def test_create_sends_one_new_agent_then_prompt_publish_live_and_metrics(name):
    from smallestai import SmallestAI

    api = FakeAtoms()
    client = SmallestAI(
        api_key="test-key-not-real",
        httpx_client=httpx.Client(transport=httpx.MockTransport(api)),
    )
    analytics = FakeAnalytics()
    cfg, prompt = create_agent.load(name)

    agent_id = create_agent.create(cfg, prompt, client=client, analytics=analytics)

    assert agent_id == NEW_ID
    methods = [(m, p) for m, p, _ in api.requests]
    assert methods[0] == ("POST", "/atoms/v1/agent")
    assert ("PUT", f"/atoms/v1/agent/{NEW_ID}/branches/{BRANCH}/draft") in methods
    assert (
        "POST",
        f"/atoms/v1/agent/{NEW_ID}/branches/{BRANCH}/draft/publish",
    ) in methods
    assert methods[-1] == ("POST", f"/atoms/v1/agent/{NEW_ID}/branches/{BRANCH}/live")
    # every request after the create touches only the agent it just created
    assert all(p.startswith(f"/atoms/v1/agent/{NEW_ID}/") for _, p in methods[1:])
    # nothing is ever deleted, archived or patched
    assert not any(m in ("DELETE", "PATCH") for m, _ in methods)

    create_body = api.requests[0][2]
    assert create_body["name"] == cfg["name"]
    assert (
        create_body["synthesizer"]["voiceConfig"]["model"] == "waves_lightning_v3_1_pro"
    )
    assert create_body["firstMessage"] == cfg["firstMessage"]
    assert create_body["defaultVariables"] == cfg["defaultVariables"]

    draft_body = next(b for m, p, b in api.requests if m == "PUT")
    assert draft_body["singlePromptConfig"]["prompt"] == prompt
    assert [t["name"] for t in draft_body["singlePromptConfig"]["tools"]] == [
        "end_call"
    ]

    assert analytics.calls[0]["agent_id"] == NEW_ID
    assert (
        analytics.calls[0]["disposition_metrics"]
        == cfg["postCallAnalytics"]["dispositionMetrics"]
    )


def test_pick_branch_prefers_live_then_default():
    from types import SimpleNamespace

    a = SimpleNamespace(branch=SimpleNamespace(id="a", is_default=False), is_live=False)
    b = SimpleNamespace(branch=SimpleNamespace(id="b", is_default=True), is_live=False)
    c = SimpleNamespace(branch=SimpleNamespace(id="c", is_default=False), is_live=True)
    assert create_agent.pick_branch([a, b, c]) == "c"
    assert create_agent.pick_branch([a, b]) == "b"
    with pytest.raises(RuntimeError):
        create_agent.pick_branch([])


TEXT_FILES = sorted(
    str(p.relative_to(ROOT))
    for p in ROOT.rglob("*")
    if p.suffix in {".md", ".json", ".py"} and "tests" not in p.parts and p.is_file()
)


@pytest.mark.parametrize("path", TEXT_FILES)
def test_no_real_contact_details_or_internal_ids(path):
    text = (ROOT / path).read_text(encoding="utf-8")
    assert not re.search(r"\+?91[\s-]?[6-9]\d{9}\b", text), "Indian mobile number"
    assert not re.search(r"\b[6-9]\d{9}\b", text), "10-digit mobile number"
    assert not re.search(r"\b[0-9a-f]{24}\b", text), "looks like an internal 24-hex id"
    assert not re.search(r"[\w.+-]+@(?!smallest\.ai\b)[\w-]+\.[\w.]+", text), (
        "email address"
    )
    assert "\u2014" not in text, "em dash"


@pytest.mark.parametrize("name", AGENT_NAMES)
def test_first_message_discloses_ai(name):
    cfg, _ = create_agent.load(name)
    assert "AI" in cfg["firstMessage"]
