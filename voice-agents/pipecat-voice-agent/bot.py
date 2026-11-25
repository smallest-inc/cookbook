import argparse
import asyncio
import os
import uuid
from contextlib import asynccontextmanager
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse
from loguru import logger
from pipecat_ai_small_webrtc_prebuilt.frontend import SmallWebRTCPrebuiltUI

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.smallest.stt import SmallestSTTService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.smallest.tts import SmallestTTSService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import IceServer, SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

load_dotenv(override=True)

parser = argparse.ArgumentParser(description="Pipecat Voice Agent")
parser.add_argument("--host", default="localhost")
parser.add_argument("--port", type=int, default=7860)
parser.add_argument("--voice", default="kaitlyn", help="TTS voice ID (default: kaitlyn)")
parser.add_argument("--language", default="en", help="Language code for STT and TTS (default: en)")
args = parser.parse_args()

ICE_SERVERS = [IceServer(urls="stun:stun.l.google.com:19302")]

webrtc_handler = SmallWebRTCRequestHandler(ice_servers=ICE_SERVERS)
active_sessions: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await webrtc_handler.close()


app = FastAPI(lifespan=lifespan)
app.mount("/client", SmallWebRTCPrebuiltUI)


async def run_bot(webrtc_connection: SmallWebRTCConnection, voice: str = "kaitlyn", language: str = "en"):
    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
    )

    stt = SmallestSTTService(
        api_key=os.getenv("SMALLEST_API_KEY"),
        settings=SmallestSTTService.Settings(language=language),
    )

    tts = SmallestTTSService(
        api_key=os.getenv("SMALLEST_API_KEY"),
        sample_rate=24000,
        settings=SmallestTTSService.Settings(
            voice=voice,
            language=language,
        ),
    )

    llm = OpenAILLMService(
        api_key=os.getenv("OPENAI_API_KEY"),
        settings=OpenAILLMService.Settings(
            system_instruction=(
                "You are a friendly and helpful voice assistant. "
                "Keep your responses concise — you are speaking aloud, so avoid "
                "bullet points, markdown, or special characters."
            ),
        ),
    )

    context = LLMContext()
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    pipeline = Pipeline(
        [
            transport.input(),       # Browser microphone input
            stt,                     # Speech → text (Smallest AI)
            user_aggregator,         # Accumulate user turn
            llm,                     # Text → response (OpenAI)
            tts,                     # Text → speech (Smallest AI)
            transport.output(),      # Browser speaker output
            assistant_aggregator,    # Accumulate assistant turn
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=True),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        context.add_message({"role": "user", "content": "Greet the user warmly and let them know they can start talking."})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await task.cancel()

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)


@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/client/")


@app.post("/start")
async def start(request: Request):
    """Return a session ID and ICE config to the prebuilt UI."""
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = {}
    return {
        "sessionId": session_id,
        "iceConfig": {"iceServers": [{"urls": "stun:stun.l.google.com:19302"}]},
    }


@app.api_route(
    "/sessions/{session_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def session_proxy(session_id: str, path: str, request: Request):
    if session_id not in active_sessions:
        return Response(content="Invalid session", status_code=404)

    if path.endswith("api/offer"):
        data = await request.json()
        if request.method == "POST":
            webrtc_request = SmallWebRTCRequest(
                sdp=data["sdp"],
                type=data["type"],
                pc_id=data.get("pc_id"),
                restart_pc=data.get("restart_pc"),
            )

            async def run_bot_task(connection):
                asyncio.create_task(run_bot(connection, voice=args.voice, language=args.language))

            return await webrtc_handler.handle_web_request(webrtc_request, run_bot_task)
        elif request.method == "PATCH":
            patch_request = SmallWebRTCPatchRequest(
                pc_id=data["pc_id"],
                candidates=[IceCandidate(**c) for c in data.get("candidates", [])],
            )
            await webrtc_handler.handle_patch_request(patch_request)
            return Response(status_code=200)

    return Response(status_code=200)


if __name__ == "__main__":
    logger.info(f"Open http://{args.host}:{args.port} in your browser")
    uvicorn.run(app, host=args.host, port=args.port)
