#!/usr/bin/env python3
"""Leonida Scanner. A local walkie-talkie that scans five fictional channels.

Local proxy for Smallest AI: Lightning (channel voices), Pulse (your push-to-talk),
and Electron (in-character replies). Binds to 127.0.0.1 only. The browser never
sees the API key, and the key is never logged.

Fan-made radio play, not affiliated with Rockstar Games. Original city and voices.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import live
from channels import CHANNEL_BY_ID, PLACES, UNITS, all_voices, public_payload, scene_for

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
CACHE = ROOT / ".cache-tts"
WAVES = "https://api.smallest.ai/waves/v1"
TTS_MODEL = "lightning_v3.1_pro"
STT_MODEL = "pulse"
LLM_MODEL = "electron"
BIND = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8787"))
MAX_TTS_CHARS = 240
MAX_STT_BYTES = 3 * 1024 * 1024
MAX_JSON_BYTES = 32 * 1024
MAX_HISTORY = 8
RATE_LIMITS = {
    "/api/line": 240,
    "/api/tts": 60,
    "/api/stt": 30,
    "/api/reply": 30,
    "/api/desk": 60,
    "/api/live/token": 6,
    "/api/live/end": 20,
    "/api/live/status": 60,
    "/api/live/session": 20,
}
RATE_WINDOW_S = 60
LLM_TIMEOUT_S = 20
TTS_TIMEOUT_S = 30
STT_TIMEOUT_S = 45
VOICES = frozenset(all_voices())

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
    ".glb": "model/gltf-binary",
    ".woff": "font/woff",
    ".txt": "text/plain; charset=utf-8",
    ".wav": "audio/wav",
}

_rate_lock = threading.Lock()
_rate_hits: dict[str, deque[float]] = defaultdict(deque)
_tts_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
_tts_locks_guard = threading.Lock()


# ---------------------------------------------------------------- guards
def _api_key() -> str:
    key = os.environ.get("SMALLEST_API_KEY", "").strip()
    if not key:
        raise RuntimeError("SMALLEST_API_KEY is not set")
    return key


def allowed_hosts(port: int) -> set[str]:
    return {f"127.0.0.1:{port}", f"localhost:{port}"}


def allowed_origins(port: int) -> set[str]:
    return {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}


def allow_request(
    host: str, origin: str | None, port: int, *, post: bool = False
) -> bool:
    host = (host or "").split(",")[0].strip().lower()
    if host not in allowed_hosts(port):
        return False
    if origin is None or origin == "":
        # Browsers always send Origin on fetch POSTs. A POST without it is not from our page.
        return not post
    return origin.strip() in allowed_origins(port)


def _rate_ok(bucket: str, limit: int) -> bool:
    now = time.monotonic()
    with _rate_lock:
        hits = _rate_hits[bucket]
        while hits and now - hits[0] > RATE_WINDOW_S:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True


def _safe_static(rel: str) -> Path | None:
    if not rel or "\x00" in rel or ".." in Path(rel).parts or rel.startswith("/"):
        return None
    path = (STATIC / rel).resolve()
    try:
        path.relative_to(STATIC.resolve())
    except ValueError:
        return None
    if path.is_file():
        return path
    return None


def _clean_text(text: str) -> str:
    text = re.sub(r"[\*`#_\[\]<>{}\\]", "", text or "")
    text = " ".join(text.split())
    return text.strip()[:MAX_TTS_CHARS]


def inline_script_hashes(html: str) -> list[str]:
    """CSP hashes for SvelteKit's inline bootstrap script, so we never need 'unsafe-inline'."""
    hashes = []
    for body in re.findall(
        r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, flags=re.DOTALL
    ):
        digest = hashlib.sha256(body.encode("utf-8")).digest()
        hashes.append(f"'sha256-{base64.b64encode(digest).decode()}'")
    return hashes


def build_csp(html: str) -> str:
    scripts = " ".join(["'self'", *inline_script_hashes(html)])
    return (
        "default-src 'none'; "
        f"script-src {scripts}; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; "
        "connect-src 'self' blob: wss://api.smallest.ai; worker-src 'self'; manifest-src 'self'; "
        "frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )


# ---------------------------------------------------------------- Smallest AI
def _waves(
    method: str, path: str, body: bytes, content_type: str, timeout: int
) -> tuple[int, bytes]:
    url = f"{WAVES}{path}"
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "api.smallest.ai":
        raise RuntimeError("refusing unexpected url")
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {_api_key()}",
            "Content-Type": content_type,
            "Accept": "*/*",
        },
    )
    try:
        # Only https://api.smallest.ai is reachable here; the scheme and host are checked above.
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec B310
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"network error: {type(exc).__name__}") from None


