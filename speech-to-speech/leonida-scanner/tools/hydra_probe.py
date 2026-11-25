#!/usr/bin/env python3
"""Headless check of channel 6 against the real Hydra socket.

Mints a short-lived token with the server code, connects the same way the browser does
(api_key=<token> in the query string), sends the live session config, then runs:

  1. opening line (generate_initial_response)
  2. a spoken request from a Lightning-made wav that should trigger move_unit
  3. a barge-in: ask again, then talk over the answer with a second wav
  4. a desk cue: a fixed Lightning sentence streamed as spoken input, the way the app nudges
     the pilot (text items and a bare response.create are ignored by Hydra, checked 20 Nov 2026)

It prints event types and timings only. Never audio, never tokens, never the key.
Needs: pip install websockets. Input wavs must be 16 kHz mono PCM16.
Usage: hydra_probe.py in1.wav in2.wav [--out reply.wav]
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import sys
import time
import wave
from pathlib import Path

import websockets

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import live  # noqa: E402
import server  # noqa: E402


def pcm_chunks(path: str, ms: int = 20):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2
        n = 16000 * ms // 1000
        while True:
            data = w.readframes(n)
            if not data:
                return
            if len(data) < n * 2:
                data += b"\x00" * (n * 2 - len(data))
            yield data


class Probe:
    def __init__(self) -> None:
        self.t0 = time.monotonic()
        self.events: list[tuple[float, str, str]] = []
        self.audio = bytearray()
        self.rate = live.OUTPUT_RATE
        self.calls: list[dict] = []
        self.speaking = False
        self.responses: list[dict] = []
        self.errors: list[dict] = []
        self.configured = asyncio.Event()
        self.resp_done = asyncio.Event()
        self.audio_flow = asyncio.Event()

    def log(self, kind: str, note: str = "") -> None:
        t = time.monotonic() - self.t0
        self.events.append((t, kind, note))
        print(f"{t:7.2f}s  {kind}  {note}", flush=True)


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("req_wav")
    ap.add_argument("interrupt_wav")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    if not live.available():
        print("SMALLEST_API_KEY is not set")
        return 2
    minted = live.token_response()
    url = f"{minted['ws_url']}&api_key={minted['access_token']}"
    print(f"token minted, ttl {minted['expires_in']}s, model {minted['model']}")
    pr = Probe()
    cfg = minted["session"]

    async with websockets.connect(url, max_size=None) as ws:

        async def send(obj: dict) -> None:
            await ws.send(json.dumps(obj))

        pending_calls: dict[str, dict] = {}
        create_timer: asyncio.Task | None = None

        async def debounce_create() -> None:
            await asyncio.sleep(0.2)
            await send({"type": "response.create"})
            pr.log("-> response.create")

        async def reader() -> None:
            nonlocal create_timer
            async for raw in ws:
                evt = json.loads(raw)
                t = evt.get("type", "?")
                if t == "response.output_audio.delta":
                    pr.audio += base64.b64decode(evt["delta"])
                    if not pr.audio_flow.is_set():
                        pr.audio_flow.set()
                        pr.log("<- first audio delta of response")
                    continue
                if t == "session.created":
                    pr.log("<- session.created")
                    await send({"type": "session.configure", "session": cfg})
                    pr.log("-> session.configure")
                elif t == "session.configured":
                    pr.rate = evt["session"].get("output_audio_sample_rate", pr.rate)
                    echoed = sorted(evt["session"].keys())
                    pr.log("<- session.configured", f"rate={pr.rate} keys={echoed}")
                    pr.configured.set()
                elif t == "response.created":
                    pr.speaking = True
                    pr.audio_flow.clear()
                    pr.resp_done.clear()
                    pr.log("<- response.created")
                elif t == "response.function_call_arguments.done":
                    args_ = json.loads(evt["arguments"])
                    pr.calls.append({"name": evt["name"], "args": args_})
                    pr.log("<- tool call", f"{evt['name']} {json.dumps(args_)}")
                    if evt["name"] == "move_unit":
                        out = {"ok": bool(live.validate_move(args_))}
                    else:
                        out = {"ok": True}
                    await send(
                        {
                            "type": "conversation.item.create",
                            "item": {
                                "type": "function_call_output",
                                "call_id": evt["call_id"],
                                "output": json.dumps(out),
                            },
                        }
                    )
                    if create_timer and not create_timer.done():
                        create_timer.cancel()
                    create_timer = asyncio.create_task(debounce_create())
                elif t == "response.done":
                    r = evt["response"]
                    pr.speaking = False
                    d = {
                        "status": r.get("status"),
                        "reason": (r.get("status_details") or {}).get("reason"),
                        "usage": r.get("usage"),
                    }
                    pr.responses.append(d)
                    pr.log("<- response.done", json.dumps(d))
                    pr.resp_done.set()
                elif t == "error":
                    pr.errors.append(evt.get("error", {}))
                    pr.log("<- ERROR", json.dumps(evt.get("error", {}))[:300])
                elif t in {
                    "input_audio_buffer.speech_started",
                    "input_audio_buffer.speech_stopped",
                    "conversation.item.done",
                    "conversation.item.added",
                    "response.output_audio.done",
                    "warning",
                }:
                    note = ""
                    if t.startswith("conversation.item"):
                        it = evt.get("item", {})
                        note = f"{it.get('type')} {it.get('role')} {it.get('status')}"
                    pr.log(f"<- {t}", note)
                else:
                    pr.log(f"<- {t}")

        async def mic(path: str | None) -> None:
            """Stream a wav in real time, then keep the socket warm with silence."""
            if path:
                for chunk in pcm_chunks(path):
                    await send({"type": "input_audio_buffer.append", "audio": base64.b64encode(chunk).decode()})
                    await asyncio.sleep(0.02)

        silence = base64.b64encode(b"\x00" * 640).decode()

        async def keepalive() -> None:
            while True:
                await send({"type": "input_audio_buffer.append", "audio": silence})
                await asyncio.sleep(0.02)

        rd = asyncio.create_task(reader())
        await asyncio.wait_for(pr.configured.wait(), 15)
        ka = asyncio.create_task(keepalive())

        # 1. opening line
        pr.log("== phase 1: wait for the opening line")
        await asyncio.wait_for(pr.resp_done.wait(), 40)

        # 2. spoken request, tool call expected
        ka.cancel()
        pr.log("== phase 2: spoken request")
        await mic(args.req_wav)
        ka = asyncio.create_task(keepalive())
        for _ in range(60):
            await asyncio.sleep(0.5)
            if pr.calls and pr.resp_done.is_set():
                break
        await asyncio.sleep(0.5)
        # wait until the narration after the tool output is done
        try:
            await asyncio.wait_for(pr.resp_done.wait(), 30)
        except asyncio.TimeoutError:
            pass

        # 3. barge-in: ask again, then talk over the answer with the second clip
        pr.log("== phase 3: barge-in")
        ka.cancel()
        pr.resp_done.clear()
        pr.audio_flow.clear()
        asker = asyncio.create_task(mic(args.req_wav))
        try:
            await asyncio.wait_for(pr.audio_flow.wait(), 40)
        except asyncio.TimeoutError:
            pr.log("no audio came back to the second request")
        await asker
        await asyncio.sleep(0.8)
        spoke_over = pr.speaking
        pr.log("-> speaking over the pilot", f"pilot still speaking={spoke_over}")
        await mic(args.interrupt_wav)
        ka = asyncio.create_task(keepalive())
        try:
            await asyncio.wait_for(pr.resp_done.wait(), 30)
        except asyncio.TimeoutError:
            pass
        await asyncio.sleep(5)

        # 4. desk cue: the studio talks to the pilot on the radio (audio in, same as in the app)
        pr.log("== phase 4: desk cue")
        cue_text = live.desk_cue("at", "jet_ski", "sandbar_inlet")
        wav_bytes, _ = server.synthesize(cue_text, live.DESK_VOICE, 16000)
        cue_path = Path("/tmp/desk_cue_16k.wav")
        cue_path.write_bytes(wav_bytes)
        pr.log("-> desk cue", cue_text)
        pr.resp_done.clear()
        before = len(pr.calls)
        ka.cancel()
        await mic(str(cue_path))
        ka = asyncio.create_task(keepalive())
        try:
            await asyncio.wait_for(pr.resp_done.wait(), 30)
        except asyncio.TimeoutError:
            pr.log("no response to the desk cue")
        await asyncio.sleep(4)
        pr.log("desk cue produced tool calls", str(len(pr.calls) - before))
        ka.cancel()
        rd.cancel()

    out = Path(args.out) if args.out else None
    if out:
        with wave.open(str(out), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(pr.rate)
            w.writeframes(bytes(pr.audio))
    secs = len(pr.audio) / 2 / pr.rate
    print("---- summary")
    print(f"reply audio: {secs:.1f}s at {pr.rate} Hz, {len(pr.audio)} bytes")
    print("tool calls:", json.dumps(pr.calls))
    print("responses:", json.dumps([{k: v for k, v in r.items() if k != 'usage'} for r in pr.responses]))
    print("errors:", json.dumps(pr.errors))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
