"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AudioStreamPlayer, streamAndPlay, bufferSpeech } from "./lib/audioPlayer";
import TopicInput from "../components/TopicInput";
import PhilosopherAvatar from "../components/PhilosopherAvatar";
import RoundCounter from "../components/RoundCounter";
import TranscriptPanel from "../components/TranscriptPanel";
import VotePanel from "../components/VotePanel";
import ApiKeyInput from "../components/ApiKeyInput";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DebateArena() {
  const [phase, setPhase] = useState("setup");
  const [topic, setTopic] = useState("");
  const [totalRounds, setTotalRounds] = useState(3);
  const [currentRound, setCurrentRound] = useState(0);
  const [history, setHistory] = useState([]);
  const [speaking, setSpeaking] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState(null);
  const [socratesEmotion, setSocratesEmotion] = useState(null);
  const [aristotleEmotion, setAristotleEmotion] = useState(null);
  const [mode, setMode] = useState("philosophical");
  const [apiKeys, setApiKeys] = useState(null);
  const [hasServerKeys, setHasServerKeys] = useState(true);
  const [ttsUsed, setTtsUsed] = useState(0);
  const FREE_TTS_LIMIT = 6; // 3 rounds × 2 speakers = 6 generations

  const abortRef = useRef(false);
  const abortControllerRef = useRef(null);
  const playerRef = useRef(null);

  // Pre-warm routes + check if server has keys configured
  useEffect(() => {
    fetch("/api/debate/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then((r) => { if (r.status === 401) setHasServerKeys(false); })
      .catch(() => {});
    fetch("/api/debate/speak-stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
  }, []);

  const startDebate = useCallback(
    async (selectedTopic, rounds, socVoice, ariVoice, debateMode) => {
      setTopic(selectedTopic);
      setTotalRounds(rounds);
      setHistory([]);
      setCurrentRound(0);
      setVerdict(null);
      setError(null);
      setSocratesEmotion(null);
      setAristotleEmotion(null);
      setPhase("debating");
      setMode(debateMode || "philosophical");
      abortRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      const player = new AudioStreamPlayer();
      playerRef.current = player;

      const debateHistory = [];
      let nextRoundPromise = null;
      let debateFailed = false;

      for (let round = 1; round <= rounds; round++) {
        if (abortRef.current) break;
        setCurrentRound(round);

        // 1. Generate arguments
        let data;
        try {
          if (nextRoundPromise) {
            data = await nextRoundPromise;
            nextRoundPromise = null;
          } else {
            data = await generateRound(selectedTopic, round, rounds, debateHistory, debateMode, apiKeys);
          }
          if (data.error) throw new Error(data.error);
        } catch (err) {
          setError(`Round ${round} failed: ${err.message}`);
          debateFailed = true;
          break;
        }

        if (abortRef.current) break;

        const socVoiceParams = data.socrates.voiceParams || {};
        const ariVoiceParams = data.aristotle.voiceParams || {};
        setSocratesEmotion(socVoiceParams.emotion || null);
        setAristotleEmotion(ariVoiceParams.emotion || null);

        // Record history
        const roundEntry = { socrates: data.socrates.text, aristotle: "" };
        debateHistory.push(roundEntry);
        setHistory([...debateHistory]);

        try {
          // 2. Start buffering Aristotle audio in background
          const aristotleBufferPromise = bufferSpeech(
            data.aristotle.text, ariVoice, ariVoiceParams, ac.signal, apiKeys
          );

          // 3. Stream + play Socrates immediately (audio starts from first chunk!)
          if (!apiKeys) setTtsUsed((p) => p + 2); // count both TTS calls
          setSpeaking("socrates");
          await streamAndPlay(data.socrates.text, socVoice, socVoiceParams, player, ac.signal, apiKeys);
          setSpeaking(null);

          if (abortRef.current) break;

          // Pre-fetch next round NOW
          if (round < rounds) {
            nextRoundPromise = generateRound(
              selectedTopic, round + 1, rounds, debateHistory, debateMode, apiKeys
            );
          }

          // Update Aristotle transcript
          roundEntry.aristotle = data.aristotle.text;
          setHistory([...debateHistory]);

          await delay(400);
          if (abortRef.current) break;

          // 4. Play Aristotle from buffered chunks (instant start)
          setSpeaking("aristotle");
          player.reset();
          const aristotleChunks = await aristotleBufferPromise;
          for (const chunk of aristotleChunks) player.appendChunk(chunk);
          await player.waitUntilDone();
          setSpeaking(null);

          if (abortRef.current) break;
          if (round < rounds) await delay(400);
        } catch (err) {
          if (!abortRef.current) setError(`Playback error: ${err.message}`);
          debateFailed = true;
          break;
        }
      }

      setSpeaking(null);
      if (abortRef.current || debateFailed) {
        setPhase(debateFailed ? "done" : "setup");
        return;
      }

      // Judge
      setPhase("judging");
      try {
        const judgeHeaders = { "Content-Type": "application/json" };
        if (apiKeys?.openaiKey) judgeHeaders["x-openai-key"] = apiKeys.openaiKey;
        const res = await fetch("/api/debate/judge", {
          method: "POST",
          headers: judgeHeaders,
          body: JSON.stringify({ topic: selectedTopic, rounds: debateHistory }),
        });
        if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
        const judgeData = await res.json();
        if (judgeData.error) throw new Error(judgeData.error);
        setVerdict(judgeData);
        setPhase("done");
      } catch (err) {
        setError(`Judging failed: ${err.message}`);
        setPhase("done");
      }
    },
    []
  );

  const stopDebate = useCallback(() => {
    abortRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (playerRef.current) playerRef.current.stop();
    setSpeaking(null);
  }, []);

  const resetDebate = useCallback(() => {
    abortRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (playerRef.current) playerRef.current.stop();
    setSpeaking(null);
    setPhase("setup");
    setHistory([]);
    setCurrentRound(0);
    setVerdict(null);
    setError(null);
  }, []);

  const socratesEntries = history.map((h) => h.socrates).filter(Boolean);
  const aristotleEntries = history.map((h) => h.aristotle).filter(Boolean);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl glass-gold border border-terracotta/20 text-terracotta text-sm max-w-md text-center"
          >
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-terracotta/60 hover:text-terracotta text-lg">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "setup" && (
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {(() => {
            const freeLeft = FREE_TTS_LIMIT - ttsUsed;
            const needsKeys = !apiKeys && (!hasServerKeys || freeLeft <= 0);
            return (
              <>
                <TopicInput onStart={startDebate} disabled={needsKeys} />
                <ApiKeyInput
                  freeDebatesLeft={hasServerKeys ? Math.max(0, freeLeft) : 0}
                  onKeysSet={setApiKeys}
                />
              </>
            );
          })()}
        </div>
      )}

      {phase !== "setup" && (
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="text-[10px] uppercase tracking-[0.4em] text-gold-dim font-display">The Agora</div>
              {mode === "roast" && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-terracotta/15 text-terracotta/70 font-display tracking-wider">Roast Battle</span>
              )}
            </div>
            <h2 className="font-display text-2xl font-semibold text-cream/70 italic">&ldquo;{topic}&rdquo;</h2>
            <div className="w-32 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent mx-auto" />
          </div>

          {phase === "debating" && <RoundCounter current={currentRound} total={totalRounds} />}
          {phase === "judging" && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 glass-gold rounded-full px-5 py-2">
                <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                <span className="text-xs text-cream/35 tracking-wider font-display italic">The judges of Athens deliberate...</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_60px_1fr] gap-4 items-start">
            <div className="flex flex-col items-center gap-5">
              <PhilosopherAvatar name="Socrates" subtitle="Argues FOR" isSpeaking={speaking === "socrates"} side="socrates" player={speaking === "socrates" ? playerRef.current : null} emotion={socratesEmotion} />
              <TranscriptPanel entries={socratesEntries} side="socrates" />
            </div>
            <div className="flex flex-col items-center justify-center pt-10 gap-3">
              <div className="w-8 h-3 rounded-sm bg-gradient-to-b from-gold/15 to-gold/5 border-t border-gold/20" />
              <div className="w-4 flex flex-col items-center">
                <div className="w-1 h-6 bg-gold/10 rounded-full" />
                <div className="w-3 h-3 rounded-full glass-gold border border-gold/10 flex items-center justify-center my-1">
                  <span className="text-[8px] text-gold/40 font-display font-bold">vs</span>
                </div>
                <div className="w-1 h-6 bg-gold/10 rounded-full" />
              </div>
              <div className="w-px h-24 bg-gradient-to-b from-gold/10 via-gold/5 to-transparent" />
            </div>
            <div className="flex flex-col items-center gap-5">
              <PhilosopherAvatar name="Aristotle" subtitle="Argues AGAINST" isSpeaking={speaking === "aristotle"} side="aristotle" player={speaking === "aristotle" ? playerRef.current : null} emotion={aristotleEmotion} />
              <TranscriptPanel entries={aristotleEntries} side="aristotle" />
            </div>
          </div>

          <div className="flex justify-center gap-3">
            {phase === "debating" && (
              <button onClick={stopDebate} className="px-6 py-2.5 rounded-xl text-xs font-display font-semibold tracking-[0.15em] uppercase glass-gold text-cream/30 hover:text-gold/60 transition-all">Cease Debate</button>
            )}
            {phase === "done" && (
              <button onClick={resetDebate} className="px-6 py-2.5 rounded-xl text-xs font-display font-semibold tracking-[0.15em] uppercase glass-gold text-cream/30 hover:text-gold/60 transition-all">New Question</button>
            )}
          </div>

          {phase === "done" && <VotePanel verdict={verdict} />}
        </div>
      )}

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-cream/10 tracking-[0.15em] font-display">
        Powered by Smallest AI Lightning TTS v3.2
      </div>
    </main>
  );
}

async function generateRound(topic, round, totalRounds, history, mode, apiKeys) {
  const headers = { "Content-Type": "application/json" };
  if (apiKeys?.openaiKey) headers["x-openai-key"] = apiKeys.openaiKey;

  const res = await fetch("/api/debate/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({ topic, round, totalRounds, history, mode: mode === "roast" ? "roast" : undefined }),
  });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.json();
}