def _err(kind: str, status: int, data: bytes) -> RuntimeError:
    snippet = data[:160].decode("utf-8", "replace")
    snippet = re.sub(r"(?i)(bearer\s+)?sk[_-][A-Za-z0-9_\-]{8,}", "[redacted]", snippet)
    return RuntimeError(f"{kind} failed ({status}): {snippet}")


def tts_cache_path(text: str, voice_id: str, rate: int = 24000) -> Path:
    # 24 kHz keeps the v2 cache names, so channel audio made earlier is still a hit.
    tag = "" if rate == 24000 else f"|{rate}"
    key = hashlib.sha256(f"{TTS_MODEL}|{voice_id}|{text}{tag}".encode()).hexdigest()
    return CACHE / f"{key}.wav"


def synthesize(text: str, voice_id: str, rate: int = 24000) -> tuple[bytes, bool]:
    """Return (wav, cached). Cached per voice and text, so re-takes cost nothing."""
    text = _clean_text(text)
    if not text:
        raise ValueError("empty text")
    if voice_id not in VOICES:
        raise ValueError("unknown voice")
    CACHE.mkdir(mode=0o700, exist_ok=True)
    if rate not in (16000, 24000):
        raise ValueError("unsupported sample rate")
    path = tts_cache_path(text, voice_id, rate)
    with _tts_locks_guard:
        lock = _tts_locks[path.name]
    with lock:
        if path.is_file():
            return path.read_bytes(), True
        payload = json.dumps(
            {
                "text": text,
                "voice_id": voice_id,
                "model": TTS_MODEL,
                "sample_rate": rate,
                "output_format": "wav",
                "language": "en",
                "speed": 1.05,
            }
        ).encode()
        status, data = _waves(
            "POST", "/tts", payload, "application/json", TTS_TIMEOUT_S
        )
        if status != 200 or not data or data[:4] != b"RIFF":
            raise _err("tts", status, data)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        tmp.replace(path)
        return data, False


def transcribe(audio: bytes) -> str:
    if not audio:
        raise ValueError("empty audio")
    if len(audio) > MAX_STT_BYTES:
        raise ValueError("audio too large")
    if audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
        raise ValueError("expected a wav clip")
    status, data = _waves(
        "POST",
        f"/stt/?model={STT_MODEL}&language=en",
        audio,
        "application/octet-stream",
        STT_TIMEOUT_S,
    )
    if status != 200:
        raise _err("stt", status, data)
    parsed = json.loads(data.decode("utf-8"))
    text = parsed.get("transcription") or parsed.get("text") or ""
    if isinstance(text, list):
        text = " ".join(str(part) for part in text)
    return " ".join(str(text).split()).strip()


def system_prompt(channel: dict) -> str:
    speakers = channel["speakers"]
    roster = "\n".join(f"- {sid}: {sp['label']}" for sid, sp in speakers.items())
    places = "\n".join(f"- {pid}: {p['name']}" for pid, p in PLACES.items())
    units = "\n".join(f"- {uid}: {u['label']} ({u['kind']})" for uid, u in UNITS.items())
    intruder = str(channel.get("intruder", "Who is this? This channel is not for the public."))
    return f"""You write short radio replies for a fictional, comedic walkie-talkie scanner.
The city is Port Ibis, an invented sun-belt coastal city. This is a parody, not a real dispatch,
not an official game, broadcast or product.

Channel: {channel["name"]}. {channel["persona"]}

Speakers on this channel (use these ids only):
{roster}

Places (use these ids only):
{places}

Units on the map (optional "unit" field, use these ids only):
{units}

Return JSON only, no markdown, in exactly this shape:
{{"calls":[{{"speaker":"<speaker id>","text":"...","place":"<place id>","unit":"<unit id the line is about>","action":"drive_to|chase|stop|circle"}}]}}

Rules:
- 2 or 3 lines. Each line under 20 words. Speak like a radio transmission, in character.
- The caller is not one of your people. They are an unknown civilian who found this frequency and keyed up on it.
  The first line reacts to that intrusion in character, in this channel's own style, for example: "{intruder}"
  Vary the wording every time. Then it still answers what they actually said.
- The other lines stay in character: they can be wary of the stranger, play along, or send a unit to check.
- "unit" and "action" say what the map should show for that line: the unit being talked about or sent, and what it does.
- Unless they name a place, the caller is near Banyan Park.
- Never use real police ten-codes or real emergency codes. Invented codes only, sparingly.
- Never name real people, any game title, any game character, or any company.
- No graphic violence, no sexual content, no real addresses, no phone numbers.
- Do not repeat the recent lines word for word."""


