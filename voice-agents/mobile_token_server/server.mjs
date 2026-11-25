// Minimal session server for the React Native voice examples.
//
// The mobile app must never contain your Smallest API key: anything in the JS
// bundle (including EXPO_PUBLIC_* variables) can be pulled out of the app.
// This server keeps the key and hands the app only what it needs:
//
//   POST /session        mints a short-lived, single-use Agent WebSocket token
//                        for the one agent configured here (AGENT_ID). The app
//                        connects with ?token=<wct_...> and the token expires
//                        after 30 seconds.
//   GET  /agent          returns the agent's voice, speed and language for the
//                        settings sheet (no secrets, no prompt).
//   POST /agent/config   changes voice, speed or language and publishes it.
//                        Disabled unless ALLOW_AGENT_EDITS=true, because anyone
//                        who can reach this server could otherwise edit the
//                        agent.
//
// No dependencies. Node 18 or later (Node 20.6+ for --env-file).
//
//   SMALLEST_API_KEY=sk_... AGENT_ID=... node server.mjs
//   node --env-file=../react_native_voice_agent/.env server.mjs

import http from "node:http";

const API_BASE = "https://api.smallest.ai/atoms/v1";
const API_KEY = process.env.SMALLEST_API_KEY ?? "";
const AGENT_ID = process.env.AGENT_ID ?? "";
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8787);
const ALLOW_AGENT_EDITS = process.env.ALLOW_AGENT_EDITS === "true";
const SESSIONS_PER_MINUTE = Number(process.env.SESSIONS_PER_MINUTE ?? 10);
const MAX_BODY_BYTES = 4 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;

const ALLOWED_LANGUAGES = new Set(["en", "hi", "multi"]);
const VOICE_ID_RE = /^[a-z0-9_-]{1,64}$/;
const VOICE_MODEL_RE = /^[a-z0-9_.-]{1,64}$/;

if (!API_KEY || !AGENT_ID) {
  console.error("Set SMALLEST_API_KEY and AGENT_ID in the environment before starting.");
  process.exit(1);
}
if (!/^[A-Za-z0-9]{8,64}$/.test(AGENT_ID)) {
  console.error("AGENT_ID does not look like an agent id.");
  process.exit(1);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---- Atoms REST ------------------------------------------------------------

async function atoms(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    // Log the upstream status server-side only. The app gets a generic error.
    console.error(`atoms ${method} ${path} -> ${res.status}`);
    throw new HttpError(502, "upstream request failed");
  }
  const json = text ? JSON.parse(text) : {};
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

async function mintSessionToken() {
  const data = await atoms("POST", "/conversation/register-call", { agent_id: AGENT_ID });
  if (!data?.access_token) throw new HttpError(502, "upstream returned no token");
  return {
    token: data.access_token,
    expiresIn: data.expires_in ?? 30,
  };
}

async function readAgent() {
  const d = await atoms("GET", `/agent/${AGENT_ID}`);
  return {
    name: d?.name ?? "",
    voiceId: d?.synthesizer?.voiceConfig?.voiceId ?? "",
    voiceModel: d?.synthesizer?.voiceConfig?.model ?? "waves_lightning_v3_1_pro",
    speed: d?.synthesizer?.speed ?? 1.0,
    language: d?.language?.default ?? "en",
    supportedLanguages: d?.language?.supported ?? ["en"],
    editable: ALLOW_AGENT_EDITS,
  };
}

// v2 branches flow: find the live branch, PUT the draft, publish it.
async function updateAgent(patch) {
  const current = await readAgent();
  const branches = (await atoms("GET", `/agent/${AGENT_ID}/branches`))?.branches ?? [];
  const entry =
    branches.find((b) => b?.isLive ?? b?.is_live) ??
    branches.find((b) => b?.branch?.isDefault ?? b?.branch?.is_default) ??
    branches[0];
  const branchId = entry?.branch?._id ?? entry?.branch?.id;
  if (!branchId) throw new HttpError(502, "agent has no branch");

  const language = patch.language ?? current.language;
  const supported = current.supportedLanguages.includes(language)
    ? current.supportedLanguages
    : [...new Set([...current.supportedLanguages, language])];

  await atoms("PUT", `/agent/${AGENT_ID}/branches/${branchId}/draft`, {
    language: { default: language, supported, switching: { isEnabled: false } },
    synthesizer: {
      voiceConfig: {
        model: patch.voiceModel ?? current.voiceModel,
        voiceId: patch.voiceId ?? current.voiceId,
      },
      speed: patch.speed ?? current.speed,
    },
  });

  const published = await atoms("POST", `/agent/${AGENT_ID}/branches/${branchId}/draft/publish`, {
    label: `mobile-settings-${Date.now()}`,
  });
  let revision = published?._id ?? published?.id;
  if (!revision && published?.state) {
    // Publishing runs an async check; poll until the draft closes.
    for (let i = 0; i < 30 && !revision; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const b = await atoms("GET", `/agent/${AGENT_ID}/branches/${branchId}`);
      const branch = b?.branch ?? b;
      if (!branch?.openDraftId) revision = branch?.headRevisionId ?? "published";
    }
  }
  if (!revision) throw new HttpError(502, "publish did not finish");
  return { revision };
}

function validatePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "body must be a JSON object");
  }
  const allowed = new Set(["voiceId", "voiceModel", "speed", "language"]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new HttpError(400, `unknown field: ${key}`);
  }
  const patch = {};
  if (body.voiceId !== undefined) {
    if (typeof body.voiceId !== "string" || !VOICE_ID_RE.test(body.voiceId)) throw new HttpError(400, "invalid voiceId");
    patch.voiceId = body.voiceId;
  }
  if (body.voiceModel !== undefined) {
    if (typeof body.voiceModel !== "string" || !VOICE_MODEL_RE.test(body.voiceModel)) throw new HttpError(400, "invalid voiceModel");
    patch.voiceModel = body.voiceModel;
  }
  if (body.speed !== undefined) {
    if (typeof body.speed !== "number" || !(body.speed >= 0.5 && body.speed <= 2)) throw new HttpError(400, "speed must be between 0.5 and 2");
    patch.speed = body.speed;
  }
  if (body.language !== undefined) {
    if (!ALLOWED_LANGUAGES.has(body.language)) throw new HttpError(400, "invalid language");
    patch.language = body.language;
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, "nothing to update");
  return patch;
}

