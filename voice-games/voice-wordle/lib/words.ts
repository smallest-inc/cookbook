// Curated bank of common, easy-to-pronounce 5-letter words. Used both as the
// secret-answer pool and as accepted guesses (this game doesn't enforce a
// separate "valid guess" dictionary — any 5-letter alphabetic word the player
// says or types is accepted, since STT will only ever return real words).
export const WORDS: string[] = [
  "apple", "beach", "brave", "bread", "brick", "bring", "brown", "build",
  "candy", "chair", "chalk", "charm", "chase", "cheap", "check", "chess",
  "chief", "child", "class", "clean", "clear", "climb", "clock", "cloud",
  "coach", "coast", "could", "count", "court", "cover", "crane", "crash",
  "cream", "crowd", "crown", "dance", "diary", "dream", "dress", "drink",
  "drive", "earth", "eight", "empty", "enjoy", "enter", "equal", "event",
  "every", "exact", "faith", "false", "fancy", "field", "fight", "final",
  "first", "flame", "flash", "fleet", "flesh", "float", "floor", "flour",
  "fluid", "focus", "found", "frame", "fresh", "fruit", "funny", "ghost",
  "giant", "given", "glass", "globe", "grace", "grade", "grain", "grand",
  "grape", "graph", "grass", "great", "green", "grief", "group", "grown",
  "guard", "guess", "guest", "guide", "happy", "harsh", "heart", "heavy",
  "horse", "hotel", "house", "human", "ideal", "image", "index", "inner",
  "input", "issue", "juice", "jumbo", "knife", "known", "large", "laugh",
  "layer", "learn", "least", "leave", "legal", "level", "light", "limit",
  "local", "logic", "loose", "lucky", "lunch", "magic", "major", "match",
  "maybe", "medal", "media", "mercy", "metal", "might", "money", "month",
  "moral", "motor", "mount", "mouse", "mouth", "movie", "music", "north",
  "novel", "nurse", "ocean", "offer", "often", "order", "other", "outer",
  "paint", "panel", "paper", "party", "peace", "phone", "photo", "piece",
  "pilot", "pizza", "place", "plane", "plant", "plate", "point", "pound",
  "power", "press", "price", "pride", "prize", "proof", "proud", "prove",
  "queen", "quick", "quiet", "quilt", "radio", "raise", "range", "reach",
  "ready", "refer", "reply", "right", "river", "robot", "round", "route",
  "royal", "rural", "sauce", "scale", "scene", "scope", "score", "sense",
  "serve", "seven", "shape", "share", "sharp", "sheet", "shelf", "shine",
  "shirt", "shock", "shoot", "shore", "short", "sight", "since", "skill",
  "sleep", "slide", "small", "smart", "smile", "smoke", "snack", "solid",
  "sound", "south", "space", "spare", "speak", "speed", "spend", "spice",
  "sport", "stage", "stair", "stand", "start", "state", "steam", "steel",
  "stick", "stock", "stone", "store", "storm", "story", "study", "stuff",
  "style", "sugar", "sunny", "super", "sweet", "swift", "table", "taste",
  "teach", "thank", "their", "theme", "there", "thick", "thing", "think",
  "third", "three", "throw", "tiger", "tight", "title", "today", "tooth",
  "topic", "total", "touch", "tower", "toxic", "trace", "track", "trade",
  "train", "treat", "trend", "trial", "tribe", "trick", "truck", "truly",
  "trust", "truth", "twice", "uncle", "under", "union", "unite", "until",
  "upper", "urban", "usual", "valid", "value", "video", "virus", "visit",
  "vital", "voice", "watch", "water", "wheel", "where", "which", "while",
  "white", "whole", "world", "worry", "worth", "would", "write", "young",
];

export function randomAnswer(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export type LetterStatus = "correct" | "present" | "absent";

// Standard two-pass Wordle scorer — handles duplicate letters correctly.
export function scoreGuess(guess: string, answer: string): LetterStatus[] {
  const g = guess.toLowerCase().split("");
  const a = answer.toLowerCase().split("");
  const result: LetterStatus[] = new Array(g.length).fill("absent");
  const remaining: Record<string, number> = {};

  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
    } else {
      remaining[a[i]] = (remaining[a[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "correct") continue;
    const letter = g[i];
    if (remaining[letter] > 0) {
      result[i] = "present";
      remaining[letter] -= 1;
    }
  }
  return result;
}

// Extracts the first alphabetic token from a spoken/typed utterance and
// normalizes it, e.g. "the word is house" -> "house". Returns null if no
// clean 5-letter alphabetic word is found.
export function extractGuess(utterance: string): string | null {
  const tokens = utterance.toLowerCase().match(/[a-z]+/g);
  if (!tokens) return null;
  // Prefer the last 5-letter token — people often say "I guess house" or
  // "my guess is house", so the word usually lands at the end.
  const fiveLetter = tokens.filter((t) => t.length === 5);
  if (fiveLetter.length > 0) return fiveLetter[fiveLetter.length - 1];
  return null;
}
