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
    def _ms(a, b):
        return int((b - a) * 1000) if (a is not None and b is not None) else None

    print(
        f"[{peer}] session end · "
        f"first_partial_ms={_ms(s['first_audio_at'], s['first_partial_at'])} "
        f"first_final_ms={_ms(s['first_audio_at'], s['first_final_at'])} "
        f"last_final_ms={_ms(s['first_audio_at'], s['last_final_at'])} "
        f"partials={s['partials']} finals={s['finals']} bytes_up={s['bytes_up']}",
        flush=True,
    )


async def index(_request: web.Request) -> web.Response:
    return web.Response(
        body=(HERE / "live.html").read_bytes(),
        content_type="text/html",
    )


async def ws_handler(request: web.Request) -> web.WebSocketResponse:
    upstream_base: str = request.app["upstream"]
    api_key: str = request.app["api_key"]

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
    print(f"[{peer}] ✓ upstream connected in {connect_ms}ms", flush=True)
    await client_ws.send_json({
        "_srv_event": "upstream_connected",
        "upstream_url": upstream_url,
        "connect_ms": connect_ms,
    })

    # Per-session latency tracking (server-side view).
    stats = {
        "first_audio_at": None,   # monotonic sec of first byte from client
        "first_partial_at": None,
        "first_final_at": None,
        "last_final_at": None,
        "partials": 0,
        "finals": 0,
        "bytes_up": 0,
    }

    async def pump_client_to_upstream() -> None:
        async for msg in client_ws:
            if msg.type == WSMsgType.BINARY:
                if stats["first_audio_at"] is None:
                    stats["first_audio_at"] = time.monotonic()
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

                # Log the first partial and each final with latency vs. first
                # client audio byte — the numbers customers actually care about.
                is_final = bool(payload.get("is_final"))
                is_partial = (not is_final) and (
                    "transcript" in payload or "text" in payload
                )
                if is_partial and stats["first_partial_at"] is None:
                    stats["first_partial_at"] = now
                    if stats["first_audio_at"] is not None:
                        ms = int((now - stats["first_audio_at"]) * 1000)
                        print(f"[{peer}] first partial: {ms}ms since first audio", flush=True)
                if is_partial:
                    stats["partials"] += 1
                if is_final:
                    stats["finals"] += 1
                    if stats["first_final_at"] is None:
                        stats["first_final_at"] = now
                        if stats["first_audio_at"] is not None:
                            ms = int((now - stats["first_audio_at"]) * 1000)
                            text = (payload.get("transcript") or payload.get("text") or "")[:60]
                            print(f"[{peer}] first final: {ms}ms since first audio — {text!r}", flush=True)
                    stats["last_final_at"] = now
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


def build_app(upstream: str, api_key: str) -> web.Application:
    app = web.Application()
    app["upstream"] = upstream
    app["api_key"] = api_key
    app.add_routes([web.get("/", index), web.get("/ws", ws_handler)])
    return app


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="localhost")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--upstream", default=DEFAULT_UPSTREAM,
                   help="Upstream WSS URL. Defaults to api.smallest.ai. "
                        "Pass wss://api.<region>.smallest.ai/waves/v1/stt/live "
                        "to pin to a specific region.")
    p.add_argument("--api-key", default="",
                   help="Falls back to SMALLEST_API_KEY env var.")
    args = p.parse_args()

    api_key = args.api_key or os.getenv("SMALLEST_API_KEY", "")
    if not api_key:
        raise SystemExit("SMALLEST_API_KEY not set (env or --api-key).")

    print(f"→ http://{args.host}:{args.port}")
    print(f"→ upstream: {args.upstream}")
    web.run_app(build_app(args.upstream, api_key), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
