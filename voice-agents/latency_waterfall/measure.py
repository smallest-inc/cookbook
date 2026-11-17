"""Measure where the time goes in one voice agent turn.

Streams a recorded sentence into Pulse STT at real time (like a microphone),
sends the final transcript to Electron (Smallest's LLM, OpenAI-compatible), streams the first sentence of the reply
into Lightning TTS, and timestamps every step on one monotonic clock.

All times in the output are milliseconds relative to the moment the speaker
stopped talking (t = 0). Negative times happened while they were still talking.

usage: python measure.py --wav question.wav [--out runs] [--runs 10] [--eou 300]
       python measure.py --say "Can you move my appointment to Friday?"
env:   SMALLEST_API_KEY (Pulse, Electron and Lightning all use it)
"""

import argparse
import asyncio
import base64
import json
import os
import re
import statistics
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import websockets
from dotenv import load_dotenv
from openai import AsyncOpenAI
from scipy.signal import resample_poly

STT_URL = (
    "wss://api.smallest.ai/waves/v1/stt/live?model=pulse&language=en"
    "&encoding=linear16&sample_rate=16000&word_timestamps=true&vad_events=true"
)
TTS_URL = "wss://api.smallest.ai/waves/v1/tts/live"
LLM_BASE = "https://api.smallest.ai/waves/v1"
TTS_MODEL = "lightning_v3.1_pro"
TTS_VOICE = "kelsey"
TTS_RATE = 24000
FRAME = 0.02  # 20 ms, the usual mic frame
load_dotenv()

SYSTEM = (
    "You are the AI receptionist for Brightside Dental, a demo clinic. "
    "Friday has openings at 2:30 and 4:15 pm. Answer in one or two short, "
    "friendly spoken sentences. No lists, no markdown."
)
SENTENCE_END = re.compile(r"[.!?](\s|$)")


def load_caller(path):
    """16 kHz mono int16 PCM plus the speech start and end times (seconds)."""
    x, sr = sf.read(path, dtype="float32")
    if x.ndim > 1:
        x = x.mean(1)
    if sr != 16000:
        x = resample_poly(x, 16000, sr).astype("float32")
    n = int(FRAME * 16000)
    rms = np.array([np.sqrt(np.mean(x[i : i + n] ** 2)) for i in range(0, len(x) - n, n)])
    if len(rms) == 0 or rms.max() < 1e-4:
        raise ValueError(f"{path}: no speech found (the file is silent or shorter than {FRAME * 1000:.0f} ms)")
    loud = np.where(rms > rms.max() * 0.05)[0]
    start, end = loud[0] * FRAME, (loud[-1] + 1) * FRAME
    lead, tail = 0.6, 3.0  # room tone before, silence after (the mic keeps streaming)
    pcm = np.concatenate([np.zeros(int(lead * 16000)), x, np.zeros(int(tail * 16000))])
    pcm = (np.clip(pcm, -1, 1) * 32767).astype("<i2")
    return pcm, lead + start, lead + end, x


