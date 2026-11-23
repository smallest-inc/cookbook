"""The collections prompt and config keep the compliance changes described in the README."""

import json

from conftest import AGENTS

PROMPT = (AGENTS / "loan-collections-hi-en" / "prompt.md").read_text(encoding="utf-8")
CFG = json.loads(
    (AGENTS / "loan-collections-hi-en" / "agent-config.json").read_text(
        encoding="utf-8"
    )
)


def test_ai_disclosure_in_first_message_and_prompt():
    assert "AI" in CFG["firstMessage"]
    assert "AI" in PROMPT


def test_callbacks_limited_to_rbi_hours():
    assert "8 AM" in PROMPT
    assert "7 PM" in PROMPT


def test_no_dnc_override_and_voicemail_detection_on():
    assert "dncOverrideEnabled" not in CFG
    assert CFG["voiceMailDetectionConfig"]["enabled"] is True
    assert CFG["redactionConfig"]["isEnabled"] is True


def test_end_call_honours_a_repeated_stop_request():
    end_call = next(t for t in CFG["tools"] if t["name"] == "end_call")
    text = end_call["description"].lower()
    assert "asked to end the call again after you explained once" in text
    assert "do-not-call" not in text


def test_compliance_breach_metric_covers_new_rules():
    metric = next(
        m
        for m in CFG["postCallAnalytics"]["dispositionMetrics"]
        if m["identifier"] == "compliance_breach"
    )
    text = json.dumps(metric, ensure_ascii=False).lower()
    assert "claimed to be human" in text
    assert (
        "kept pressing for payment after the customer asked twice to end the call"
        in text
    )
    assert "outside 8 am to 7 pm" in text
