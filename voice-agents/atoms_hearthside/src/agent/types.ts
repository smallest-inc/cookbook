export type ServerEvent =
  | { type: 'session.created'; session_id: string; call_id: string }
  | { type: 'output_audio.delta'; audio: string }
  | { type: 'agent_start_talking' }
  | { type: 'agent_stop_talking' }
  | { type: 'interruption' }
  | { type: 'session.closed'; reason?: string }
  | { type: 'error'; code: string; message: string }
  | { type: string; [k: string]: unknown };

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'joined'       // session.created received, narrator is in the room
  | 'listening'    // mic streaming, agent finished a turn, waiting on user
  | 'narrating'    // agent_start_talking received, output_audio.delta flowing
  | 'error';

export interface SessionError {
  kind:
    | 'permission'
    | 'missing-config'
    | 'network'
    | 'auth'
    | 'server'
    | 'unknown';
  message: string;
  retryable: boolean;
}
