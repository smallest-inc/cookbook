"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePulseSTT } from "../lib/usePulseSTT";
import { useLightningTTS } from "../lib/useLightningTTS";
import { randomAnswer, scoreGuess, extractGuess, LetterStatus } from "../lib/words";

const MAX_GUESSES = 6;
const WORD_LEN = 5;
const VOICE = "avery";
const MODEL = "lightning_v3.1";

type Status = "idle" | "listening" | "speaking";
const STATUS_LABEL: Record<Status, string> = { idle: "ready", listening: "listening", speaking: "speaking" };

const KB_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const STATUS_PRIORITY: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1 };

function isNewGameCommand(text: string): boolean {
  return /\b(new game|restart|play again|reset)\b/i.test(text);
}

// Gate shown before the game loads. The key is held only in this component's
// (and its parent's) React state — nothing is written to localStorage or
// sessionStorage, so reloading the tab always comes back here.
function ApiKeyGate({ onSubmit, error }: { onSubmit: (key: string) => void; error: string | null }) {
  const [value, setValue] = useState("");

  return (
    <div className="app">
      <div className="gate">
        <div className="logo" style={{ width: 48, height: 48, fontSize: 20, marginBottom: 8 }}>S</div>
        <h1 className="gate-title">Voice Wordle</h1>
        <p className="gate-subtitle">
          Play Wordle by voice, powered by your own{" "}
          <a href="https://smallest.ai" target="_blank" rel="noreferrer">
            Smallest AI
          </a>{" "}
          API key.
        </p>
        <form
          className="gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            const key = value.trim();
            if (key) onSubmit(key);
          }}
        >
          <input
            className="gate-input"
            type="password"
            autoFocus
            placeholder="Your Smallest API key"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="gate-submit" type="submit" disabled={!value.trim()}>
            Start playing
          </button>
        </form>
        {error && <div className="gate-error">{error}</div>}
        <p className="gate-note">
          Your key is only sent to this app's proxy, for this browser tab, and is never written to
          disk — reloading the page will ask for it again.
        </p>
      </div>
    </div>
  );
}

