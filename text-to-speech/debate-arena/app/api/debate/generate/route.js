import { NextResponse } from "next/server";

const EMOTIONS = [
  "neutral", "happy", "sad", "angry", "excited", "calm", "sarcastic",
  "frustrated", "fearful", "surprised", "confident", "amused",
  "empathetic", "nostalgic", "pleading", "skeptical",
];
const PITCHES = ["mid-range", "high-pitched", "low-pitched", "breathy"];
const VOLUMES = ["normal", "shouting", "soft", "whispering", "loud"];
const PROSODIES = ["normal", "slow", "fast", "melodic", "monotonous", "hesitant", "measured"];

const SYSTEM_PROMPT = `You are writing a philosophical debate between two ancient Greek thinkers arguing about a modern topic.

SOCRATES argues FOR the topic. He uses the Socratic method — rhetorical questions, appeals to wisdom and virtue, passionate conviction. He speaks with the eloquence of an ancient philosopher but addresses the topic directly.

ARISTOTLE argues AGAINST the topic. He uses logic and systematic analysis — appeals to evidence, reason, natural law. He is methodical, precise, and sometimes dryly witty.

Rules:
- Each argument must be 2-4 sentences. Be punchy and philosophical, not academic.
- Arguments MUST directly respond to the other side's previous points when available.
- Escalate intensity as the debate progresses:
  - Early rounds: measured, establishing philosophical positions
  - Middle rounds: pointed rebuttals, challenging each other's reasoning
  - Final rounds: impassioned conclusions, appeals to higher truth
- For each argument, predict the best voice parameters to match the emotional tone.

Return ONLY a JSON object (no markdown) with this exact structure:
{
  "socrates": {
    "text": "the argument text",
    "voiceParams": {
      "emotion": one of ${JSON.stringify(EMOTIONS)},
      "pitch": one of ${JSON.stringify(PITCHES)},
      "volume": one of ${JSON.stringify(VOLUMES)},
      "prosody": one of ${JSON.stringify(PROSODIES)}
    }
  },
  "aristotle": {
    "text": "the argument text",
    "voiceParams": {
      "emotion": one of ${JSON.stringify(EMOTIONS)},
      "pitch": one of ${JSON.stringify(PITCHES)},
      "volume": one of ${JSON.stringify(VOLUMES)},
      "prosody": one of ${JSON.stringify(PROSODIES)}
    }
  }
}`;

export async function POST(request) {
  const { topic, round, totalRounds, history, mode } = await request.json();

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  // Mode-specific prompt adjustment
  let modeInstructions = "";
  if (mode === "roast") {
    modeInstructions = `\n\nIMPORTANT — ROAST BATTLE MODE:
This is a comedic roast battle! The philosophers should:
- Mock and satirize each other's arguments with sharp wit
- Use exaggerated metaphors, absurd analogies, and cutting sarcasm
- Reference each other by name with playful insults ("Oh dear Socrates, your logic is as sound as a sieve in a rainstorm")
- Be genuinely funny — aim for crowd laughter, not academic points
- Still argue FOR/AGAINST the topic, but in the most entertaining way possible
- Use emotions like "sarcastic", "amused", "excited" more often`;
  }

  let userPrompt = `Topic for debate: "${topic}"\nRound ${round} of ${totalRounds}.${modeInstructions}\n`;

  if (history && history.length > 0) {
    userPrompt += "\nPrevious rounds:\n";
    history.forEach((h, i) => {
      userPrompt += `\nRound ${i + 1}:\n`;
      userPrompt += `  Socrates: "${h.socrates}"\n`;
      userPrompt += `  Aristotle: "${h.aristotle}"\n`;
    });
    userPrompt += "\nGenerate the next round, directly responding to previous arguments.";
  } else {
    userPrompt += "\nThis is the opening round. Each philosopher should establish their position.";
  }

  const openaiKey =
    request.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: mode === "roast" ? 0.9 : 0.8,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `LLM API error: ${err}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  let content = data.choices[0].message.content.trim();

  if (content.startsWith("```")) {
    content = content.slice(content.indexOf("\n") + 1).replace(/```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse LLM response", raw: content },
      { status: 500 }
    );
  }
}
