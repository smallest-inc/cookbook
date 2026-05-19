import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    SwarmSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    RoomOutputOptions,
    WorkerOptions,
    cli,
    metrics,
    tts,
    tokenize,
)
from livekit.plugins import openai, silero, smallestai

logger = logging.getLogger("livekit-voice-agent")
load_dotenv()

VOICE_ID = os.getenv("VOICE_ID", "sophia")
LANGUAGE = os.getenv("LANGUAGE", "en")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")


class VoiceAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are a friendly and helpful voice assistant built with Smallest AI. "
                "Keep your responses concise — you are speaking aloud, so avoid bullet points, "
                "markdown, or special characters."
            ),
        )

    async def on_enter(self):
        self.session.generate_reply()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    session = SwarmSession(
        vad=ctx.proc.userdata["vad"],
        stt=smallestai.STT(language=LANGUAGE),
        llm=openai.LLM(model=LLM_MODEL),
        tts=tts.StreamAdapter(
            tts=smallestai.TTS(
                model="lightning-v3.1",
                voice_id=VOICE_ID,
                language=LANGUAGE,
            ),
            sentence_tokenizer=tokenize.basic.SentenceTokenizer(),
        ),
    )

    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    await session.start(
        agent=VoiceAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(),
        room_output_options=RoomOutputOptions(transcription_enabled=True),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
