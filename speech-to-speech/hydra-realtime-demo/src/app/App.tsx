"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AgentRail from "./components/AgentRail";
import ControlPanel from "./components/ControlPanel";
import EventsLog from "./components/EventsLog";
import Orb from "./components/Orb";
import Topbar from "./components/Topbar";
import { AGENT_PRESETS, DEFAULT_AGENT_ID, findPreset } from "./agents/presets";
import { useHydraSession } from "./hooks/useHydraSession";
import { DEFAULT_HYDRA_WS_URL } from "./lib/hydra-client";

const LS = {
  apiKey: "hydra_demo_api_key",
  wsUrl: "hydra_demo_ws_url",
  agentId: "hydra_demo_agent_id",
};

export default function App() {
  const session = useHydraSession();
  const [agentId, setAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [voice, setVoice] = useState<string>(
    findPreset(DEFAULT_AGENT_ID).voice,
  );
  const [instructions, setInstructions] = useState<string>(
    findPreset(DEFAULT_AGENT_ID).instructions,
  );
  const [generateInitial, setGenerateInitial] = useState<boolean>(
    findPreset(DEFAULT_AGENT_ID).speaksFirst,
  );
  const [apiKey, setApiKey] = useState<string>("");
  const [wsUrl, setWsUrl] = useState<string>(DEFAULT_HYDRA_WS_URL);
  const [showLog, setShowLog] = useState<boolean>(true);

  // hydrate from localStorage once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = window.localStorage.getItem(LS.apiKey);
    if (k) setApiKey(k);
    const u = window.localStorage.getItem(LS.wsUrl);
    if (u) setWsUrl(u);
    const a = window.localStorage.getItem(LS.agentId);
    if (a) {
      const p = findPreset(a);
      setAgentId(p.id);
      setVoice(p.voice);
      setInstructions(p.instructions);
      setGenerateInitial(p.speaksFirst);
    }
  }, []);

  // persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS.apiKey, apiKey);
  }, [apiKey]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS.wsUrl, wsUrl);
  }, [wsUrl]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS.agentId, agentId);
  }, [agentId]);

  const preset = useMemo(() => findPreset(agentId), [agentId]);

  const onPickAgent = useCallback(
    (id: string) => {
      const p = findPreset(id);
      setAgentId(p.id);
      setVoice(p.voice);
      setInstructions(p.instructions);
      setGenerateInitial(p.speaksFirst);
      if (session.state.status === "open") {
        // reconnect so new tools/persona take effect
        session.disconnect();
        setTimeout(
          () => doConnect(p.id, p.voice, p.instructions, p.speaksFirst),
          250,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.state.status],
  );

  const resetPreset = useCallback(() => {
    const p = findPreset(agentId);
    setVoice(p.voice);
    setInstructions(p.instructions);
    setGenerateInitial(p.speaksFirst);
  }, [agentId]);

  const doConnect = useCallback(
    (id?: string, v?: string, ins?: string, first?: boolean) => {
      const p = findPreset(id || agentId);
      if (!apiKey.trim()) {
        alert(
          "Add your Smallest API key in the right-hand panel before connecting.",
        );
        return;
      }
      session.connect({
        url: wsUrl.trim() || DEFAULT_HYDRA_WS_URL,
        apiKey: apiKey.trim(),
        voice: v ?? voice,
        instructions: (ins ?? instructions).trim(),
        tools: p.tools,
        generateInitialResponse: first ?? generateInitial,
      });
    },
    [agentId, apiKey, generateInitial, instructions, session, voice, wsUrl],
  );

  const onConnect = useCallback(() => doConnect(), [doConnect]);
  const onDisconnect = useCallback(() => session.disconnect(), [session]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Topbar
        status={session.state.status}
        sessionId={session.state.sessionId}
        micMuted={session.state.micMuted}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onToggleMute={session.toggleMute}
      />

      <div className="flex-1 min-h-0 grid grid-cols-[240px_minmax(0,1fr)_360px] gap-3 p-3">
        {/* left rail */}
        <aside className="glass overflow-hidden">
          <AgentRail active={agentId} onPick={onPickAgent} />
        </aside>

        {/* center */}
        <main className="flex flex-col min-h-0 gap-3">
          <div className="glass-strong flex-1 min-h-0 flex flex-col items-center justify-center relative overflow-hidden">
            <Orb
              state={session.state.orb}
              level={session.state.level}
              onClick={
                session.state.status === "open" ? onDisconnect : onConnect
              }
              label={
                session.state.lastError
                  ? session.state.lastError
                  : `${preset.name} · ${voice}`
              }
            />
            {session.state.lastError && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-ink-300 font-mono">
                {session.state.lastError}
              </div>
            )}
          </div>

          <div className="h-[42%] min-h-0">
            <div className="glass overflow-hidden flex flex-col h-full">
              <div className="flex border-b border-ink-700">
                <button
                  className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-widest border-b-2 transition ${
                    showLog
                      ? "text-ink-100 border-ink-100"
                      : "text-ink-400 border-transparent hover:text-ink-200"
                  }`}
                  onClick={() => setShowLog(true)}
                >
                  Events
                </button>
                <button
                  className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-widest border-b-2 transition ${
                    !showLog
                      ? "text-ink-100 border-ink-100"
                      : "text-ink-400 border-transparent hover:text-ink-200"
                  }`}
                  onClick={() => setShowLog(false)}
                >
                  Quick start
                </button>
              </div>
              {showLog ? (
                <EventsLog
                  events={session.state.events}
                  onClear={session.clearEvents}
                />
              ) : (
                <QuickStart wsUrl={wsUrl} />
              )}
            </div>
          </div>
        </main>

        {/* right control panel */}
        <aside className="glass overflow-hidden">
          <ControlPanel
            agentId={agentId}
            voice={voice}
            instructions={instructions}
            generateInitialResponse={generateInitial}
            apiKey={apiKey}
            wsUrl={wsUrl}
            onChangeVoice={setVoice}
            onChangeInstructions={setInstructions}
            onToggleInitialResponse={setGenerateInitial}
            onChangeApiKey={setApiKey}
            onChangeWsUrl={setWsUrl}
            onResetPreset={resetPreset}
          />
        </aside>
      </div>

      <div className="flex-shrink-0 px-5 py-2 border-t border-ink-700 bg-ink-950 flex items-center gap-4 text-[11px] font-mono text-ink-400">
        <span>
          {AGENT_PRESETS.length} presets · {preset.tools.length} tool
          {preset.tools.length === 1 ? "" : "s"} active
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span>output</span>
          <span className="text-ink-200">
            {session.state.outputSampleRate}Hz pcm16
          </span>
          <span className="text-ink-500">·</span>
          <span>input</span>
          <span className="text-ink-200">16kHz pcm16</span>
        </span>
      </div>
    </div>
  );
}

