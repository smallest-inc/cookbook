"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play,
  Square,
  Loader2,
  Volume2,
  Download,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { trackTryItInteraction, trackDemoLaunch } from "@/lib/analytics";

interface Voice {
  voiceId: string;
  displayName: string;
  tags: {
    age?: string;
    gender?: string;
    accent?: string;
    language?: string[];
    emotions?: string[];
  };
}

const SAMPLE_TEXTS: Record<string, string> = {
  en: "Welcome to Smallest AI! Our Lightning TTS engine generates natural-sounding speech in real time, with latency under one hundred milliseconds. Try changing the voice, speed, or language to hear the difference.",
  hi: "Smallest AI mein aapka swagat hai! Hamara Lightning TTS engine real time mein natural speech generate karta hai. Aap voice, speed aur language badal kar fark sun sakte hain.",
  de: "Willkommen bei Smallest AI! Unsere Lightning TTS-Engine erzeugt in Echtzeit natürlich klingende Sprache mit einer Latenz von unter hundert Millisekunden.",
  es: "Bienvenido a Smallest AI. Nuestro motor Lightning TTS genera voz natural en tiempo real, con una latencia inferior a cien milisegundos.",
  fr: "Bienvenue chez Smallest AI ! Notre moteur Lightning TTS génère une parole naturelle en temps réel, avec une latence inférieure à cent millisecondes.",
};

const LANGUAGE_LABELS: Record<string, string> = {
  english: "English",
  hindi: "Hindi",
  german: "German",
  spanish: "Spanish",
  french: "French",
  italian: "Italian",
  dutch: "Dutch",
  polish: "Polish",
  russian: "Russian",
  arabic: "Arabic",
  hebrew: "Hebrew",
  bengali: "Bengali",
  tamil: "Tamil",
  kannada: "Kannada",
  gujarati: "Gujarati",
  marathi: "Marathi",
  african: "African",
};

const LANG_CODE_MAP: Record<string, string> = {
  english: "en",
  hindi: "hi",
  german: "de",
  spanish: "es",
  french: "fr",
  italian: "it",
  dutch: "nl",
  polish: "pl",
  russian: "ru",
  arabic: "ar",
  hebrew: "he",
  bengali: "bn",
  tamil: "ta",
  kannada: "kn",
  gujarati: "gu",
  marathi: "mr",
  african: "af",
};