def _parse_calls(content: str, channel: dict) -> list[dict[str, str]]:
    raw = content.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).removesuffix("```").strip()
    obj = json.loads(raw)
    rows = obj.get("calls") if isinstance(obj, dict) else obj
    if not isinstance(rows, list):
        raise TypeError("bad llm shape")
    speakers = channel["speakers"]
    calls: list[dict[str, str]] = []
    for row in rows[:3]:
        if not isinstance(row, dict):
            continue
        speaker = str(row.get("speaker", "")).strip().lower()
        text = _clean_text(str(row.get("text", "")))
        place = str(row.get("place", "")).strip().lower()
        if place not in PLACES:
            place = "banyan_park"
        if speaker in speakers and text:
            unit = str(row.get("unit", "")).strip().lower() or None
            action = str(row.get("action", "")).strip().lower() or None
            scene = scene_for(str(channel["id"]), speaker, text, place, None, None, unit, action)
            calls.append({"speaker": speaker, "text": text, "place": place, "scene": scene})
    if not calls:
        raise ValueError("no usable lines")
    return calls


def _chat(channel: dict, user: str) -> list[dict[str, str]]:
    payload = json.dumps(
        {
            "model": LLM_MODEL,
            "temperature": 0.8,
            "max_tokens": 320,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt(channel)},
                {"role": "user", "content": user},
            ],
        }
    ).encode()
    status, data = _waves(
        "POST", "/chat/completions", payload, "application/json", LLM_TIMEOUT_S
    )
    if status != 200:
        raise _err("llm", status, data)
    parsed = json.loads(data.decode("utf-8"))
    return _parse_calls(parsed["choices"][0]["message"]["content"], channel)


def build_reply(
    channel_id: str, transcript: str, history: list[str]
) -> dict[str, object]:
    channel = CHANNEL_BY_ID.get(channel_id)
    if channel is None:
        raise ValueError("unknown channel")
    said = _clean_text(transcript)
    if not said:
        raise ValueError("empty transcript")
    recent = [_clean_text(h) for h in history if isinstance(h, str) and h.strip()][
        -MAX_HISTORY:
    ]
    prompt = (
        f'A caller keyed up on {channel["name"]} and said:\n"{said}"\n\n'
        "Recent lines on this channel:\n" + ("\n".join(recent) if recent else "(none)")
    )
    source = LLM_MODEL
    try:
        calls = _chat(channel, prompt)
    except (
        RuntimeError,
        ValueError,
        TypeError,
        KeyError,
        json.JSONDecodeError,
        IndexError,
    ):
        calls = [
            {**item, "scene": scene_for(channel_id, item["speaker"], item["text"], item["place"])}
            for item in channel["fallback"]
        ]
        source = "fallback"
    return {"channel": channel_id, "source": source, "calls": calls}


def line_voice(channel_id: str, index: int) -> tuple[str, str]:
    channel = CHANNEL_BY_ID.get(channel_id)
    if channel is None:
        raise ValueError("unknown channel")
    lines = channel["lines"]
    if not 0 <= index < len(lines):
        raise ValueError("unknown line")
    line = lines[index]
    return line["text"], channel["speakers"][line["speaker"]]["voice"]


