#!/usr/bin/env python3
"""Offline check for Phone Draw.

Confirms tool schemas register, the board accepts frames, and the draw/edit
path works end to end with the OpenAI image call stubbed out.

Usage:
    uv run smoke_test.py
    LIVE=1 uv run smoke_test.py   # one real draw at quality=low, saves out/live-draw.png
"""
import asyncio, base64, os, subprocess, sys, json, urllib.request, types
from pathlib import Path

# Placeholder so the OpenAI client can be constructed in the offline path.
# A real key is required only when LIVE=1, and should come from the environment.
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ["BOARD_URL"] = "http://127.0.0.1:8799"
import server

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
OUT = Path("out")


async def main():
    board = subprocess.Popen(
        [sys.executable, "board.py"], env={**os.environ, "PORT": "8799"}
    )
    try:
        for _ in range(20):
            try:
                urllib.request.urlopen("http://127.0.0.1:8799/state")
                break
            except OSError:
                await asyncio.sleep(0.1)
        else:
            raise RuntimeError("board.py did not start on port 8799")

        a = server.SketchArtist()
        names = [s["function"]["name"] for s in a.tools.get_schemas()]
        print("tools:", names)
        assert names and set(names) == {"draw_new", "edit_current"}

        live = os.getenv("LIVE") == "1"
        if not live:
            fake = types.SimpleNamespace(
                data=[types.SimpleNamespace(b64_json=base64.b64encode(PNG).decode())]
            )

            async def gen(**k):
                return fake

            async def edit(**k):
                return fake

            a.studio.oa.images.generate = gen
            a.studio.oa.images.edit = edit

            before = json.loads(await a.edit_current("give it a hat"))
            print("edit with no picture:", before["status"])
            assert before["status"] == "error"

            draw = json.loads(await a.draw_new("a corgi astronaut, flat illustration"))
            print("draw:", draw)
            assert draw["status"] == "done"

            edited = json.loads(await a.edit_current("give the corgi a red scarf"))
            print("edit:", edited)
            assert edited["status"] == "done"

            st = json.load(urllib.request.urlopen("http://127.0.0.1:8799/state"))
            print("board version:", st["version"], "caption:", st["caption"])
            assert st["version"] == 2
            print("OK")
            return

        OUT.mkdir(exist_ok=True)
        prompt = "a simple red apple on a white background, flat icon"
        result = json.loads(await a.draw_new(prompt))
        print("live draw:", result)
        assert result["status"] == "done", result
        if a.studio.current_png:
            (OUT / "live-draw.png").write_bytes(a.studio.current_png)
            print("saved: out/live-draw.png", "bytes:", len(a.studio.current_png))
        st = json.load(urllib.request.urlopen("http://127.0.0.1:8799/state"))
        print("board version:", st["version"], "caption:", st["caption"], "status:", st["status"])
        assert st["version"] == 1
        print("OK")
    finally:
        board.terminate()
        try:
            board.wait(timeout=5)
        except subprocess.TimeoutExpired:
            board.kill()


asyncio.run(main())
