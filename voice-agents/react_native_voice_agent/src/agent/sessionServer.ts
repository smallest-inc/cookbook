// Client for the session server in ../../mobile_token_server (run it next to
// the app). The server holds SMALLEST_API_KEY and AGENT_ID; the app only gets
// short-lived tokens and the agent's public settings. Nothing secret is in
// the JS bundle: EXPO_PUBLIC_TOKEN_SERVER_URL is just a URL.

export interface SessionToken {
  token: string;
  expiresIn: number;
  sampleRate: number;
}

export interface AgentSnapshot {
  name: string;
  voiceId: string;
  voiceModel: string;
  speed: number;
  language: string;
  supportedLanguages: string[];
  // false unless the server runs with ALLOW_AGENT_EDITS=true
  editable: boolean;
}

export interface UpdateInput {
  voiceId?: string;
  voiceModel?: string;
  speed?: number;
  language?: string;
}

async function call<T>(serverUrl: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${serverUrl.replace(/\/+$/, '')}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON error page from a proxy; fall through to the status check
  }
  if (!res.ok) {
    throw new Error(`session server ${method} ${path} -> ${res.status}: ${json?.error ?? 'request failed'}`);
  }
  return json as T;
}

export function fetchSessionToken(serverUrl: string): Promise<SessionToken> {
  return call<SessionToken>(serverUrl, 'POST', '/session');
}

export function fetchAgent(serverUrl: string): Promise<AgentSnapshot> {
  return call<AgentSnapshot>(serverUrl, 'GET', '/agent');
}

// The server runs the branch draft-publish flow. Returns the published revision id.
export async function updateAgentConfig(serverUrl: string, patch: UpdateInput): Promise<string> {
  const { revision } = await call<{ revision: string }>(serverUrl, 'POST', '/agent/config', patch);
  return revision;
}
