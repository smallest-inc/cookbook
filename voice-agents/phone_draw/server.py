#!/usr/bin/env python3
"""Phone Draw Atoms crew.

Call or chat with the agent, describe a picture, and watch it appear on the
board while you are still talking.

Usage:
    uv run server.py
    smallestai agent-crew chat
"""
import asyncio
import base64
import json
import os

from dotenv import load_dotenv
load_dotenv()

import httpx
from openai import AsyncOpenAI, BadRequestError, APIError

from smallestai.atoms.crew.clients.openai import OpenAIClient
from smallestai.atoms.crew.nodes import OutputCrewNode
from smallestai.atoms.crew.server import AtomsCrewApp
from smallestai.atoms.crew.session import CrewSession
from smallestai.atoms.crew.tools import ToolRegistry, function_tool

IMAGE_MODEL = os.getenv("IMAGE_MODEL", "gpt-image-2.6-flare")
IMAGE_QUALITY = os.getenv("IMAGE_QUALITY", "low")
BOARD_URL = os.getenv("BOARD_URL", "http://localhost:8765")
BOARD_TOKEN = os.getenv("BOARD_TOKEN", "")

SYSTEM_PROMPT = """You are a sketch artist on a phone line, built with Smallest AI Atoms.
Your first sentence on every call must say you are an AI that draws what the caller
describes, and that the picture shows up on their screen.
You are speaking, not writing: one or two short sentences, no lists, no markdown, no URLs.
When the caller describes a new picture, call draw_new with a clear, visual prompt.
When they want to change the current picture, call edit_current with only the change.
Never put trademarked or celebrity names in the image prompt (no Yoda, Mickey, Elsa,
real actors, etc.). Describe the look instead, e.g. "small green alien with big ears".
After draw_new or edit_current returns status "done", say the picture should be on
their screen now and ask what to change next.
If a tool returns status "error", briefly apologize in plain words (no jargon, no
"safety system"), say that description did not work, and ask them to try a simpler
or different description. Do not claim the picture is on screen when the tool erred.
Never describe the finished image as if you can see it; you only know what you asked for.
Refuse anything sexual, violent, or that shows a real person, and say why in one sentence."""


def _short_err(exc: BaseException) -> str:
    msg = str(exc) or type(exc).__name__
    low = msg.lower()
    if "safety" in low or "rejected" in low or "content_policy" in low:
        return "that description was blocked. Try different wording"
    if "timeout" in low:
        return "drawing timed out. Try again"
    # Keep board text short; strip request IDs / JSON blobs.
    cut = msg.split(" - ", 1)[-1] if " - " in msg else msg
    cut = cut.split(". If you believe")[0].strip()
    return (cut[:90] + "…") if len(cut) > 90 else cut or "draw failed"


class Studio:
    """Holds the current picture so edits stay on the same image."""

    def __init__(self):
        self.oa = AsyncOpenAI()  # reads OPENAI_API_KEY
        self.current_png: bytes | None = None
        self.lock = asyncio.Lock()

    async def _push(self, png: bytes, caption: str):
        headers = {"Authorization": f"Bearer {BOARD_TOKEN}"} if BOARD_TOKEN else {}
        async with httpx.AsyncClient(timeout=60) as http:
            r = await http.post(f"{BOARD_URL}/frame", headers=headers, json={
                "caption": caption, "png_b64": base64.b64encode(png).decode()})
            r.raise_for_status()

    async def _status(self, text: str):
        headers = {"Authorization": f"Bearer {BOARD_TOKEN}"} if BOARD_TOKEN else {}
        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.post(f"{BOARD_URL}/status", headers=headers, json={"text": text})
            r.raise_for_status()

    async def generate(self, prompt: str) -> dict:
        async with self.lock:
            await self._status(f"drawing: {prompt}")
            try:
                r = await self.oa.images.generate(
                    model=IMAGE_MODEL, prompt=prompt,
                    quality=IMAGE_QUALITY, size="1024x1024")
                self.current_png = base64.b64decode(r.data[0].b64_json)
                await self._push(self.current_png, prompt)
                return {"status": "done", "prompt": prompt}
            except (BadRequestError, APIError, httpx.HTTPError, OSError, ValueError) as e:
                reason = _short_err(e)
                try:
                    await self._status(f"couldn't draw: {reason}")
                except Exception:
                    pass
                return {"status": "error", "reason": reason}

    async def edit(self, change: str) -> dict:
        async with self.lock:
            if self.current_png is None:
                return {"status": "error", "reason": "no picture yet, ask what to draw first"}
            await self._status(f"editing: {change}")
            try:
                r = await self.oa.images.edit(
                    model=IMAGE_MODEL, prompt=change,
                    image=("current.png", self.current_png, "image/png"),
                    quality=IMAGE_QUALITY, size="1024x1024")
                self.current_png = base64.b64decode(r.data[0].b64_json)
                await self._push(self.current_png, change)
                return {"status": "done", "change": change}
            except (BadRequestError, APIError, httpx.HTTPError, OSError, ValueError) as e:
                reason = _short_err(e)
                try:
                    await self._status(f"couldn't edit: {reason}")
                except Exception:
                    pass
                return {"status": "error", "reason": reason}


class SketchArtist(OutputCrewNode):
    def __init__(self):
        super().__init__(name="phone-sketch-artist")
        self.llm = OpenAIClient(model=os.getenv("CHAT_MODEL", "gpt-4.1-mini"),
                                temperature=0.6, max_tokens=150)
        self.studio = Studio()
        self.tools = ToolRegistry()
        self.tools.discover(self)
        self.context.add_message({"role": "system", "content": SYSTEM_PROMPT})

    @function_tool()
    async def draw_new(self, prompt: str) -> str:
        """Start a brand new picture. Await the result so failures reach the caller.

        Args:
            prompt: A clear visual description of the picture to draw.
                    Do not include trademarked character names.
        """
        return json.dumps(await self.studio.generate(prompt))

    @function_tool()
    async def edit_current(self, change: str) -> str:
        """Change the picture that is already on screen, keeping everything else the same.

        Args:
            change: Only the change the caller asked for, e.g. "give the dog a red hat".
        """
        return json.dumps(await self.studio.edit(change))

    async def generate_response(self):
        schemas = self.tools.get_schemas()
        resp = await self.llm.chat(self.context.messages, tools=schemas)
        if resp.tool_calls:
            self.context.add_message({"role": "assistant", "content": resp.content or None,
                                      "tool_calls": [tc.to_dict() for tc in resp.tool_calls]})
            for result in await self.tools.execute(resp.tool_calls, context=self):
                self.context.add_message(result.to_message())
            async for chunk in await self.llm.chat(self.context.messages, stream=True):
                if chunk.content:
                    yield chunk.content
        else:
            yield resp.content or ""


async def on_start(session: CrewSession):
    session.add_node(SketchArtist())
    await session.start()
    await session.wait_until_complete()


if __name__ == "__main__":
    AtomsCrewApp(setup_handler=on_start).run()
