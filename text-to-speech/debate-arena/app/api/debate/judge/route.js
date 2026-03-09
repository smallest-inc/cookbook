import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an ancient Athenian judge presiding over a philosophical debate in the Agora. You must evaluate the arguments of Socrates and Aristotle with wisdom and impartiality.

Score each philosopher on three criteria (1-10 each):
1. Wisdom — depth of insight and philosophical reasoning
2. Rhetoric — persuasiveness and eloquence of argument
3. Logic — soundness of reasoning and quality of rebuttals

Return ONLY a JSON object (no markdown) with this structure:
{
  "winner": "socrates" or "aristotle",
  "socrates": { "wisdom": N, "rhetoric": N, "logic": N },
  "aristotle": { "wisdom": N, "rhetoric": N, "logic": N },
  "reasoning": "2-3 sentence verdict in the voice of an ancient judge"
}`;

export async function POST(request) {
  const { topic, rounds } = await request.json();

  if (!topic || !rounds) {
    return NextResponse.json(
      { error: "topic and rounds are required" },
      { status: 400 }
    );
  }

  let prompt = `The topic debated: "${topic}"\n\nFull debate transcript:\n`;
  rounds.forEach((r, i) => {
    prompt += `\nRound ${i + 1}:\n`;
    prompt += `  Socrates (FOR): "${r.socrates}"\n`;
    prompt += `  Aristotle (AGAINST): "${r.aristotle}"\n`;
  });
  prompt += "\nDeliver your verdict, O wise judge of Athens.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.headers.get("x-openai-key") || process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
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
      { error: "Failed to parse judge response", raw: content },
      { status: 500 }
    );
  }
}
