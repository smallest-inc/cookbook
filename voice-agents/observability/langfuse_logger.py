"""Langfuse observability logger — BackgroundCrewNode.

Streams all voice-agent events (transcripts, tool calls, LLM generations,
call lifecycle) to Langfuse in real-time.  Runs silently alongside the
main conversational agent — zero impact on latency.

Requires:
    LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY (env vars or .env file)
    Optionally: LANGFUSE_HOST (defaults to https://cloud.langfuse.com)

Uses Langfuse SDK 3.x API:
    - Root span per call (trace is implicit)
    - Nested spans for tool calls
    - Observations (as_type="generation") for LLM rounds
    - Events for transcripts and lifecycle markers
"""

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from langfuse import Langfuse
from loguru import logger

from smallestai.atoms.crew.events import (
    SDKAgentTranscriptUpdateEvent,
    SDKEvent,
    SDKSystemUserJoinedEvent,
)
from smallestai.atoms.crew.nodes import BackgroundCrewNode

load_dotenv()


class LangfuseLogger(BackgroundCrewNode):
    """Streams every meaningful event to Langfuse as spans, generations, and events.

    Architecture (Langfuse 3.x):
    - One root *span* per call → creates an implicit trace
    - Tool calls → nested *spans* (with input/output)
    - LLM rounds → nested *observations* (as_type="generation")
    - Transcripts → *events* (lightweight markers on the timeline)

    The main agent calls ``log_tool_call`` / ``log_generation`` explicitly
    so the background node captures tool-level detail without needing to
    parse the LLM response stream itself.
    """

    def __init__(self):
        super().__init__(name="langfuse-logger")

        self._langfuse = Langfuse(
            public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
            secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
            host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        )

        self._root_span = None  # created when user joins
        self._call_start: Optional[str] = None
        self._transcript: List[Dict[str, str]] = []
        self._tool_count: int = 0
        self._generation_count: int = 0

    # ------------------------------------------------------------------
    # Event handling (automatic — receives the same stream as the agent)
    # ------------------------------------------------------------------

    async def process_event(self, event: SDKEvent):
        """Route incoming events to the appropriate Langfuse logger."""

        if isinstance(event, SDKSystemUserJoinedEvent):
            self._call_start = datetime.utcnow().isoformat()

            # Root span — Langfuse auto-creates the trace
            self._root_span = self._langfuse.start_span(
                name="voice-call",
                metadata={
                    "started_at": self._call_start,
                    "agent": "support-agent",
                },
            )
            # Tag the trace with a readable name
            self._root_span.update_trace(
                name="voice-call",
                metadata={"agent": "support-agent"},
            )
            self._root_span.create_event(name="call-started")
            logger.info(
                f"[LangfuseLogger] Trace created (trace_id={self._root_span.trace_id})"
            )

        elif isinstance(event, SDKAgentTranscriptUpdateEvent):
            entry = {"role": event.role, "content": event.content}
            self._transcript.append(entry)

            if self._root_span:
                self._root_span.create_event(
                    name=f"transcript:{event.role}",
                    metadata=entry,
                )

    # ------------------------------------------------------------------
    # Called by the main agent after each tool execution
    # ------------------------------------------------------------------

    def log_tool_call(
        self,
        tool_name: str,
        args: Dict[str, Any],
        result: Any,
    ):
        """Record a tool invocation as a Langfuse span.

        Args:
            tool_name: Name of the tool (e.g. ``"lookup_order"``).
            args: Arguments the LLM provided.
            result: The value returned by the tool.
        """
        self._tool_count += 1

        if self._root_span:
            span = self._root_span.start_span(
                f"tool:{tool_name}",
                input=args,
            )
            span.update(
                output=result if isinstance(result, (dict, list)) else str(result),
            )
            span.end()
            logger.debug(f"[LangfuseLogger] Tool span: {tool_name}")

    # ------------------------------------------------------------------
    # Called by the main agent after each LLM round
    # ------------------------------------------------------------------

    def log_generation(
        self,
        model: str,
        messages: List[Dict],
        output: str,
        tool_calls: Optional[List[Dict]] = None,
    ):
        """Record an LLM generation in Langfuse.

        Args:
            model: Model name (e.g. ``"gpt-4o-mini"``).
            messages: The messages list sent to the LLM.
            output: The LLM's text output (may be empty if only tool calls).
            tool_calls: Optional list of tool-call dicts the LLM produced.
        """
        self._generation_count += 1

        if self._root_span:
            gen_output: Any = output
            if tool_calls:
                gen_output = {"text": output, "tool_calls": tool_calls}

            gen = self._root_span.start_observation(
                name=f"llm-round-{self._generation_count}",
                as_type="generation",
                model=model,
                input=messages[-5:],  # last 5 messages for readability
            )
            gen.update(output=gen_output)
            gen.end()

            logger.debug(
                f"[LangfuseLogger] Generation #{self._generation_count} logged"
            )

    # ------------------------------------------------------------------
    # Called by the main agent for custom events (transfers, actions, etc.)
    # ------------------------------------------------------------------

    def log_event(self, name: str, metadata: Optional[Dict] = None):
        """Log a lightweight event on the Langfuse timeline.

        Use for call-control actions, verification outcomes, etc.
        """
        if self._root_span:
            self._root_span.create_event(name=name, metadata=metadata or {})
            logger.debug(f"[LangfuseLogger] Event: {name}")

    # ------------------------------------------------------------------
    # Summary + flush (called at session end)
    # ------------------------------------------------------------------

    def get_summary(self) -> Dict:
        """Return a session summary dict."""
        trace_url = None
        if self._root_span:
            try:
                trace_url = self._langfuse.get_trace_url(
                    trace_id=self._root_span.trace_id
                )
            except Exception:
                trace_url = f"(trace_id: {self._root_span.trace_id})"

        return {
            "trace_url": trace_url,
            "call_start": self._call_start,
            "transcript_turns": len(self._transcript),
            "tool_invocations": self._tool_count,
            "llm_generations": self._generation_count,
        }

    def flush(self):
        """Flush all pending Langfuse events.

        Always call this at session end to ensure nothing is lost.
        """
        if self._root_span:
            summary = self.get_summary()
            self._root_span.create_event(name="call-ended", metadata=summary)
            self._root_span.end()

        self._langfuse.flush()
        logger.info("[LangfuseLogger] Flushed to Langfuse")
