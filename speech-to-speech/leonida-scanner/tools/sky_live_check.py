#!/usr/bin/env python3
"""End to end check of channel 6 tool calling against the real Hydra socket, through the hosted site.

Takes the token response the hosted site returns behind its invite gate (a JSON file; its token
lives 60 s and is never printed), opens the socket the way the browser does, sends the session
config exactly as served, then streams spoken commands (16 kHz mono wavs) one by one. Every tool
call is answered with sky.dispatch, the same meaning the browser computes, plus a short result,
and the pilot's caption text is printed. Prints events, tool calls, captions and timings only.

Usage: sky_live_check.py token.json cmd1.wav [cmd2.wav ...]
"""

from __future__ import annotations

import asyncio
import base64
import json
import sys
import time
import wave
from pathlib import Path

import websockets

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import sky  # noqa: E402


def frames(path: str):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2
        while True:
            d = w.readframes(320)
            if not d:
                return
            yield d + b"\x00" * (640 - len(d))


async def main() -> int:
    tok = json.loads(Path(sys.argv[1]).read_text())
    wavs = sys.argv[2:]
    url = f"{tok['ws_url']}&api_key={tok['access_token']}"
    t0 = time.monotonic()
    log = lambda *a: print(f"{time.monotonic() - t0:6.2f}s", *a, flush=True)  # noqa: E731
    done = asyncio.Event()
    configured = asyncio.Event()
    state = {"text": "", "last_tool": None, "calls": [], "heli": (476.0, 620.0)}
    silence = base64.b64encode(b"\x00" * 640).decode()
    quiet = asyncio.Event()
    quiet.set()

    async with websockets.connect(url, max_size=None) as ws:
        async def send(o):
            await ws.send(json.dumps(o))

        timer = None

        async def create_later():
            await asyncio.sleep(0.2)
            await send({"type": "response.create"})

        async def reader():
            nonlocal timer
            async for raw in ws:
                e = json.loads(raw)
                t = e.get("type")
                if t == "session.created":
                    await send({"type": "session.configure", "session": tok["session"]})
                elif t == "session.configured":
                    configured.set()
                    log("session configured")
                elif t == "response.created":
                    state["text"] = ""
                    done.clear()
                elif t == "response.output_audio_transcript.delta":
                    state["text"] += e.get("delta", "")
                elif t == "response.output_audio.delta":
                    if state["last_tool"] and "first_audio" not in state["last_tool"]:
                        state["last_tool"]["first_audio"] = round(time.monotonic() - state["last_tool"]["at"], 2)
                elif t == "response.function_call_arguments.done":
                    args = json.loads(e.get("arguments") or "{}")
                    meaning = sky.dispatch(e["name"], args, state["heli"])
                    if meaning.get("ok") and "x" in meaning:
                        state["heli"] = (float(meaning["x"]), float(meaning["y"]))
                    out = {k: v for k, v in meaning.items() if k in ("ok", "name", "error", "suggest", "on")}
                    if meaning.get("ok") and e["name"] in ("fly_to", "circle"):
                        out = {"ok": True, "place": meaning["name"], "action": "circling" if e["name"] == "circle" else "heading to"}
                    if meaning.get("ok") and e["name"] == "follow":
                        out = {"ok": True, "unit": meaning["name"]}
                    if e["name"] == "report":
                        out = {"ok": True, "over": "Coquina Row", "following": "", "spotlight": "off", "below": ["Sergeant Holt"]}
                    call = {"tool": e["name"], "args": args, "result": out, "at": time.monotonic()}
                    state["calls"].append(call)
                    state["last_tool"] = call
                    log("TOOL", e["name"], json.dumps(args), "->", json.dumps(out))
                    await send({"type": "conversation.item.create", "item": {"type": "function_call_output", "call_id": e["call_id"], "output": json.dumps(out)}})
                    if timer and not timer.done():
                        timer.cancel()
                    timer = asyncio.create_task(create_later())
                elif t == "response.done":
                    st = (e.get("response") or {}).get("status")
                    if state["text"].strip():
                        log("PILOT", f"[{st}]", state["text"].strip())
                    done.set()
                elif t == "error":
                    log("ERROR", json.dumps(e.get("error"))[:200])

        async def keepalive():
            while True:
                if quiet.is_set():
                    await send({"type": "input_audio_buffer.append", "audio": silence})
                await asyncio.sleep(0.02)

        rd = asyncio.create_task(reader())
        await asyncio.wait_for(configured.wait(), 15)
        ka = asyncio.create_task(keepalive())
        await asyncio.wait_for(done.wait(), 30)  # opening line
        await asyncio.sleep(1.0)
        for w in wavs:
            log("CALLER says", Path(w).stem)
            quiet.clear()
            done.clear()
            for f in frames(w):
                await send({"type": "input_audio_buffer.append", "audio": base64.b64encode(f).decode()})
                await asyncio.sleep(0.02)
            quiet.set()
            spoke_at = time.monotonic()
            # wait for the narration after any tool call, up to 15 s
            end = spoke_at + 15
            while time.monotonic() < end:
                try:
                    await asyncio.wait_for(done.wait(), max(0.1, end - time.monotonic()))
                except TimeoutError:
                    break
                done.clear()
                await asyncio.sleep(1.2)
                if not done.is_set() and not (timer and not timer.done()):
                    break
            await asyncio.sleep(0.8)
        ka.cancel()
        rd.cancel()
    print("SUMMARY", json.dumps([{k: c[k] for k in ("tool", "args", "result")} | ({"first_audio_s": c["first_audio"]} if "first_audio" in c else {}) for c in state["calls"]]))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