function WordleGame({ apiKey, onExit }: { apiKey: string; onExit: (error?: string) => void }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [statusesList, setStatusesList] = useState<LetterStatus[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [inputText, setInputText] = useState("");
  const [lastFeedback, setLastFeedback] = useState("");

  const tts = useLightningTTS();
  // The very first speak() call (the welcome message) is our free key check —
  // if it fails before any audio plays, that's almost always a bad key, so we
  // bounce back to the gate instead of leaving the player stuck in a silent game.
  const hasSpokenSuccessfullyRef = useRef(false);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      setStatus("speaking");
      tts.speak({
        apiKey,
        text,
        voice: VOICE,
        model: MODEL,
        onEnd: () => {
          hasSpokenSuccessfullyRef.current = true;
          setStatus("idle");
          onEnd?.();
        },
        onError: (msg) => {
          setStatus("idle");
          if (!hasSpokenSuccessfullyRef.current) {
            onExit(`Couldn't reach Smallest TTS with that key (${msg}). Please check it and try again.`);
          }
        },
      });
    },
    [tts, apiKey, onExit]
  );

  const startNewGame = useCallback(
    (announce: boolean) => {
      const next = randomAnswer();
      setAnswer(next);
      setGuesses([]);
      setStatusesList([]);
      setGameOver(false);
      setWon(false);
      setInputText("");
      const msg = announce
        ? "New game! Say a five letter word to guess."
        : "Welcome to Voice Wordle. Hold the mic and say a five letter word to guess.";
      setLastFeedback(msg);
      speak(msg);
    },
    [speak]
  );

  // Pick the secret word client-side only, after mount, to avoid SSR/client mismatch.
  useEffect(() => {
    startNewGame(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitGuess = useCallback(
    (guess: string) => {
      if (!answer) return;
      const statuses = scoreGuess(guess, answer);
      const newGuesses = [...guesses, guess];
      const newStatuses = [...statusesList, statuses];
      setGuesses(newGuesses);
      setStatusesList(newStatuses);
      setInputText("");

      const guessNum = newGuesses.length;
      const isWin = guess === answer;
      const isLoss = !isWin && guessNum >= MAX_GUESSES;

      const perLetter = statuses
        .map((s, i) => `${guess[i].toUpperCase()} ${s === "correct" ? "correct" : s === "present" ? "wrong spot" : "not in the word"}`)
        .join(", ");

      let feedback: string;
      if (isWin) {
        feedback = `${guess.toUpperCase()} is correct! You solved it in ${guessNum} ${guessNum === 1 ? "try" : "tries"}.`;
        setGameOver(true);
        setWon(true);
      } else if (isLoss) {
        feedback = `${perLetter}. That was your last guess. The word was ${answer.toUpperCase()}.`;
        setGameOver(true);
        setWon(false);
      } else {
        const remaining = MAX_GUESSES - guessNum;
        feedback = `${perLetter}. ${remaining} ${remaining === 1 ? "guess" : "guesses"} left.`;
      }
      setLastFeedback(feedback);
      speak(feedback);
    },
    [answer, guesses, statusesList, speak]
  );

  const handleUtterance = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      if (isNewGameCommand(text)) {
        startNewGame(true);
        return;
      }
      if (gameOver) {
        speak("The game is over. Say new game to play again.");
        return;
      }
      const guess = extractGuess(text);
      if (!guess) {
        speak("I didn't catch a five letter word. Please say your guess again.");
        return;
      }
      submitGuess(guess);
    },
    [gameOver, startNewGame, submitGuess, speak]
  );

  const { recording, partial, start, stop } = usePulseSTT({
    apiKey,
    language: "en",
    onEvent: (e) => {
      if (e.type === "open") setStatus("listening");
      if (e.type === "close") {
        setStatus((s) => (s === "listening" ? "idle" : s));
        if (e.cleanBeforeAnyResult && e.code !== 1000 && !hasSpokenSuccessfullyRef.current) {
          onExit(`Couldn't reach Smallest STT with that key (code ${e.code}). Please check it and try again.`);
        }
      }
      if (e.type === "final") {
        setStatus("idle");
        stop();
        handleUtterance(e.text);
      }
    },
  });

  // Push-to-talk: mousedown to start, mouseup/leave/touchend to stop. Also
  // accept a quick click as tap-to-toggle.
  const heldRef = useRef(false);
  const micBusy = status === "speaking";
  const micDown = () => {
    if (micBusy) return;
    if (!recording) {
      heldRef.current = true;
      start();
    }
  };
  const micUp = () => {
    if (heldRef.current && recording) {
      heldRef.current = false;
      stop();
    }
  };
  const micToggle = () => {
    if (micBusy) return;
    if (heldRef.current) return;
    recording ? stop() : start();
  };

  const keyboardStatus = useMemo(() => {
    const map: Record<string, LetterStatus> = {};
    guesses.forEach((g, ri) => {
      g.split("").forEach((ch, ci) => {
        const s = statusesList[ri][ci];
        if (!map[ch] || STATUS_PRIORITY[s] > STATUS_PRIORITY[map[ch]]) map[ch] = s;
      });
    });
    return map;
  }, [guesses, statusesList]);

  const currentRowLetters = useMemo(
    () => (partial || inputText).toLowerCase().replace(/[^a-z]/g, "").slice(0, WORD_LEN).split(""),
    [partial, inputText]
  );

  const rows = Array.from({ length: MAX_GUESSES }, (_, row) => {
    if (row < guesses.length) {
      return { letters: guesses[row].split(""), statuses: statusesList[row] as (LetterStatus | undefined)[] };
    }
    if (row === guesses.length && !gameOver) {
      return { letters: currentRowLetters, statuses: [] as (LetterStatus | undefined)[] };
    }
    return { letters: [] as string[], statuses: [] as (LetterStatus | undefined)[] };
  });

  return (
    <div className="app">
      <div className="header">
        <div className="logo">S</div>
        <div>
          <div className="title">Voice Wordle</div>
          <div className="subtitle">Pulse STT · Lightning v3.1 TTS</div>
        </div>
        <div className="status-pill" data-state={status}>
          <span className="dot" />
          {STATUS_LABEL[status]}
        </div>
        <button className="change-key" onClick={() => onExit()} title="Use a different API key">
          change key
        </button>
      </div>

      <div className="main">
        <div className={`banner ${gameOver ? "result" : ""} ${won ? "win" : gameOver ? "lose" : ""}`}>
          {!answer
            ? "Loading…"
            : gameOver
            ? won
              ? "You won! Say “new game” to play again."
              : `Out of guesses. The word was ${answer.toUpperCase()}. Say “new game” to play again.`
            : "Hold the mic and say a 5-letter word — or type one below."}
        </div>

        <div className="board">
          {rows.map((row, ri) => (
            <div className="row" key={ri}>
              {Array.from({ length: WORD_LEN }, (_, ci) => {
                const letter = row.letters[ci] || "";
                const st = row.statuses[ci];
                return (
                  <div key={ci} className="tile" data-filled={!!letter} data-status={st || ""}>
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="keyboard">
          {KB_ROWS.map((row, ri) => (
            <div className="kb-row" key={ri}>
              {row.split("").map((ch) => (
                <div key={ch} className="key" data-status={keyboardStatus[ch] || ""}>
                  {ch}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="controls">
          <button className="new-game" onClick={() => startNewGame(true)}>
            New game
          </button>
          {lastFeedback && (
            <button className="replay" onClick={() => speak(lastFeedback)} disabled={status === "speaking"}>
              ▶ replay feedback
            </button>
          )}
        </div>
      </div>

      <div className="composer">
        <button
          className="mic"
          data-active={recording}
          disabled={micBusy}
          onMouseDown={micDown}
          onMouseUp={micUp}
          onMouseLeave={micUp}
          onTouchStart={(e) => { e.preventDefault(); micDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); micUp(); }}
          onClick={micToggle}
          title={recording ? "Release to stop" : "Hold to talk (or tap)"}
        >
          {recording ? (
            <div className="waveform">
              <span /><span /><span /><span /><span />
            </div>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        <input
          className={`input ${partial ? "live" : ""}`}
          placeholder={recording ? "Listening…" : "Type your guess or say “new game”"}
          value={partial || inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputText.trim()) handleUtterance(inputText);
          }}
          readOnly={recording}
        />
        <button
          className="send"
          onClick={() => handleUtterance(inputText)}
          disabled={!inputText.trim() || recording}
          title="Send"
        >
          ↑
        </button>
      </div>

      <div className="footer-note">
        Say a 5-letter word to guess, or “new game” anytime to restart. Runs on Smallest AI Pulse STT + Lightning TTS.
      </div>
    </div>
  );
}

export default function Page() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  if (!apiKey) {
    return (
      <ApiKeyGate
        error={gateError}
        onSubmit={(key) => {
          setGateError(null);
          setApiKey(key);
        }}
      />
    );
  }

  return (
    <WordleGame
      apiKey={apiKey}
      onExit={(error) => {
        setApiKey(null);
        setGateError(error ?? null);
      }}
    />
  );
}
