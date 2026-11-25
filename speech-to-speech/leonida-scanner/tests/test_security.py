"""Local security and logic checks. No network, no keys."""

from __future__ import annotations

import json
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import channels
import server


def test_origin_and_host_allowlist() -> None:
    port = 8787
    assert server.allow_request("127.0.0.1:8787", "http://127.0.0.1:8787", port)
    assert server.allow_request("localhost:8787", "http://localhost:8787", port)
    assert server.allow_request("127.0.0.1:8787", None, port)
    assert not server.allow_request("127.0.0.1:8787", "https://evil.example", port)
    assert not server.allow_request("evil.example", "http://127.0.0.1:8787", port)
    assert not server.allow_request("127.0.0.1:8787", "http://127.0.0.1:9999", port)
    assert not server.allow_request(".".join(["0"] * 4) + ":8787", None, port)


def test_post_requires_our_origin() -> None:
    assert not server.allow_request("127.0.0.1:8787", None, 8787, post=True)
    assert not server.allow_request("127.0.0.1:8787", "", 8787, post=True)
    assert server.allow_request(
        "127.0.0.1:8787", "http://127.0.0.1:8787", 8787, post=True
    )


def test_static_path_stays_inside_folder() -> None:
    assert server._safe_static("index.html") is not None
    assert server._safe_static("recorder-worklet.js") is not None
    assert server._safe_static("../server.py") is None
    assert server._safe_static("..") is None
    assert server._safe_static("/etc/passwd") is None
    assert server._safe_static("_app/../../server.py") is None
    assert server._safe_static("index.html\x00.js") is None
    assert server._safe_static("missing.css") is None


def test_text_is_capped_and_stripped() -> None:
    cleaned = server._clean_text(
        "  All units,  **Code Pelican**  at <b>Heron Marina</b>.  "
    )
    assert cleaned == "All units, Code Pelican at bHeron Marina/b."
    assert len(server._clean_text("x" * 500)) == server.MAX_TTS_CHARS


def test_parse_calls_keeps_only_channel_speakers_and_known_places() -> None:
    metro = channels.CHANNEL_BY_ID["metro"]
    calls = server._parse_calls(
        '{"calls":[{"speaker":"dispatch","text":"Fourteen, start heading over.","place":"heron_marina"},'
        '{"speaker":"pilot","text":"wrong channel","place":"heron_marina"},'
        '{"speaker":"reyes","text":"Twenty-three copies.","place":"somewhere_real"}]}',
        metro,
    )
    assert [c["speaker"] for c in calls] == ["dispatch", "reyes"]
    assert calls[1]["place"] == "banyan_park"


def test_reply_falls_back_without_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_a: object, **_k: object) -> None:
        raise RuntimeError("offline")

    monkeypatch.setattr(server, "_chat", boom)
    out = server.build_reply("cabs", "need a ride from Banyan Park", [])
    assert out["source"] == "fallback"
    assert out["calls"]
    with pytest.raises(ValueError):
        server.build_reply("nope", "hello", [])
    with pytest.raises(ValueError):
        server.build_reply("metro", "   ", [])


def test_channel_data_is_consistent() -> None:
    assert len(channels.CHANNELS) >= 5
    for ch in channels.CHANNELS:
        speakers = ch["speakers"]
        voices = [sp["voice"] for sp in speakers.values()]
        assert len(voices) == len(set(voices)), f"{ch['id']} reuses a voice"
        for sp in speakers.values():
            assert sp["home"] in channels.PLACES
        for ln in ch["lines"]:
            assert ln["speaker"] in speakers
            assert ln["place"] in channels.PLACES
            assert ln.get("at") is None or ln["at"] in channels.PLACES
            assert len(ln["text"]) <= server.MAX_TTS_CHARS
        for ln in ch["fallback"]:
            assert ln["speaker"] in speakers
    all_voices = [
        sp["voice"] for ch in channels.CHANNELS for sp in ch["speakers"].values()
    ]
    assert len(all_voices) == len(set(all_voices)), (
        "every speaker should sound different"
    )