function QuickStart({ wsUrl }: { wsUrl: string }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll p-4 text-[12px] leading-relaxed text-ink-200 space-y-3">
      <p>
        <span className="text-ink-100 font-semibold">Hydra</span> is
        Smallest.ai&apos;s realtime speech-to-speech API. Every frame is JSON
        over WebSocket.
      </p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>
          Paste your <code className="text-ink-100">SMALLEST_API_KEY</code> in
          the right panel.
        </li>
        <li>Pick an agent on the left — or tweak the persona / voice.</li>
        <li>
          Click <span className="text-ink-100">Connect</span> and start talking.
        </li>
      </ol>
      <div>
        <div className="label">endpoint</div>
        <pre className="bg-ink-950 border border-ink-700 p-2 text-[11px] overflow-x-auto scroll">
          {wsUrl}
        </pre>
      </div>
      <div>
        <div className="label">handshake</div>
        <pre className="bg-ink-950 border border-ink-700 p-2 text-[11px] overflow-x-auto scroll whitespace-pre">{`server → { "type": "session.created", "session_id": "…" }
client → { "type": "session.configure", "session": { ... } }
server → { "type": "session.configured", "session": { ... } }
client → { "type": "input_audio_buffer.append", "audio": "<b64 pcm16>" }
server → { "type": "response.output_audio.delta", "delta": "<b64 pcm16>" }
…`}</pre>
      </div>
      <p className="text-ink-400">
        Full event reference: see the{" "}
        <a
          className="text-ink-100 underline underline-offset-2 hover:text-ink-200"
          href="https://docs.smallest.ai/waves/documentation/speech-to-speech-hydra/managing-sessions"
          target="_blank"
          rel="noreferrer"
        >
          Hydra docs
        </a>
        .
      </p>
    </div>
  );
}