// ---- HTTP plumbing ---------------------------------------------------------

// Fixed-window rate limit per client address for token minting.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > 60_000) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > SESSIONS_PER_MINUTE;
}
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [ip, entry] of hits) if (entry.start < cutoff) hits.delete(ip);
}, 60_000).unref();

function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(payload));
}

// Requiring application/json also forces a CORS preflight in browsers, which
// this server never answers. A second layer next to the Origin check below.
function requireJson(req) {
  const type = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "Content-Type must be application/json");
}

async function readJson(req) {
  requireJson(req);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "body too large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = `${req.method} ${url.pathname}`;
  try {
    // Native apps do not send an Origin header; browsers always do on POST.
    // Rejecting any request with an Origin keeps web pages (including DNS
    // rebinding tricks that make a page look same-origin) from using this
    // server to mint tokens or edit the agent.
    if (req.headers.origin !== undefined) throw new HttpError(403, "browser requests are not accepted");

    if (route === "GET /healthz") return send(res, 200, { ok: true });

    if (route === "POST /session") {
      await readJson(req);
      if (rateLimited(req.socket.remoteAddress ?? "?")) throw new HttpError(429, "too many sessions, slow down");
      return send(res, 200, await mintSessionToken());
    }

    if (route === "GET /agent") {
      return send(res, 200, await readAgent());
    }

    if (route === "POST /agent/config") {
      if (!ALLOW_AGENT_EDITS) throw new HttpError(403, "agent edits are disabled on this server (set ALLOW_AGENT_EDITS=true)");
      const patch = validatePatch(await readJson(req));
      return send(res, 200, await updateAgent(patch));
    }

    throw new HttpError(404, "not found");
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(`${route} failed: ${err?.name ?? "Error"}`);
    send(res, status, { error: err instanceof HttpError ? err.message : "internal error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`session server on http://${HOST}:${PORT} for agent ${AGENT_ID}`);
  console.log(`agent edits: ${ALLOW_AGENT_EDITS ? "enabled" : "disabled"}`);
  if (HOST === "0.0.0.0" || HOST === "::") {
    console.log("listening on all interfaces: anyone on this network can mint sessions for this agent");
  }
});
