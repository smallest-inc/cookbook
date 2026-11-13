"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AudioStreamPlayer, createAudioContext, streamToPlayer, bufferSpeech, playBuffered } from "./lib/audioPlayer";
import TopicInput from "../components/TopicInput";
import PhilosopherAvatar from "../components/PhilosopherAvatar";
import RoundCounter from "../components/RoundCounter";
import TranscriptPanel from "../components/TranscriptPanel";
import VotePanel from "../components/VotePanel";
import ApiKeyInput from "../components/ApiKeyInput";
import LiveCaption from "../components/LiveCaption";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Words of `text` that were heard before a cut at `frac` of the audio. */
function wordsBefore(text, frac) {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  let n = 0;
  for (const w of weights) {
    if (acc / total > frac) break;
    acc += w;
    n++;
  }
  return Math.max(1, n);
}

const EMPTY_LIVE = { text: "", cutAt: null };

export default function DebateArena() {
  const [phase, setPhase] = useState("setup");
  const [topic, setTopic] = useState("");
  const [totalRounds, setTotalRounds] = useState(3);
  const [currentRound, setCurrentRound] = useState(0);
  const [history, setHistory] = useState([]);
  const [speakingA, setSpeakingA] = useState(false);
  const [speakingB, setSpeakingB] = useState(false);
  const [liveA, setLiveA] = useState(EMPTY_LIVE);
  const [liveB, setLiveB] = useState(EMPTY_LIVE);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState(null);
  const [socratesEmotion, setSocratesEmotion] = useState(null);
  const [aristotleEmotion, setAristotleEmotion] = useState(null);
  const [mode, setMode] = useState("philosophical");
  const [fighters, setFighters] = useState({ a: {}, b: {} });
  const [apiKeys, setApiKeys] = useState(null);
  const [hasServerKeys, setHasServerKeys] = useState(true);
  const [ttsUsed, setTtsUsed] = useState(0);
  const FREE_TTS_LIMIT = 6; // 3 rounds x 2 speakers = 6 generations

  const abortRef = useRef(false);
  const abortControllerRef = useRef(null);
  const ctxRef = useRef(null);
  const playerARef = useRef(null);
  const playerBRef = useRef(null);

  // Pre-warm routes + check if server has keys configured
  useEffect(() => {
    fetch("/api/debate/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then((r) => {
        if (r.status === 401) setHasServerKeys(false);
      })
      .catch(() => {});
    fetch("/api/debate/speak-stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
  }, []);

  const nameA = fighters.a?.name || "Socrates";
  const nameB = fighters.b?.name || "Aristotle";

  const startDebate = useCallback(
    async (selectedTopic, rounds, socVoice, ariVoice, debateMode, opts = {}) => {
      const cast = opts.fighters || { a: {}, b: {} };
      const interrupt = !!opts.interrupt;
      setTopic(selectedTopic);
      setTotalRounds(rounds);
      setHistory([]);
      setCurrentRound(0);
      setVerdict(null);
      setError(null);
      setSocratesEmotion(null);
      setAristotleEmotion(null);
      setLiveA(EMPTY_LIVE);
      setLiveB(EMPTY_LIVE);
      setPhase("debating");
      setMode(debateMode || "philosophical");
      setFighters(cast);
      abortRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      // Still inside the Begin click: create the audio context now so mobile Safari allows playback.
      if (ctxRef.current) ctxRef.current.close().catch(() => {});
      const ctx = createAudioContext();
      ctxRef.current = ctx;
      const pA = new AudioStreamPlayer(ctx);
      const pB = new AudioStreamPlayer(ctx);
      playerARef.current = pA;
      playerBRef.current = pB;

      const gen = (round, hist) => generateRound(selectedTopic, round, rounds, hist, debateMode, apiKeys, cast, interrupt);
      const debateHistory = [];
      let nextRoundPromise = null;
      let debateFailed = false;

      for (let round = 1; round <= rounds; round++) {
        if (abortRef.current) break;
        setCurrentRound(round);

        let data;
        try {
          data = nextRoundPromise ? await nextRoundPromise : await gen(round, debateHistory);
          nextRoundPromise = null;
          if (data.error) throw new Error(data.error);
        } catch (err) {
          setError(`Round ${round} failed: ${err.message}`);
          debateFailed = true;
          break;
        }
        if (abortRef.current) break;

        const textA = data.socrates.text;
        const textB = data.aristotle.text;
        const socVoiceParams = data.socrates.voiceParams || {};
        const ariVoiceParams = data.aristotle.voiceParams || {};
        setSocratesEmotion(socVoiceParams.emotion || null);
        setAristotleEmotion(ariVoiceParams.emotion || null);

        const roundEntry = { socrates: textA, aristotle: "" };
        debateHistory.push(roundEntry);
        setHistory([...debateHistory]);

        try {
          // Buffer B while A talks, so B can start instantly (or cut A off).
          const bBuffer = bufferSpeech(textB, ariVoice, ariVoiceParams, ac.signal, apiKeys);
          if (!apiKeys) setTtsUsed((p) => p + 2);

          setLiveA({ text: textA, cutAt: null });
          setSpeakingA(true);
          await streamToPlayer(textA, socVoice, socVoiceParams, pA, ac.signal, apiKeys);
          // Next round is written while this one plays. Give it both of this round's arguments.
          if (round < rounds) nextRoundPromise = gen(round + 1, debateHistory.map((h) => (h === roundEntry ? { socrates: textA, aristotle: textB } : h)));

          if (interrupt) {
            const bChunks = await bBuffer;
            // Let A get 55 to 75 percent through, then B barges in over the top.
            const cutFrac = 0.55 + Math.random() * 0.2;
            while (!abortRef.current) {
              const { elapsed, total } = pA.progress();
              if (total > 0 && elapsed >= total * cutFrac) break;
              if (!pA.isPlaying) break;
              await delay(40);
            }
            if (abortRef.current) break;
            roundEntry.aristotle = textB;
            setHistory([...debateHistory]);
            setLiveB({ text: textB, cutAt: null });
            playBuffered(bChunks, pB);
            setSpeakingB(true);
            await delay(650 + Math.random() * 350); // both talking at once
            const { elapsed, total } = pA.progress();
            const cutAt = wordsBefore(textA, total ? (elapsed + 0.25) / total : 1);
            const heard = textA.split(/\s+/).filter(Boolean).slice(0, cutAt).join(" ");
            pA.cutOff(250);
            roundEntry.socrates = `${heard}...`;
            setHistory([...debateHistory]);
            setLiveA({ text: textA, cutAt });
            await delay(260);
            setSpeakingA(false);
            await pB.waitUntilDone();
            setSpeakingB(false);
          } else {
            await pA.waitUntilDone();
            setSpeakingA(false);
            if (abortRef.current) break;
            roundEntry.aristotle = textB;
            setHistory([...debateHistory]);
            await delay(400);
            if (abortRef.current) break;
            const bChunks = await bBuffer;
            setLiveB({ text: textB, cutAt: null });
            playBuffered(bChunks, pB);
            setSpeakingB(true);
            await pB.waitUntilDone();
            setSpeakingB(false);
          }

          if (abortRef.current) break;
          if (round < rounds) await delay(interrupt ? 150 : 400);
        } catch (err) {
          if (!abortRef.current) setError(`Playback error: ${err.message}`);
          debateFailed = true;
          break;
        }
      }

      setSpeakingA(false);
      setSpeakingB(false);
      if (abortRef.current || debateFailed) {
        setPhase(debateFailed ? "done" : "setup");
        return;
      }

      setPhase("judging");
      try {
        const judgeHeaders = { "Content-Type": "application/json" };
        if (apiKeys?.openaiKey) judgeHeaders["x-openai-key"] = apiKeys.openaiKey;
        const res = await fetch("/api/debate/judge", {
          method: "POST",
          headers: judgeHeaders,
          body: JSON.stringify({ topic: selectedTopic, rounds: debateHistory, fighters: cast }),
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
    [apiKeys]
  );

  const stopAll = () => {
    abortRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    playerARef.current?.stop();
    playerBRef.current?.stop();
    setSpeakingA(false);
    setSpeakingB(false);
  };

  const stopDebate = useCallback(() => stopAll(), []);

  const resetDebate = useCallback(() => {
    stopAll();
    setPhase("setup");
    setHistory([]);
    setCurrentRound(0);
    setVerdict(null);
    setError(null);
    setLiveA(EMPTY_LIVE);
    setLiveB(EMPTY_LIVE);
  }, []);

  const socratesEntries = history.map((h) => h.socrates).filter(Boolean);
  const aristotleEntries = history.map((h) => h.aristotle).filter(Boolean);
  const anyoneSpeaking = speakingA || speakingB;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start p-4 sm:justify-center sm:p-6">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-gold fixed left-1/2 top-6 z-50 max-w-md -translate-x-1/2 rounded-xl border border-terracotta/20 px-5 py-3 text-center text-sm text-terracotta"
          >
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-lg text-terracotta/60 hover:text-terracotta">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "setup" && (
        <div className="mx-auto w-full max-w-2xl space-y-6">
          {(() => {
            const freeLeft = FREE_TTS_LIMIT - ttsUsed;
            const needsKeys = !apiKeys && (!hasServerKeys || freeLeft <= 0);
            return (
              <>
                <TopicInput onStart={startDebate} disabled={needsKeys} />
                <ApiKeyInput freeDebatesLeft={hasServerKeys ? Math.max(0, freeLeft) : 0} onKeysSet={setApiKeys} />
              </>
            );
          })()}
        </div>
      )}

      {phase !== "setup" && (
        <div className="w-full max-w-4xl space-y-5 sm:space-y-8">
          <div className="space-y-2 pt-2 text-center sm:space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="font-display text-[10px] uppercase tracking-[0.4em] text-gold-dim">The Agora</div>
              {mode === "roast" && <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-display text-[9px] tracking-wider text-terracotta/80">Roast Battle</span>}
            </div>
            <h2 className="font-display text-2xl font-semibold italic leading-tight text-cream/80 sm:text-3xl">&ldquo;{topic}&rdquo;</h2>
          </div>

          {phase === "debating" && <RoundCounter current={currentRound} total={totalRounds} />}
          {phase === "judging" && (
            <div className="text-center">
              <div className="glass-gold inline-flex items-center gap-2 rounded-full px-5 py-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-gold" />
                <span className="font-display text-xs italic tracking-wider text-cream/40">The judges of Athens deliberate...</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 items-start gap-4 sm:gap-10">
            <PhilosopherAvatar
              name={nameA}
              subtitle="Argues FOR"
              isSpeaking={speakingA}
              isListening={speakingB && !speakingA}
              side="socrates"
              player={playerARef.current}
              emotion={socratesEmotion}
              size="large"
            />
            <PhilosopherAvatar
              name={nameB}
              subtitle="Argues AGAINST"
              isSpeaking={speakingB}
              isListening={speakingA && !speakingB}
              side="aristotle"
              player={playerBRef.current}
              emotion={aristotleEmotion}
              size="large"
            />
          </div>

          {/* Live captions: whoever is talking, both while they talk over each other */}
          <div className="mx-auto flex min-h-[132px] w-full max-w-2xl flex-col justify-end gap-2">
            <LiveCaption text={liveA.text} cutAt={liveA.cutAt} player={playerARef.current} name={nameA} color="gold" active={speakingA} />
            <LiveCaption text={liveB.text} player={playerBRef.current} name={nameB} color="olive" active={speakingB} />
            {!anyoneSpeaking && phase === "debating" && (
              <div className="text-center font-display text-sm italic text-cream/30">{currentRound === 0 || !history.length ? "Writing the opening arguments..." : "..."}</div>
            )}
          </div>

          {/* Live captions carry the debate; the full transcript only shows once it is over, so it never gives away a line early. */}
          {phase !== "debating" && (
            <div className="space-y-2">
              <div className="text-center font-display text-[10px] uppercase tracking-[0.3em] text-cream/30">Full transcript</div>
              <div className="grid grid-cols-2 items-start gap-3 sm:gap-6">
                <TranscriptPanel entries={socratesEntries} side="socrates" />
                <TranscriptPanel entries={aristotleEntries} side="aristotle" />
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            {phase === "debating" && (
              <button onClick={stopDebate} className="glass-gold rounded-xl px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.15em] text-cream/40 transition-all hover:text-gold/70">
                Cease Debate
              </button>
            )}
            {phase === "done" && (
              <button onClick={resetDebate} className="glass-gold rounded-xl px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.15em] text-cream/40 transition-all hover:text-gold/70">
                New Question
              </button>
            )}
          </div>

          {phase === "done" && <VotePanel verdict={verdict} names={{ socrates: nameA, aristotle: nameB }} />}
        </div>
      )}

      <div className="mt-10 pb-2 text-center font-display text-[10px] tracking-[0.15em] text-cream/20">Powered by Smallest AI Lightning v3.1 Pro</div>
    </main>
  );
}

async function generateRound(topic, round, totalRounds, history, mode, apiKeys, fighters, interrupt) {
  const headers = { "Content-Type": "application/json" };
  if (apiKeys?.openaiKey) headers["x-openai-key"] = apiKeys.openaiKey;
  const res = await fetch("/api/debate/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({ topic, round, totalRounds, history, mode: mode === "roast" ? "roast" : undefined, fighters, interrupt }),
  });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.json();
}
