// Thin wrapper around the Atoms REST surface the app needs for updating a
// live agent's voice/speed/language. Full dance:
//   1. GET /agent/{id}                       (read current config)
//   2. GET /agent/{id}/versions?limit=1      (find version to branch from)
//   3. POST /agent/{id}/drafts                (open a draft)
//   4. PATCH /agent/{id}/drafts/{d}/config    (write new values)
//   5. POST /agent/{id}/drafts/{d}/publish    (publish as new version)
//   6. PATCH /agent/{id}/versions/{v}/activate (make it live)
// Anything that doesn't change is carried forward from the current config.

const API_BASE = 'https://api.smallest.ai/atoms/v1';

export interface AgentSnapshot {
  name: string;
  voiceId: string;
  voiceModel: string;
  speed: number;
  language: string;
  supportedLanguages: string[];
}

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function call<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(apiKey),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 240)}`);
  }
  if (res.status === 204) return {} as T;
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

function unwrap<T>(resp: any): T {
  return (resp && typeof resp === 'object' && 'data' in resp ? resp.data : resp) as T;
}

export async function fetchAgent(apiKey: string, agentId: string): Promise<AgentSnapshot> {
  const d = unwrap<any>(await call(apiKey, 'GET', `/agent/${agentId}`));
  return {
    name: d.name ?? '',
    voiceId: d?.synthesizer?.voiceConfig?.voiceId ?? '',
    voiceModel: d?.synthesizer?.voiceConfig?.model ?? 'waves_lightning_v3_1',
    speed: d?.synthesizer?.speed ?? 1.0,
    language: d?.language?.default ?? 'en',
    supportedLanguages: d?.language?.supported ?? ['en'],
  };
}

export interface UpdateInput {
  voiceId?: string;
  voiceModel?: string;
  speed?: number;
  language?: string;
}

// Runs the 5-step draft-publish-activate flow. Returns the new version id.
export async function updateAgentConfig(
  apiKey: string,
  agentId: string,
  current: AgentSnapshot,
  patch: UpdateInput,
): Promise<string> {
  const versionsResp = unwrap<any>(
    await call(apiKey, 'GET', `/agent/${agentId}/versions?limit=1`),
  );
  const sourceVersion = (versionsResp?.versions ?? [])[0]?._id;
  if (!sourceVersion) throw new Error('No source version found on agent');

  const draftResp = unwrap<any>(
    await call(apiKey, 'POST', `/agent/${agentId}/drafts`, {
      draftName: `live-config-${Date.now()}`,
      sourceVersionId: sourceVersion,
    }),
  );
  const draftId: string = draftResp.draftId;
  if (!draftId) throw new Error('Draft creation did not return draftId');

  const nextVoiceId = patch.voiceId ?? current.voiceId;
  const nextVoiceModel = patch.voiceModel ?? current.voiceModel;
  const nextSpeed = patch.speed ?? current.speed;
  const nextLanguage = patch.language ?? current.language;

  const configBody: Record<string, unknown> = {
    language: {
      default: nextLanguage,
      supported: current.supportedLanguages.includes(nextLanguage)
        ? current.supportedLanguages
        : Array.from(new Set([...current.supportedLanguages, nextLanguage])),
      switching: { isEnabled: false },
    },
    synthesizer: {
      voiceConfig: { model: nextVoiceModel, voiceId: nextVoiceId },
      speed: nextSpeed,
    },
  };

  await call(apiKey, 'PATCH', `/agent/${agentId}/drafts/${draftId}/config`, configBody);

  const publishResp = unwrap<any>(
    await call(apiKey, 'POST', `/agent/${agentId}/drafts/${draftId}/publish`, {
      label: `hearthside-${Date.now()}`,
    }),
  );
  const newVersion: string = publishResp._id;
  if (!newVersion) throw new Error('Publish did not return version id');

  await call(apiKey, 'PATCH', `/agent/${agentId}/versions/${newVersion}/activate`);

  return newVersion;
}