export function TryTTS({ projectSlug }: { projectSlug: string }) {
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("ashley");
  const [text, setText] = useState(SAMPLE_TEXTS.en);
  const [speed, setSpeed] = useState(1.0);
  const [language, setLanguage] = useState("en");
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("smallest-api-key");
    if (stored) {
      setApiKey(stored);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setVoiceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadVoices = useCallback(
    async (key: string) => {
      if (!key || voices.length > 0) return;
      setLoadingVoices(true);
      try {
        const res = await fetch("/api/tts", {
          headers: { "x-api-key": key },
        });
        if (res.ok) {
          const data = await res.json();
          setVoices(data.voices || []);
        }
      } catch {
        /* silent */
      } finally {
        setLoadingVoices(false);
      }
    },
    [voices.length]
  );

  const handleSaveKey = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem("smallest-api-key", apiKey);
    loadVoices(apiKey);
    trackTryItInteraction(projectSlug, "api_key_saved");
  };

  const selectedVoiceData = voices.find((v) => v.voiceId === selectedVoice);

  const availableLanguages = selectedVoiceData?.tags.language || ["english"];
  useEffect(() => {
    if (availableLanguages.length > 0) {
      const langCode = LANG_CODE_MAP[availableLanguages[0]] || "en";
      if (!availableLanguages.some((l) => LANG_CODE_MAP[l] === language)) {
        setLanguage(langCode);
        if (SAMPLE_TEXTS[langCode]) setText(SAMPLE_TEXTS[langCode]);
      }
    }
  }, [selectedVoice, availableLanguages, language]);

  const generate = async () => {
    if (!apiKey || !text.trim()) return;
    setGenerating(true);
    setError(null);
    setAudioUrl(null);

    trackDemoLaunch(projectSlug, "try-it");
    trackTryItInteraction(projectSlug, "tts_generate");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: selectedVoice,
          speed,
          sample_rate: 24000,
          language,
          apiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `smallest-tts-${selectedVoice}-${Date.now()}.wav`;
    a.click();
    trackTryItInteraction(projectSlug, "tts_download");
  };

  const voicesByLang = voices.reduce<Record<string, Voice[]>>((acc, v) => {
    const lang = v.tags.language?.[0] || "other";
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(v);
    return acc;
  }, {});

  const hasKey = apiKey.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* API Key Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Key className="h-4 w-4 text-teal" />
          <h3 className="text-sm font-semibold">Your API Key</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Enter your Smallest AI API key to try TTS. Your key stays in your
          browser and is sent directly to the API — we never store it.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={keyVisible ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              placeholder="sk_..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-10 text-sm placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
            />
            <button
              onClick={() => setKeyVisible(!keyVisible)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {keyVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {voices.length > 0 ? "Saved" : "Connect"}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Get your API key at{" "}
          <a
            href="https://app.smallest.ai/dashboard/settings/apikeys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal hover:underline"
          >
            app.smallest.ai
          </a>
        </p>
      </div>

      {/* Controls */}
      <div
        className={`rounded-xl border border-border bg-card p-5 space-y-4 transition-opacity ${hasKey ? "opacity-100" : "opacity-50 pointer-events-none"}`}
      >
        {/* Voice Selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Voice
          </label>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
              className="w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm hover:border-foreground/30 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                {selectedVoiceData ? (
                  <>
                    <span className="font-medium">
                      {selectedVoiceData.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedVoiceData.tags.accent &&
                        `${selectedVoiceData.tags.accent} · `}
                      {selectedVoiceData.tags.gender}
                    </span>
                  </>
                ) : loadingVoices ? (
                  <span className="text-muted-foreground">
                    Loading voices...
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {voices.length === 0
                      ? "Connect API key to load voices"
                      : selectedVoice}
                  </span>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${voiceDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {voiceDropdownOpen && voices.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {Object.entries(voicesByLang)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([lang, langVoices]) => (
                    <div key={lang}>
                      <div className="sticky top-0 bg-card/95 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                        {LANGUAGE_LABELS[lang] || lang}
                      </div>
                      {langVoices
                        .sort((a, b) =>
                          a.displayName.localeCompare(b.displayName)
                        )
                        .map((v) => (
                          <button
                            key={v.voiceId}
                            onClick={() => {
                              setSelectedVoice(v.voiceId);
                              setVoiceDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                              v.voiceId === selectedVoice
                                ? "bg-teal/10 text-teal"
                                : ""
                            }`}
                          >
                            <span className="font-medium">
                              {v.displayName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {v.tags.accent && `${v.tags.accent} · `}
                              {v.tags.gender}
                            </span>
                          </button>
                        ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Language + Speed */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                if (SAMPLE_TEXTS[e.target.value])
                  setText(SAMPLE_TEXTS[e.target.value]);
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
            >
              {availableLanguages.map((lang) => (
                <option key={lang} value={LANG_CODE_MAP[lang] || lang}>
                  {LANGUAGE_LABELS[lang] || lang}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Speed: {speed.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full mt-2 accent-teal"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>0.5x</span>
              <span>2.0x</span>
            </div>
          </div>
        </div>

        {/* Text Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Text to speak
            </label>
            <span
              className={`text-[10px] ${text.length > 1800 ? "text-red-500" : "text-muted-foreground"}`}
            >
              {text.length}/2000
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none"
            placeholder="Type or paste text here..."
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={generate}
          disabled={generating || !text.trim() || !hasKey}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Speech
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Playback */}
        {audioUrl && (
          <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayback}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-white transition-all hover:opacity-90"
              >
                {playing ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  Generated with{" "}
                  {selectedVoiceData?.displayName || selectedVoice}
                </p>
                <p className="text-xs text-muted-foreground">
                  {speed.toFixed(1)}x speed ·{" "}
                  {LANGUAGE_LABELS[
                    availableLanguages.find(
                      (l) => LANG_CODE_MAP[l] === language
                    ) || ""
                  ] || language}
                </p>
              </div>
              <button
                onClick={downloadAudio}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
