// Thin wrapper around the Atoms REST surface the app needs for updating a
// live agent's voice/speed/language. Full dance (v2 branches flow):
//   1. GET /agent/{id}                              (read current config)
//   2. GET /agent/{id}/branches                     (find the live branch)
//   3. PUT /agent/{id}/branches/{b}/draft           (write new values into the open draft)
//   4. POST /agent/{id}/branches/{b}/draft/publish  (publish; the revision goes live)
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

// Runs the branch edit-and-publish flow. Returns the published revision id.
export async function updateAgentConfig(
  apiKey: string,
  agentId: string,
  current: AgentSnapshot,
  patch: UpdateInput,
): Promise<string> {
  const branchesResp = unwrap<any>(
    await call(apiKey, 'GET', `/agent/${agentId}/branches`),
  );
  const branches: any[] = branchesResp?.branches ?? [];
  const entry =
    branches.find((b) => b?.isLive ?? b?.is_live) ??
    branches.find((b) => b?.branch?.isDefault ?? b?.branch?.is_default) ??
    branches[0];
  const branchId: string = entry?.branch?._id ?? entry?.branch?.id;
  if (!branchId) throw new Error('No branch found on agent');

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

  // PUT creates the branch's open draft when there is none, otherwise
  // updates it in place.
  await call(apiKey, 'PUT', `/agent/${agentId}/branches/${branchId}/draft`, configBody);

  // Publishing the draft makes the new revision live; no activate step in v2.
  const publishResp = unwrap<any>(
    await call(apiKey, 'POST', `/agent/${agentId}/branches/${branchId}/draft/publish`, {
      label: `hearthside-${Date.now()}`,
    }),
  );
  let newRevision: string | undefined = publishResp?._id ?? publishResp?.id;
  if (!newRevision && publishResp?.state) {
    // Publishing runs an async security scan; poll until the draft closes.
    for (let i = 0; i < 60 && !newRevision; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const b = unwrap<any>(await call(apiKey, 'GET', `/agent/${agentId}/branches/${branchId}`));
      const branch = b?.branch ?? b;
      if (!branch?.openDraftId) newRevision = branch?.headRevisionId ?? 'published';
    }
  }
  if (!newRevision) throw new Error('Publish did not return revision id');

  return newRevision;
}
