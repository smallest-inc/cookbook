export type AudioFormat = "pcm16";
export type Role = "user" | "assistant" | "system";
export type ItemType = "message" | "function_call" | "function_call_output";
export type ItemContentType =
  | "input_audio"
  | "input_text"
  | "output_audio"
  | "output_text";
export type ItemStatus = "in_progress" | "completed" | "incomplete";
export type ResponseStatus =
  | "in_progress"
  | "completed"
  | "cancelled"
  | "incomplete"
  | "failed";

export interface ItemContent {
  type: ItemContentType;
  text?: string;
}

export interface ConversationItem {
  id: string;
  type: ItemType;
  role?: Role;
  status?: ItemStatus;
  content?: ItemContent[];
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

export interface ToolDef {
  type?: "function";
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface SessionConfig {
  instructions?: string;
  voice?: string;
  tools?: ToolDef[];
  input_audio_format?: AudioFormat;
  input_audio_sample_rate?: number;
  output_audio_format?: AudioFormat;
  output_audio_sample_rate?: number;
  generate_initial_response?: boolean;
}

// ── Client → Server ─────────────────────────────────────────────────────
export type ClientEvent =
  | { type: "session.configure"; event_id?: string; session: SessionConfig }
  | {
      type: "session.update";
      event_id?: string;
      session: { tools?: ToolDef[] };
    }
  | { type: "input_audio_buffer.append"; event_id?: string; audio: string }
  | {
      type: "conversation.item.create";
      event_id?: string;
      item: Record<string, unknown>;
    }
  | {
      type: "response.create";
      event_id?: string;
      response?: Record<string, unknown>;
    }
  | { type: "response.cancel"; event_id?: string; response_id?: string };

// ── Server → Client ─────────────────────────────────────────────────────
export interface ErrorPayload {
  type: string;
  code: string;
  message: string;
  param?: string;
  event_id?: string;
}

export type ServerEvent =
  | { type: "session.created"; event_id: string; session_id: string }
  | { type: "session.configured"; event_id: string; session: SessionConfig }
  | {
      type: "session.updated";
      event_id: string;
      session: Record<string, unknown>;
    }
  | {
      type: "input_audio_buffer.speech_started";
      event_id: string;
      audio_start_ms: number;
      item_id: string;
    }
  | {
      type: "input_audio_buffer.speech_stopped";
      event_id: string;
      audio_end_ms: number;
      item_id: string;
    }
  | {
      type: "conversation.item.added";
      event_id: string;
      previous_item_id?: string | null;
      item: ConversationItem;
    }
  | {
      type: "conversation.item.done";
      event_id: string;
      previous_item_id?: string | null;
      item: ConversationItem;
    }
  | {
      type: "response.created";
      event_id: string;
      response: { id: string; status: ResponseStatus };
    }
  | {
      type: "response.done";
      event_id: string;
      response: {
        id: string;
        status: ResponseStatus;
        status_details?: {
          reason?: string;
          type?: string;
          error?: Record<string, unknown>;
        };
        output?: ConversationItem[];
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
        };
      };
    }
  | {
      type: "response.output_audio.delta";
      event_id: string;
      response_id: string;
      item_id: string;
      output_index?: number;
      content_index?: number;
      delta: string; // base64 PCM16
    }
  | {
      type: "response.output_audio.done";
      event_id: string;
      response_id: string;
      item_id: string;
      output_index?: number;
      content_index?: number;
    }
  | {
      type: "response.function_call_arguments.delta";
      event_id: string;
      response_id: string;
      item_id?: string;
      output_index?: number;
      call_id: string;
      name?: string;
      delta: string;
    }
  | {
      type: "response.function_call_arguments.done";
      event_id: string;
      response_id: string;
      item_id?: string;
      output_index?: number;
      call_id: string;
      name?: string;
      arguments: string;
    }
  | { type: "error"; event_id: string; error: ErrorPayload }
  // forward-compat for any wire variant the server adds later
  | { type: string; [k: string]: unknown };

// ── UI-state types ──────────────────────────────────────────────────────
export type OrbState =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export type EventDir = "in" | "out";

export interface LoggedEvent {
  id: string;
  dir: EventDir;
  ts: number; // ms since session connect
  type: string;
  raw: unknown;
}

export interface TranscriptBubble {
  id: string; // item_id
  role: Role;
  text: string;
  status: ItemStatus;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  call_id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
}
