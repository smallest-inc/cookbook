"""Background agent for compliance audit logging.

Silently observes all session events and tool invocations, writing
structured entries to the SQLite audit_log table.  Produces no
audio output — purely a compliance/observability node.
"""

import json
from datetime import datetime
from typing import Dict, List, Optional

from loguru import logger

from smallestai.atoms.agent.events import (
    SDKAgentTranscriptUpdateEvent,
    SDKEvent,
    SDKSystemUserJoinedEvent,
)
from smallestai.atoms.agent.nodes import BackgroundAgentNode

from database import BankingDB


class AuditLogger(BackgroundAgentNode):
    """Logs every meaningful event to the audit_log table.

    Architecture:
    - Receives the same event stream as the main CSRAgent
    - Writes to the shared BankingDB.audit_log table
    - The CSRAgent also pushes tool-invocation records via
      ``log_tool_call()`` so the audit trail captures tool usage
    """

    def __init__(self, db: BankingDB):
        super().__init__(name="audit-logger")
        self.db = db
        self._call_start: Optional[str] = None
        self._transcript: List[Dict[str, str]] = []

    # -- event handling ------------------------------------------------------

    async def process_event(self, event: SDKEvent):
        """Inspect every event; log the ones we care about."""

        if isinstance(event, SDKSystemUserJoinedEvent):
            self._call_start = datetime.utcnow().isoformat()
            self.db.log_audit(
                "CALL_START",
                json.dumps({"timestamp": self._call_start}),
            )
            logger.info("[AuditLogger] Call started")

        elif isinstance(event, SDKAgentTranscriptUpdateEvent):
            entry = {"role": event.role, "content": event.content}
            self._transcript.append(entry)
            self.db.log_audit(
                "TRANSCRIPT",
                json.dumps(entry),
            )

    # -- called by the CSRAgent after each tool execution --------------------

    def log_tool_call(self, tool_name: str, args: dict, result: str):
        """Record a tool invocation in the audit log."""
        self.db.log_audit(
            "TOOL_CALL",
            json.dumps({
                "tool": tool_name,
                "arguments": args,
                "result_preview": result[:500] if result else "",
            }),
        )
        logger.debug(f"[AuditLogger] Tool logged: {tool_name}")

    def log_verification(self, success: bool, factors_used: List[str]):
        """Record an identity verification attempt."""
        self.db.log_audit(
            "IDENTITY_VERIFICATION",
            json.dumps({
                "success": success,
                "factors": factors_used,
            }),
        )

    def log_banking_action(self, action: str, details: dict):
        """Record a banking action (FD create/break, TDS send)."""
        self.db.log_audit(
            "BANKING_ACTION",
            json.dumps({"action": action, **details}),
        )

    # -- summary (called at session end) ------------------------------------

    def get_summary(self) -> Dict:
        """Return a compliance summary for the call."""
        log = self.db.get_audit_log()
        tool_calls = [e for e in log if e["event_type"] == "TOOL_CALL"]
        actions = [e for e in log if e["event_type"] == "BANKING_ACTION"]
        verifications = [e for e in log if e["event_type"] == "IDENTITY_VERIFICATION"]
        return {
            "call_start": self._call_start,
            "total_events": len(log),
            "transcript_turns": len(self._transcript),
            "tool_invocations": len(tool_calls),
            "banking_actions": len(actions),
            "verification_attempts": len(verifications),
        }