async def one_turn(pcm, speech_start, speech_end, llm_model, oai, eou_ms=None, system=SYSTEM):
    ev = []  # (seconds since first audio frame, kind, payload)
    hdr = {"Authorization": f"Bearer {os.environ['SMALLEST_API_KEY']}"}

    # Connections are opened before the caller speaks, as a live agent keeps them warm.
    url = STT_URL + (f"&eou_timeout_ms={eou_ms}" if eou_ms else "")
    stt = await websockets.connect(url, additional_headers=hdr, max_size=None)
    tts = await websockets.connect(TTS_URL, additional_headers=hdr, max_size=None)
    await oai.chat.completions.create(model=llm_model, max_tokens=1, messages=[{"role": "user", "content": "hi"}])  # warm the HTTPS connection

    rtts = []
    for _ in range(5):  # network round trip to the API edge, for context on every bar
        p0 = time.perf_counter()
        await (await tts.ping())
        rtts.append((time.perf_counter() - p0) * 1000)

    t0 = time.perf_counter()
    now = lambda: time.perf_counter() - t0
    final_text, heard, triggered = [], [], asyncio.Event()
    reply_audio, first_audio = bytearray(), asyncio.Event()
    flushes, last_flush = 0, 0.0
    tts_done, llm_finished = asyncio.Event(), asyncio.Event()

    audio_done = asyncio.Event()

    async def send_audio():
        n = int(FRAME * 16000)
        for k, i in enumerate(range(0, len(pcm), n)):
            delay = t0 + k * FRAME - time.perf_counter()
            if delay > 0:
                await asyncio.sleep(delay)
            await stt.send(pcm[i : i + n].tobytes())
        audio_done.set()

    async def read_stt():
        # Like a live agent: the first final transcript starts the reply, even if the
        # speaker is still talking. Later finals are logged to show what got cut off.
        while not (audio_done.is_set() and triggered.is_set()):
            try:
                raw = await asyncio.wait_for(stt.recv(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            t, d = now(), json.loads(raw)
            if d.get("type") in ("speech_started", "speech_ended"):
                ev.append((t, d["type"], {"audio_t": d.get("timestamp")}))
                continue
            text = (d.get("transcript") or "").strip()
            if not text:
                continue
            if d.get("is_final"):
                final_text.append(text)
                ev.append((t, "stt_final", {"text": text}))
                if not triggered.is_set():
                    heard.append(text)
                    triggered.set()
            else:
                ev.append((t, "stt_partial", {"text": " ".join(final_text + [text])}))

    async def run_llm():
        nonlocal flushes, last_flush
        await triggered.wait()
        user = heard[0]
        ev.append((now(), "llm_request", {"text": user}))
        stream = await oai.chat.completions.create(
            model=llm_model,
            stream=True,
            temperature=0.3,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        buf, sent, got_first = "", 0, False
        async for chunk in stream:
            piece = chunk.choices[0].delta.content if chunk.choices else None
            if not piece:
                continue
            if not got_first:
                got_first = True
                ev.append((now(), "llm_first_token", {}))
            buf += piece
            m = SENTENCE_END.search(buf, sent)
            if sent == 0 and m and len(buf[: m.end()].split()) >= 3:
                first = buf[: m.end()].strip()
                ev.append((now(), "llm_first_sentence", {"text": first}))
                await tts.send(json.dumps({"text": first, "voice_id": TTS_VOICE, "model": TTS_MODEL, "sample_rate": TTS_RATE}))
                await tts.send(json.dumps({"flush": True}))
                flushes += 1
                last_flush = now()
                ev.append((now(), "tts_request", {"text": first}))
                sent = m.end()
        rest = buf[sent:].strip()
        ev.append((now(), "llm_done", {"text": buf.strip()}))
        if rest:
            if sent == 0:  # short reply with no early sentence break
                ev.append((now(), "llm_first_sentence", {"text": rest}))
            await tts.send(json.dumps({"text": rest, "voice_id": TTS_VOICE, "model": TTS_MODEL, "sample_rate": TTS_RATE}))
            await tts.send(json.dumps({"flush": True}))
            flushes += 1
            last_flush = now()
            if sent == 0:
                ev.append((now(), "tts_request", {"text": rest}))
        llm_finished.set()
        if flushes == 0:
            raise RuntimeError("LLM produced no speakable text")

    async def read_tts():
        # The socket sends one "complete" only after it goes idle (about 4 s), not one per
        # flush. So the reply is done once the LLM has finished, audio has arrived after
        # the last flush was sent, and the socket then stays quiet for a moment.
        last_chunk = None
        while True:
            try:
                raw = await asyncio.wait_for(tts.recv(), timeout=0.6)
            except asyncio.TimeoutError:
                if llm_finished.is_set() and last_chunk is not None and last_chunk > last_flush:
                    ev.append((last_chunk, "tts_done", {}))
                    tts_done.set()
                    return
                continue
            d = json.loads(raw)
            if d.get("status") == "chunk":
                b = base64.b64decode(d["data"]["audio"])
                if b[:4] == b"RIFF":
                    b = b[44:]
                if not first_audio.is_set():
                    first_audio.set()
                    ev.append((now(), "tts_first_audio", {}))
                last_chunk = now()
                reply_audio.extend(b)
            elif d.get("status") == "error":
                raise RuntimeError(f"TTS error: {d}")

    tasks = [asyncio.create_task(c) for c in (send_audio(), read_stt(), run_llm(), read_tts())]
    try:
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=30)
    finally:
        for t in tasks:
            t.cancel()
        await stt.close()
        await tts.close()

    def at(kind):
        return next(t for t, k, _ in ev if k == kind)

    ms = lambda t: round((t - speech_end) * 1000)
    stages = {
        "endpointing": ms(at("llm_request")) - 0,
        "llm_first_token": ms(at("llm_first_token")) - ms(at("llm_request")),
        "llm_first_sentence": ms(at("llm_first_sentence")) - ms(at("llm_first_token")),
        "tts_first_audio": ms(at("tts_first_audio")) - ms(at("tts_request")),
    }
    stages["total"] = ms(at("tts_first_audio"))
    return {
        "speech_start_ms": ms(speech_start),
        "eou_timeout_ms": eou_ms or "default",
        "network_rtt_ms": round(statistics.median(rtts)),
        "events": [{"t_ms": ms(t), "kind": k, **p} for t, k, p in ev],
        "stages_ms": stages,
        "heard_before_reply": heard[0],
        "transcript": " ".join(final_text).strip(),
        "cut_in": ms(at("llm_request")) < 0,
        "reply": next(p["text"] for _, k, p in ev if k == "llm_done"),
    }, bytes(reply_audio)


async def speak(text, path):
    """Synthesize the question with Lightning, so the script runs without a recording."""
    hdr = {"Authorization": f"Bearer {os.environ['SMALLEST_API_KEY']}"}
    async with websockets.connect(TTS_URL, additional_headers=hdr, max_size=None) as ws:
        await ws.send(json.dumps({"text": text, "voice_id": "winston", "model": TTS_MODEL, "sample_rate": 16000}))
        await ws.send(json.dumps({"flush": True}))
        pcm = bytearray()
        while True:
            try:
                d = json.loads(await asyncio.wait_for(ws.recv(), timeout=1.5))
            except asyncio.TimeoutError:
                break
            if d.get("status") == "chunk":
                b = base64.b64decode(d["data"]["audio"])
                pcm.extend(b[44:] if b[:4] == b"RIFF" else b)
            elif d.get("status") == "error":
                raise RuntimeError(f"TTS error: {d}")
    sf.write(path, np.frombuffer(bytes(pcm), "<i2"), 16000)
    return str(path)


async def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--wav", help="a recording of one spoken question (any sample rate)")
    src.add_argument("--say", help="no recording? Lightning speaks this question for you")
    ap.add_argument("--out", default="runs")
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--llm", default="electron")
    ap.add_argument("--system", default=SYSTEM, help="system prompt for the agent")
    ap.add_argument("--eou", type=int, help="Pulse eou_timeout_ms; omit for the server default")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    caller = a.wav or await speak(a.say, out / "question.wav")
    pcm, s0, s1, _ = load_caller(caller)
    oai = AsyncOpenAI(api_key=os.environ["SMALLEST_API_KEY"], base_url=LLM_BASE)
    runs = []
    for i in range(a.runs):
        try:
            r, audio = await one_turn(pcm, s0, s1, a.llm, oai, a.eou, a.system)
        except Exception as e:  # keep going, report the failure honestly
            print(f"run {i}: failed: {e!r}")
            runs.append({"run": i, "error": repr(e)})
            continue
        r.update(run=i, llm=a.llm, tts_model=TTS_MODEL, tts_voice=TTS_VOICE, caller=Path(caller).name)
        sf.write(out / f"reply_{i:02d}.wav", np.frombuffer(audio, "<i2"), TTS_RATE)
        runs.append(r)
        print(f"run {i}: {r['stages_ms']}  heard={r['transcript']!r}")
        await asyncio.sleep(2)
    ok = [r for r in runs if "stages_ms" in r]
    summary = {k: statistics.median(r["stages_ms"][k] for r in ok) for k in ok[0]["stages_ms"]} if ok else {}
    median_run = min(ok, key=lambda r: abs(r["stages_ms"]["total"] - summary["total"]))["run"] if ok else None
    (out / "runs.json").write_text(json.dumps({"runs": runs, "median_ms": summary, "median_run": median_run, "ok": len(ok), "of": len(runs)}, indent=1))
    print("median", summary, "closest run", median_run, f"{len(ok)}/{len(runs)} ok")


if __name__ == "__main__":
    asyncio.run(main())
