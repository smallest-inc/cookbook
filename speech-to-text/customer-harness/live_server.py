"""Local proxy so a browser can stream mic audio to Smallest STT.

Browsers can't set an `Authorization` header on a WebSocket, so we can't hit
`wss://api.smallest.ai/waves/v1/stt/live` directly from JS without leaking the
key. This server:

  1. Serves `live.html` at `/`.
  2. Accepts a client WebSocket at `/ws?<all query params>`.
  3. Opens an upstream WS with `Authorization: Bearer $SMALLEST_API_KEY`.
  4. Relays raw PCM (binary) client→upstream and JSON events upstream→client.
     Each forwarded JSON event is tagged with `_srv_recv_ms` so the browser can
     compute end-to-end latency.

Only pages served from this proxy may open `/ws`. The handler checks the
`Origin` header against an allowlist (by default http://localhost:<port>,
http://127.0.0.1:<port> and http://[::1]:<port>) so a random website you visit
while the proxy runs cannot open a socket to it and spend your key
(cross-site WebSocket hijacking). Add more origins with `--allowed-origin` or
the comma-separated `HARNESS_ALLOWED_ORIGINS` env var.

Requires: `aiohttp websockets`.

  export SMALLEST_API_KEY=sk_...
  python live_server.py                    # listens on http://localhost:8765
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
import traceback
from pathlib import Path
from urllib.parse import urlencode

import websockets
from aiohttp import WSMsgType, web


DEFAULT_UPSTREAM = "wss://api.smallest.ai/waves/v1/stt/live"
HERE = Path(__file__).parent

# websockets renamed extra_headers -> additional_headers in the new asyncio
# implementation, but `websockets.connect` still resolves to the legacy client
# in v13/v14 unless the user explicitly imports the asyncio one. Pick the
# kwarg name from the actual module `websockets.connect` binds to.
_HEADERS_KW = (
    "extra_headers"
    if websockets.connect.__module__.startswith("websockets.legacy")
    else "additional_headers"
)


def _log_session_summary(peer: str, s: dict) -> None:
    # All latencies are in milliseconds (ms).
    def _ms(a, b):
        return int((b - a) * 1000) if (a is not None and b is not None) else None

    print(
        f"[{peer}] session end · "
        f"last_audio_to_last_final_ms={_ms(s['last_audio_at'], s['last_final_at'])} "
        f"partials={s['partials']} finals={s['finals']} bytes_up={s['bytes_up']}",
        flush=True,
    )


async def index(_request: web.Request) -> web.Response:
    return web.Response(
        body=(HERE / "live.html").read_bytes(),
        content_type="text/html",
    )


async def presets(_request: web.Request) -> web.Response:
    return web.Response(
        body=(HERE / "presets.json").read_bytes(),
        content_type="application/json",
    )


def default_allowed_origins(port: int) -> set[str]:
    return {
        f"http://localhost:{port}",
        f"http://127.0.0.1:{port}",
        f"http://[::1]:{port}",
    }


def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/").lower()


async def ws_handler(request: web.Request) -> web.StreamResponse:
    upstream_base: str = request.app["upstream"]
    api_key: str = request.app["api_key"]
    allowed: set[str] = request.app["allowed_origins"]

    # Browsers always send Origin on a WebSocket handshake and page scripts
    # cannot forge it. Reject anything that is not on the allowlist, including
    # a missing Origin, before touching the upstream or the key.
    origin = _normalize_origin(request.headers.get("Origin", ""))
    if origin not in allowed:
        print(
            f"[{request.remote or '?'}] rejected /ws from origin {origin or '<none>'!r}",
            flush=True,
        )
        raise web.HTTPForbidden(text="origin not allowed\n")

    client_ws = web.WebSocketResponse(max_msg_size=10 * 1024 * 1024)
    await client_ws.prepare(request)

    query = dict(request.query)
    upstream_url = f"{upstream_base}?{urlencode(query)}"
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else None

    peer = request.remote or "?"
    print(f"[{peer}] → connecting upstream: {upstream_url}", flush=True)

    t_connect_start = time.monotonic()
    connect_kwargs = {"max_size": 10 * 1024 * 1024, "ping_interval": None}
    if headers:
        connect_kwargs[_HEADERS_KW] = headers
    try:
        upstream = await websockets.connect(upstream_url, **connect_kwargs)
    except Exception as e:
        err_type = type(e).__name__
        print(
            f"[{peer}] ✗ upstream connect FAILED ({err_type}): {e}",
            flush=True,
        )
        traceback.print_exc()
        await client_ws.send_json({
            "_srv_event": "upstream_connect_failed",
            "error_type": err_type,
            "error": str(e),
        })
        await client_ws.close()
        return client_ws

    connect_ms = int((time.monotonic() - t_connect_start) * 1000)
    print(f"[{peer}] ✓ upstream connected in {connect_ms} ms", flush=True)
    await client_ws.send_json({
        "_srv_event": "upstream_connected",
        "upstream_url": upstream_url,
        "connect_ms": connect_ms,
    })

    # Per-session latency tracking (all values in milliseconds).
    stats = {
        "last_audio_at": None,   # monotonic sec of most recent audio byte from client
        "last_final_at": None,   # monotonic sec of most recent final from upstream
        "partials": 0,
        "finals": 0,
        "bytes_up": 0,
    }

    async def pump_client_to_upstream() -> None:
        async for msg in client_ws:
            if msg.type == WSMsgType.BINARY:
                stats["last_audio_at"] = time.monotonic()
                stats["bytes_up"] += len(msg.data)
                await upstream.send(msg.data)
            elif msg.type == WSMsgType.TEXT:
                await upstream.send(msg.data)
            elif msg.type == WSMsgType.CLOSE:
                break
        try:
            await upstream.close()
        except Exception:
            pass

    async def pump_upstream_to_client() -> None:
        try:
            async for msg in upstream:
                now = time.monotonic()
                srv_ms = int(now * 1000)
                if isinstance(msg, bytes):
                    continue
                try:
                    payload = json.loads(msg)
                except Exception:
                    payload = {"_raw": msg}
                payload["_srv_recv_ms"] = srv_ms
                await client_ws.send_json(payload)

                # Only measurement kept: last audio byte from the client → this
                # final from the server, in milliseconds.
                is_final = bool(payload.get("is_final"))
                is_partial = (not is_final) and (
                    "transcript" in payload or "text" in payload
                )
                if is_partial:
                    stats["partials"] += 1
                if is_final:
                    stats["finals"] += 1
                    stats["last_final_at"] = now
                    if stats["last_audio_at"] is not None:
                        latency_ms = int((now - stats["last_audio_at"]) * 1000)
                        text = (payload.get("transcript") or payload.get("text") or "")[:60]
                        print(
                            f"[{peer}] last audio → final latency: {latency_ms} ms: {text!r}",
                            flush=True,
                        )
        except websockets.ConnectionClosed as e:
            print(
                f"[{peer}] upstream closed: code={e.code} reason={e.reason!r}",
                flush=True,
            )
            await client_ws.send_json({
                "_srv_event": "upstream_closed",
                "code": e.code,
                "reason": e.reason,
            })
        finally:
            _log_session_summary(peer, stats)
            if not client_ws.closed:
                await client_ws.close()

    await asyncio.gather(
        pump_client_to_upstream(),
        pump_upstream_to_client(),
        return_exceptions=True,
    )
    return client_ws


def build_app(upstream: str, api_key: str, allowed_origins: set[str]) -> web.Application:
    app = web.Application()
    app["upstream"] = upstream
    app["api_key"] = api_key
    app["allowed_origins"] = {_normalize_origin(o) for o in allowed_origins if o.strip()}
    app.add_routes([
        web.get("/", index),
        web.get("/presets.json", presets),
        web.get("/ws", ws_handler),
    ])
    return app


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="localhost")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--upstream", default=DEFAULT_UPSTREAM,
                   help="Upstream WSS URL. Defaults to api.smallest.ai. "
                        "Pass wss://api.<region>.smallest.ai/waves/v1/stt/live "
                        "to pin to a specific region.")
    p.add_argument("--allowed-origin", action="append", default=[],
                   help="Extra browser Origin allowed to open /ws, for example "
                        "http://mybox.local:8765. Repeatable. Also read from "
                        "HARNESS_ALLOWED_ORIGINS (comma-separated).")
    args = p.parse_args()

    # The key comes from the environment only. A --api-key flag would expose it
    # in `ps` output and shell history.
    api_key = os.getenv("SMALLEST_API_KEY", "")
    if not api_key:
        raise SystemExit("SMALLEST_API_KEY is not set.")

    allowed = default_allowed_origins(args.port)
    allowed.update(args.allowed_origin)
    allowed.update(os.getenv("HARNESS_ALLOWED_ORIGINS", "").split(","))
    allowed = {o for o in allowed if o.strip()}

    print(f"→ http://{args.host}:{args.port}")
    print(f"→ upstream: {args.upstream}")
    print(f"→ allowed origins: {', '.join(sorted(allowed))}")
    web.run_app(build_app(args.upstream, api_key, allowed), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