def prewarm() -> None:
    """Fill the TTS cache for every scripted line, so the first take is instant."""
    jobs = [
        (cid, i) for cid, ch in CHANNEL_BY_ID.items() for i in range(len(ch["lines"]))
    ]
    missing = []
    for job in jobs:
        text, voice = line_voice(*job)
        if not tts_cache_path(_clean_text(text), voice).is_file():
            missing.append(job)
    if not missing:
        print(f"Channel audio cached ({len(jobs)} lines).", flush=True)
        return
    print(
        f"Generating channel audio with Lightning: {len(missing)} of {len(jobs)} lines.",
        flush=True,
    )

    def one(job: tuple[str, int]) -> bool:
        try:
            synthesize(*line_voice(*job))
            return True
        except (RuntimeError, ValueError) as exc:
            print(f"  could not prewarm {job[0]} line {job[1]}: {exc}", flush=True)
            return False

    with ThreadPoolExecutor(max_workers=4) as pool:
        done = sum(pool.map(one, missing))
    print(f"Channel audio ready: {done} new lines cached.", flush=True)


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "LeonidaScanner/2.0"
    sys_version = ""
    csp = "default-src 'none'"

    def log_message(self, fmt: str, *args: object) -> None:
        # Method and path only. Never headers, bodies, or query strings.
        sys.stderr.write(
            f"  {self.command} {self.path.split('?', 1)[0]} {args[1] if len(args) > 1 else ''}\n"
        )

    def _send(
        self,
        code: int,
        body: bytes,
        content_type: str,
        extra: dict[str, str] | None = None,
    ) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Permissions-Policy", "microphone=(self), camera=(), geolocation=()"
        )
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code: int, obj: object) -> None:
        self._send(code, json.dumps(obj).encode(), "application/json")

    def _reject(self, code: int, message: str) -> None:
        self._json(code, {"error": message})

    def _guard(self, post: bool) -> bool:
        if not allow_request(
            self.headers.get("Host", ""), self.headers.get("Origin"), PORT, post=post
        ):
            self._reject(403, "forbidden")
            return False
        return True

    def _limited(self, path: str) -> bool:
        limit = RATE_LIMITS.get(path)
        if limit and not _rate_ok(self.client_address[0] + path, limit):
            self._reject(429, "slow down")
            return True
        return False

    # ------------------------------------------------------------ channel 6 (live)
    def _sid(self) -> str | None:
        """Per invite-session id. None locally; the hosted wrapper overrides it."""
        return None

    def _live_charge(self) -> tuple[str | None, str | None]:
        return live.local_charge(self.client_address[0])

    def _live_release(self, slot: str) -> None:
        live.local_release(slot)

    def _desk_charge(self, text: str) -> str | None:
        return None

    def _live_status(self) -> dict[str, object]:
        byok = live.byok()
        return {"available": byok or live.available(), "byok": byok, "max_session_s": live.SESSION_MAX_S}

    def _live_post(self, path: str, body: dict) -> None:
        if path == "/api/live/end":
            slot = str(body.get("slot") or "")[:40]
            if slot:
                self._live_release(slot)
            self._json(200, {"ok": True})
            return
        if live.byok():
            self._reject(403, "channel 6 runs on your own Smallest key here")
            return
        if not live.available():
            self._reject(503, "live channel offline")
            return
        err, slot = self._live_charge()
        if err:
            self._reject(429, err)
            return
        try:
            payload = live.token_response()
        except RuntimeError as exc:
            if slot:
                self._live_release(slot)
            self._reject(502, str(exc))
            return
        payload["slot"] = slot
        self._json(200, payload)

    def _desk_audio(self, query: dict[str, list[str]]) -> None:
        def one(name: str) -> str:
            return (query.get(name) or [""])[0]

        text = live.desk_cue(one("k"), one("u"), one("p"), int(one("v") or "0"))
        cleaned = _clean_text(text)
        path = tts_cache_path(cleaned, live.DESK_VOICE, 16000)
        if not path.is_file():
            err = self._desk_charge(cleaned)
            if err:
                self._reject(429, err)
                return
        audio, cached = synthesize(text, live.DESK_VOICE, 16000)
        self._send(200, audio, "audio/wav", {"X-Cache": "hit" if cached else "miss"})

    def do_OPTIONS(self) -> None:
        self._reject(403, "forbidden")

    def do_PUT(self) -> None:
        self._reject(405, "method not allowed")

    do_DELETE = do_PUT
    do_PATCH = do_PUT

    def do_GET(self) -> None:
        if not self._guard(post=False):
            return
        url = urlparse(self.path)
        path = url.path
        if self._limited(path):
            return
        try:
            if path == "/favicon.ico":
                self._send(204, b"", "image/x-icon")
                return
            if path == "/health":
                self._json(200, {"ok": True})
                return
            if path == "/api/channels":
                self._json(200, public_payload())
                return
            if path == "/api/live/status":
                self._json(200, self._live_status())
                return
            if path == "/api/live/session":
                if not live.byok():
                    self._reject(404, "not found")
                    return
                self._json(200, live.session_response())
                return
            if path == "/api/desk":
                self._desk_audio(parse_qs(url.query))
                return
            if path == "/api/line":
                query = parse_qs(url.query)
                channel_id = (query.get("ch") or [""])[0]
                index = int((query.get("i") or ["-1"])[0])
                audio, cached = synthesize(*line_voice(channel_id, index))
                self._send(
                    200, audio, "audio/wav", {"X-Cache": "hit" if cached else "miss"}
                )
                return
        except (ValueError, TypeError) as exc:
            self._reject(400, str(exc))
            return
        except RuntimeError as exc:
            self._reject(502, str(exc))
            return
        self._static(path)

    do_HEAD = do_GET

    def _static(self, path: str) -> None:
        if path in {"/", "/index.html"}:
            page = _safe_static("index.html")
            if page is None:
                self._reject(
                    500, "UI not built. Run: cd web && npm ci && npm run build"
                )
                return
            html = page.read_text("utf-8")
            self._send(
                200,
                html.encode(),
                MIME[".html"],
                {"Content-Security-Policy": build_csp(html)},
            )
            return
        file_path = _safe_static(path.lstrip("/"))
        if file_path is None:
            self._reject(404, "not found")
            return
        content_type = MIME.get(file_path.suffix, "application/octet-stream")
        self._send(200, file_path.read_bytes(), content_type)

    def do_POST(self) -> None:
        if not self._guard(post=True):
            return
        path = urlparse(self.path).path
        if path not in {"/api/tts", "/api/stt", "/api/reply", "/api/live/token", "/api/live/end"}:
            self._reject(404, "not found")
            return
        if self._limited(path):
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            self._reject(400, "bad length")
            return
        cap = MAX_STT_BYTES if path == "/api/stt" else MAX_JSON_BYTES
        if length <= 0 or length > cap:
            self._reject(413, "too large" if length > cap else "empty body")
            return
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        want = "application/octet-stream" if path == "/api/stt" else "application/json"
        if ctype != want:
            self._reject(415, f"expected {want}")
            return
        raw = self.rfile.read(length)
        try:
            if path == "/api/stt":
                started = time.monotonic()
                text = transcribe(raw)
                self._json(
                    200,
                    {
                        "transcription": text,
                        "seconds": round(time.monotonic() - started, 2),
                    },
                )
                return
            body = json.loads(raw)
            if not isinstance(body, dict):
                raise TypeError("bad json")
            if path in {"/api/live/token", "/api/live/end"}:
                self._live_post(path, body)
                return
            if path == "/api/reply":
                history = body.get("history") or []
                if not isinstance(history, list):
                    history = []
                started = time.monotonic()
                reply = build_reply(
                    str(body.get("channel") or ""),
                    str(body.get("transcript") or ""),
                    [str(h) for h in history],
                )
                reply["seconds"] = round(time.monotonic() - started, 2)
                self._json(200, reply)
                return
            # /api/tts: replies only. The speaker must belong to the channel.
            channel = CHANNEL_BY_ID.get(str(body.get("channel") or ""))
            if channel is None:
                raise ValueError("unknown channel")
            speaker = channel["speakers"].get(
                str(body.get("speaker") or "").strip().lower()
            )
            if speaker is None:
                raise ValueError("unknown speaker")
            audio, cached = synthesize(str(body.get("text") or ""), speaker["voice"])
            self._send(
                200, audio, "audio/wav", {"X-Cache": "hit" if cached else "miss"}
            )
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self._reject(400, str(exc))
        except RuntimeError as exc:
            self._reject(502, str(exc))


def main() -> None:
    if not os.environ.get("SMALLEST_API_KEY", "").strip():
        raise SystemExit(
            "Set SMALLEST_API_KEY first. Do not paste it into the page or the post."
        )
    CACHE.mkdir(mode=0o700, exist_ok=True)
    if os.environ.get("PREWARM", "1") != "0":
        threading.Thread(target=prewarm, daemon=True).start()
    httpd = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"Leonida Scanner on http://{BIND}:{PORT}", flush=True)
    print("Open that URL in Chrome. Leave this terminal running.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
