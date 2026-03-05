"use client";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [voices, setVoices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [text, setText] = useState("Hello! Welcome to Smallest AI. Try any voice from our gallery.");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [langFilter, setLangFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const audioRef = useRef(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setVoices(list);
        setFiltered(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = voices;
    if (langFilter !== "all") {
      result = result.filter((v) =>
        v.tags?.language?.some((l) => l.toLowerCase() === langFilter)
      );
    }
    if (genderFilter !== "all") {
      result = result.filter(
        (v) => v.tags?.gender?.toLowerCase() === genderFilter
      );
    }
    setFiltered(result);
  }, [langFilter, genderFilter, voices]);

  const languages = [...new Set(voices.flatMap((v) => v.tags?.language || []))].sort();
  const genders = [...new Set(voices.map((v) => v.tags?.gender).filter(Boolean))].sort();

  async function handlePlay(voiceId) {
    if (!text.trim()) return;
    setGenerating(voiceId);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice_id: voiceId }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlaying(voiceId);
      audio.onended = () => setPlaying(null);
      audio.play();
    } catch {
      // silently fail
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Smallest AI Voice Gallery</h1>
        <p className="text-gray-400">
          Browse 80+ voices. Type text, pick a voice, hear it instantly.
        </p>
      </div>

      <div className="mb-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type text to synthesize..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-blue-500"
          rows={2}
          maxLength={1000}
        />
        <p className="text-xs text-gray-500 mt-1">{text.length}/1000 characters</p>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Languages</option>
          {languages.map((l) => (
            <option key={l} value={l.toLowerCase()}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Genders</option>
          {genders.map((g) => (
            <option key={g} value={g.toLowerCase()}>
              {g}
            </option>
          ))}
        </select>

        <span className="text-gray-500 text-sm self-center">
          {filtered.length} voice{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading voices...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((voice) => (
            <div
              key={voice.voiceId}
              className={`border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-500 ${
                playing === voice.voiceId
                  ? "border-green-500 bg-green-500/10"
                  : "border-gray-800 bg-gray-900"
              }`}
              onClick={() => handlePlay(voice.voiceId)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg capitalize">
                    {voice.displayName || voice.voiceId}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">{voice.voiceId}</p>
                </div>
                <button
                  disabled={generating === voice.voiceId}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    generating === voice.voiceId
                      ? "bg-gray-700 text-gray-400"
                      : playing === voice.voiceId
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  {generating === voice.voiceId
                    ? "..."
                    : playing === voice.voiceId
                    ? "Playing"
                    : "Play"}
                </button>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {voice.tags?.language?.map((l) => (
                  <span
                    key={l}
                    className="text-xs bg-gray-800 px-2 py-0.5 rounded"
                  >
                    {l}
                  </span>
                ))}
                {voice.tags?.gender && (
                  <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                    {voice.tags.gender}
                  </span>
                )}
                {voice.tags?.accent && (
                  <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                    {voice.tags.accent}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-gray-600 text-sm">
        Powered by{" "}
        <a href="https://smallest.ai" className="text-blue-400 hover:underline">
          Smallest AI
        </a>{" "}
        Lightning TTS v3.1 &middot;{" "}
        <a
          href="https://github.com/smallest-inc/cookbook/tree/main/text-to-speech/voice-gallery-app"
          className="text-blue-400 hover:underline"
        >
          Source Code
        </a>
      </div>
    </div>
  );
}
