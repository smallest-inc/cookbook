"use client";

import { AGENT_PRESETS, findPreset } from "@/app/agents/presets";

const VOICES = [
  { value: "wren", label: "Wren" },
  { value: "sloane", label: "Sloane" },
  { value: "marlowe", label: "Marlowe" },
  { value: "reed", label: "Reed" },
  { value: "knox", label: "Knox" },
  { value: "tate", label: "Tate" },
];

export interface ControlPanelProps {
  agentId: string;
  voice: string;
  instructions: string;
  generateInitialResponse: boolean;
  apiKey: string;
  wsUrl: string;
  onChangeVoice: (v: string) => void;
  onChangeInstructions: (v: string) => void;
  onToggleInitialResponse: (v: boolean) => void;
  onChangeApiKey: (v: string) => void;
  onChangeWsUrl: (v: string) => void;
  onResetPreset: () => void;
}

export default function ControlPanel(props: ControlPanelProps) {
  const preset = findPreset(props.agentId);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-ink-700 flex items-center gap-2">
        <div className="h-2 w-2 bg-ink-300" />
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-300">
          Configuration
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scroll p-4 space-y-4">
        <section>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="label">selected agent</span>
            <button
              className="text-[10px] font-mono text-ink-400 hover:text-ink-100"
              onClick={props.onResetPreset}
            >
              reset to preset
            </button>
          </div>
          <div className="border border-ink-700 bg-ink-950 px-3 py-2.5 flex items-center gap-3">
            <span className="text-xl">{preset.emoji}</span>
            <div className="min-w-0">
              <div className="text-sm text-ink-100">{preset.name}</div>
              <div className="text-[11px] text-ink-400 leading-snug">
                {preset.tagline}
              </div>
            </div>
          </div>
        </section>

        <section>
          <label className="label" htmlFor="api-key">
            smallest api key
          </label>
          <input
            id="api-key"
            className="input font-mono text-[12px]"
            type="password"
            value={props.apiKey}
            onChange={(e) => props.onChangeApiKey(e.target.value)}
            placeholder="sk-…"
            autoComplete="off"
          />
          <p className="mt-1.5 text-[11px] text-ink-400 leading-snug">
            Stays in your browser — appended as <code className="text-ink-200">?api_key=</code>{" "}
            on connect.
          </p>
        </section>

        <section>
          <label className="label" htmlFor="voice">
            voice
          </label>
          <select
            id="voice"
            className="select"
            value={props.voice}
            onChange={(e) => props.onChangeVoice(e.target.value)}
          >
            {VOICES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </section>

        <section>
          <label className="label" htmlFor="instructions">
            instructions / persona
          </label>
          <textarea
            id="instructions"
            className="textarea text-[12px] leading-relaxed"
            rows={8}
            value={props.instructions}
            onChange={(e) => props.onChangeInstructions(e.target.value)}
          />
        </section>

        <section>
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={props.generateInitialResponse}
              onClick={() =>
                props.onToggleInitialResponse(!props.generateInitialResponse)
              }
              className={`relative h-5 w-9 flex-shrink-0 border transition-colors ${
                props.generateInitialResponse
                  ? "bg-ink-100 border-ink-100"
                  : "bg-ink-900 border-ink-600"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3.5 w-3.5 transition-transform ${
                  props.generateInitialResponse
                    ? "translate-x-[18px] bg-ink-950"
                    : "translate-x-0.5 bg-ink-300"
                }`}
              />
            </button>
            <div className="leading-tight">
              <div className="text-sm text-ink-200">agent speaks first</div>
              <div className="text-[11px] text-ink-400">
                LLM-generated greeting on connect
              </div>
            </div>
          </div>
        </section>

        {preset.tools.length > 0 && (
          <section>
            <span className="label">tools</span>
            <div className="border border-ink-700 bg-ink-950 px-3 py-2.5">
              <div className="text-[11px] text-ink-300 mb-1.5">
                {preset.tools.length} client-side tool
                {preset.tools.length === 1 ? "" : "s"} attached.
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preset.tools.map((t) => (
                  <span key={t.name} className="chip">
                    {t.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-400 leading-snug">
                Tools are executed locally — the demo replies with{" "}
                <code className="text-ink-200">function_call_output</code> on
                the same WebSocket.
              </p>
            </div>
          </section>
        )}

        <section>
          <span className="label">presets</span>
          <div className="grid grid-cols-2 gap-1.5">
            {AGENT_PRESETS.map((p) => (
              <span key={p.id} className="chip">
                {p.emoji} {p.name}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
