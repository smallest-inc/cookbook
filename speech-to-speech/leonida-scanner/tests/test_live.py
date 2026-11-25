"""Channel 6 (live) checks: token endpoint, caps, move validation, CSP. No network, no real key."""

from __future__ import annotations

import json
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import channels
import live
import server
from test_security import _req


@pytest.fixture()
def srv(monkeypatch: pytest.MonkeyPatch):
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    port = httpd.server_address[1]
    monkeypatch.setattr(server, "PORT", port)
    monkeypatch.setattr(live, "_local_day", "")
    monkeypatch.setattr(live, "_local_data", {})
    server._rate_hits.clear()
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield port
    httpd.shutdown()
    httpd.server_close()


def _post_token(port: int):
    return _req(
        port,
        "/api/live/token",
        method="POST",
        headers={"Origin": f"http://127.0.0.1:{port}", "Content-Type": "application/json"},
        body=b"{}",
    )


def test_live_status_reflects_key(srv: int, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SMALLEST_API_KEY", raising=False)
    status, _, data = _req(srv, "/api/live/status")
    assert status == 200 and json.loads(data)["available"] is False
    monkeypatch.setenv("SMALLEST_API_KEY", "test-key-not-real")
    _, _, data = _req(srv, "/api/live/status")
    assert json.loads(data)["available"] is True


def test_token_endpoint_offline_without_key(srv: int, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SMALLEST_API_KEY", raising=False)
    status, _, data = _post_token(srv)
    assert status == 503
    assert "offline" in json.loads(data)["error"]


def test_token_endpoint_returns_short_lived_token_never_the_key(
    srv: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    secret = "sk-test-secret-value-1234567890"
    monkeypatch.setenv("SMALLEST_API_KEY", secret)
    monkeypatch.setattr(
        live, "mint_token", lambda ttl=None: {"access_token": "wat_fake_token_abc", "expires_in": 60}
    )
    status, _, data = _post_token(srv)
    assert status == 200
    assert secret.encode() not in data
    body = json.loads(data)
    assert body["access_token"] == "wat_fake_token_abc"
    assert body["ws_url"].startswith("wss://api.smallest.ai/waves/v1/s2s?model=hydra")
    assert body["max_session_s"] == live.SESSION_MAX_S
    assert body["slot"]
    cfg = body["session"]
    assert {t["name"] for t in cfg["tools"]} == {"fly_to", "follow", "circle", "spotlight", "report"}


def test_token_endpoint_needs_our_origin(srv: int, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMALLEST_API_KEY", "k")
    status, _, _ = _req(
        srv,
        "/api/live/token",
        method="POST",
        headers={"Content-Type": "application/json", "Origin": "https://evil.example"},
        body=b"{}",
    )
    assert status == 403


def test_token_endpoint_concurrent_slots_and_release(
    srv: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SMALLEST_API_KEY", "k")
    monkeypatch.setattr(live, "mint_token", lambda ttl=None: {"access_token": "wat_x", "expires_in": 60})
    monkeypatch.setattr(live, "CONCURRENT_LIVE", 2)
    monkeypatch.setattr(live, "LIVE_SESSIONS_PER_IP", 50)
    slots = []
    for _ in range(2):
        status, _, data = _post_token(srv)
        assert status == 200
        slots.append(json.loads(data)["slot"])
    status, _, data = _post_token(srv)
    assert status == 429 and "full" in json.loads(data)["error"]
    status, _, _ = _req(
        srv,
        "/api/live/end",
        method="POST",
        headers={"Origin": f"http://127.0.0.1:{srv}", "Content-Type": "application/json"},
        body=json.dumps({"slot": slots[0]}).encode(),
    )
    assert status == 200
    status, _, _ = _post_token(srv)
    assert status == 200


def test_mint_failure_releases_the_slot(srv: int, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMALLEST_API_KEY", "k")

    def boom(ttl=None):
        raise RuntimeError("token mint failed (401): nope")

    monkeypatch.setattr(live, "mint_token", boom)
    monkeypatch.setattr(live, "CONCURRENT_LIVE", 1)
    status, _, _ = _post_token(srv)
    assert status == 502
    monkeypatch.setattr(live, "mint_token", lambda ttl=None: {"access_token": "wat_x", "expires_in": 60})
    status, _, _ = _post_token(srv)
    assert status == 200


def test_caps_per_ip_global_sid_and_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(live, "CONCURRENT_LIVE", 99)
    monkeypatch.setattr(live, "LIVE_SESSIONS_PER_IP", 2)
    monkeypatch.setattr(live, "LIVE_SESSIONS_PER_SID", 1)
    monkeypatch.setattr(live, "LIVE_SESSIONS_GLOBAL", 3)
    data: dict = {}
    cap = 10_000
    assert live.check_and_count(data, "ip1", "s1", units_total_cap=cap)[0] is None
    err, _ = live.check_and_count(data, "ip2", "s1", units_total_cap=cap)
    assert err and "invite" in err  # per-session cap
    assert live.check_and_count(data, "ip1", "s2", units_total_cap=cap)[0] is None
    err, _ = live.check_and_count(data, "ip1", "s3", units_total_cap=cap)
    assert err and "network" in err  # per-IP cap
    assert live.check_and_count(data, "ip3", "s4", units_total_cap=cap)[0] is None
    err, _ = live.check_and_count(data, "ip4", "s5", units_total_cap=cap)
    assert err and "daily session" in err  # global cap
    # sessions draw on the same unit ledger as everything else
    assert data["total"] == 3 * live.LIVE_UNITS
    err, _ = live.check_and_count({"total": 95}, "ipx", None, units_total_cap=100)
    assert err and "daily limit" in err


def test_slots_expire(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(live, "CONCURRENT_LIVE", 1)
    monkeypatch.setattr(live, "LIVE_SESSIONS_PER_IP", 50)
    data: dict = {}
    assert live.check_and_count(data, "ip", None, units_total_cap=10**6, now=1000.0)[0] is None
    err, _ = live.check_and_count(data, "ip", None, units_total_cap=10**6, now=1001.0)
    assert err and "full" in err
    later = 1000.0 + live.SESSION_MAX_S + 60
    assert live.check_and_count(data, "ip", None, units_total_cap=10**6, now=later)[0] is None


def test_validate_move_only_accepts_known_ids() -> None:
    ok = live.validate_move({"unit_id": "Jet_Ski", "place_id": "heron_marina", "action": "chase"})
    assert ok == {"unit": "jet_ski", "place": "heron_marina", "action": "chase"}
    assert live.validate_move({"unit_id": "tank", "place_id": "heron_marina"}) is None
    assert live.validate_move({"unit_id": "jet_ski", "place_id": "area_51"}) is None
    assert live.validate_move({"unit_id": "jet_ski", "place_id": "heron_marina", "action": "explode"}) is None
    assert live.validate_move("jet_ski") is None
    assert live.validate_move({"unit_id": "jet_ski", "place_id": "heron_marina"})["action"] == "drive_to"


def test_desk_cues_are_fixed_server_text() -> None:
    a = live.desk_cue("at", "jet_ski", "heron_marina")
    assert "Heron Marina" in a and 0 < len(a) < 200
    assert live.desk_cue("idle", variant=1) in live.IDLE_CUES
    # unknown ids are refused, never spoken
    with pytest.raises(ValueError):
        live.desk_cue("at", "<script>", "nowhere")
    with pytest.raises(ValueError):
        live.desk_cue("say", "jet_ski", "heron_marina")


def test_public_payload_has_six_channels_with_one_live() -> None:
    payload = channels.public_payload()
    chans = payload["channels"]
    assert len(chans) == 6
    live_ch = [c for c in chans if c.get("live")]
    assert len(live_ch) == 1 and not live_ch[0].get("lines")
    assert set(payload["units"]) == set(channels.UNITS)
    for beat in payload["beats"]["jet"].values():
        assert beat in payload["places"]


def test_csp_allows_the_hydra_socket_and_nothing_else_remote() -> None:
    csp = server.build_csp("<html></html>")
    assert "wss://api.smallest.ai" in csp
    assert "default-src 'none'" in csp
    assert "https:" not in csp and "http:" not in csp


def test_own_key_mode_status_and_no_hosted_token(srv: int, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SMALLEST_API_KEY", raising=False)
    monkeypatch.setenv("LIVE_MODE", "byok")
    _, _, data = _req(srv, "/api/live/status")
    st = json.loads(data)
    assert st["available"] is True and st["byok"] is True
    # Even with our key set, own-key mode never mints on it.
    monkeypatch.setenv("SMALLEST_API_KEY", "sk-test-secret-value-1234567890")
    monkeypatch.setattr(live, "mint_token", lambda ttl=None: pytest.fail("minted on the hosted key"))
    status, _, data = _post_token(srv)
    assert status == 403
    assert "own" in json.loads(data)["error"]


def test_own_key_session_has_config_and_no_credential(srv: int, monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "sk-test-secret-value-1234567890"
    monkeypatch.setenv("SMALLEST_API_KEY", secret)
    monkeypatch.setenv("LIVE_MODE", "byok")
    status, _, data = _req(srv, "/api/live/session")
    assert status == 200
    assert secret.encode() not in data
    body = json.loads(data)
    assert "access_token" not in body and "slot" not in body
    assert body["ws_url"].startswith("wss://api.smallest.ai/waves/v1/s2s?model=hydra")
    assert {t["name"] for t in body["session"]["tools"]} == {"fly_to", "follow", "circle", "spotlight", "report"}


def test_session_config_endpoint_is_off_in_hosted_mode(srv: int, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LIVE_MODE", raising=False)
    monkeypatch.setenv("SMALLEST_API_KEY", "test-key-not-real")
    status, _, _ = _req(srv, "/api/live/session")
    assert status == 404
    _, _, data = _req(srv, "/api/live/status")
    assert json.loads(data)["byok"] is False
