/**
 * LLM streaming via the **Vercel AI SDK** (`ai` package) pointed at Smallest's
 * Electron model through `@ai-sdk/openai-compatible`.
 *
 * Compare with the raw-WS sibling's `/api/chat` route: same input, same SSE
 * output shape, but no hand-rolled SSE parser and no manual stream plumbing.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

export const runtime = "edge";

const electron = createOpenAICompatible({
  name: "electron",
  apiKey: process.env.SMALLEST_API_KEY ?? "",
  baseURL: "https://api.smallest.ai/waves/v1",
});

export async function POST(req: Request) {
  if (!process.env.SMALLEST_API_KEY) {
    return new Response("Missing SMALLEST_API_KEY in env", { status: 500 });
  }
  const { message } = await req.json();

  const result = streamText({
    model: electron("electron"),
    system:
      "You are a concise, friendly voice assistant. Reply in 2-4 short sentences max. " +
      "Speak naturally, like a real conversation. Do not use markdown formatting.",
    prompt: message,
  });

  // toTextStreamResponse() emits raw text tokens — the same shape the page
  // already consumes from the raw-WS sibling, so the client code is unchanged.
  return result.toTextStreamResponse();
}
