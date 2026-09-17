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
from pathlib import Path
from urllib.parse import urlencode

import websockets
from aiohttp import WSMsgType, web


DEFAULT_UPSTREAM = "wss://api.smallest.ai/waves/v1/stt/live"
HERE = Path(__file__).parent

# websockets>=13 renamed extra_headers -> additional_headers.
_HEADERS_KW = (
    "additional_headers"
    if int(websockets.__version__.split(".")[0]) >= 13
    else "extra_headers"
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

    t_connect_start = time.monotonic()
    connect_kwargs = {"max_size": 10 * 1024 * 1024, "ping_interval": None}
    if headers:
        connect_kwargs[_HEADERS_KW] = headers
    try:
        upstream = await websockets.connect(upstream_url, **connect_kwargs)
    except Exception as e:
        await client_ws.send_json({
            "_srv_event": "upstream_connect_failed",
            "error": str(e),
        })
        await client_ws.close()
        return client_ws

    connect_ms = int((time.monotonic() - t_connect_start) * 1000)
    await client_ws.send_json({
        "_srv_event": "upstream_connected",
        "upstream_url": upstream_url,
        "connect_ms": connect_ms,
    })

    async def pump_client_to_upstream() -> None:
        async for msg in client_ws:
            if msg.type == WSMsgType.BINARY:
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
                srv_ms = int(time.monotonic() * 1000)
                if isinstance(msg, bytes):
                    continue
                try:
                    payload = json.loads(msg)
                except Exception:
                    payload = {"_raw": msg}
                payload["_srv_recv_ms"] = srv_ms
                await client_ws.send_json(payload)
        except websockets.ConnectionClosed as e:
            await client_ws.send_json({
                "_srv_event": "upstream_closed",
                "code": e.code,
                "reason": e.reason,
            })
        finally:
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