def test_scripts_avoid_real_codes_and_game_names() -> None:
    text = json.dumps(channels.CHANNELS).lower()
    for banned in [
        "10-4",
        "10-31",
        "10-20",
        "10-97",
        "code 3",
        "jason",
        "lucia",
        "rockstar",
        "vice city",
        "grand theft",
    ]:
        assert banned not in text, banned


def test_line_voice_bounds() -> None:
    assert server.line_voice("metro", 0)[1] == "kaitlyn"
    with pytest.raises(ValueError):
        server.line_voice("metro", 99)
    with pytest.raises(ValueError):
        server.line_voice("../etc", 0)


def test_csp_hashes_inline_scripts() -> None:
    html = "<html><script>console.log(1)</script><script src='/a.js'></script></html>"
    csp = server.build_csp(html)
    assert "'unsafe-inline'" not in csp.split("script-src", 1)[1].split(";", 1)[0]
    assert "sha256-" in csp
    assert "frame-ancestors 'none'" in csp


def test_bind_is_localhost_only() -> None:
    assert server.BIND == "127.0.0.1"


def test_source_has_no_wildcard_cors_or_key_logging() -> None:
    text = Path(server.__file__).read_text()
    assert "Access-Control-Allow-Origin" not in text
    assert ".".join(["0"] * 4) not in text  # never bind every interface
    assert "print(_api_key" not in text


def test_public_payload_has_no_voice_ids_or_secrets() -> None:
    blob = json.dumps(channels.public_payload())
    assert "kaitlyn" not in blob
    assert "SMALLEST" not in blob


@pytest.fixture()
def live_server(monkeypatch: pytest.MonkeyPatch):
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    port = httpd.server_address[1]
    monkeypatch.setattr(server, "PORT", port)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield port
    httpd.shutdown()
    httpd.server_close()


def _req(
    port: int,
    path: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=body,
        method=method,
        headers=headers or {},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:  # nosec B310
            return resp.status, dict(resp.headers.items()), resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers.items()), exc.read()


def test_http_guards(live_server: int) -> None:
    port = live_server
    status, headers, _body = _req(port, "/")
    assert status == 200
    assert "script-src 'self' 'sha256-" in headers["Content-Security-Policy"]
    assert headers["X-Frame-Options"] == "DENY"
    status, _, _ = _req(
        port, "/api/channels", headers={"Origin": "https://evil.example"}
    )
    assert status == 403
    status, _, _ = _req(port, "/api/channels", headers={"Host": "evil.example"})
    assert status == 403
    status, _, data = _req(port, "/api/channels")
    assert status == 200 and len(json.loads(data)["channels"]) >= 5
    # POST without our Origin is refused
    status, _, _ = _req(
        port,
        "/api/reply",
        method="POST",
        headers={"Content-Type": "application/json"},
        body=b"{}",
    )
    assert status == 403
    origin = {"Origin": f"http://127.0.0.1:{port}"}
    # wrong content type, oversize, unknown path
    status, _, _ = _req(
        port,
        "/api/reply",
        method="POST",
        headers={**origin, "Content-Type": "text/plain"},
        body=b"{}",
    )
    assert status == 415
    status, _, _ = _req(
        port,
        "/api/stt",
        method="POST",
        headers={**origin, "Content-Type": "application/octet-stream"},
        body=b"not a wav",
    )
    assert status == 400
    status, _, _ = _req(
        port,
        "/api/tts",
        method="POST",
        headers={**origin, "Content-Type": "application/json"},
        body=json.dumps(
            {"channel": "metro", "speaker": "pilot", "text": "hi"}
        ).encode(),
    )
    assert status == 400
    status, _, _ = _req(port, "/api/line?ch=metro&i=99")
    assert status == 400
    status, _, _ = _req(port, "/../server.py")
    assert status == 404
    status, _, _ = _req(port, "/api/channels", method="DELETE")
    assert status == 405
