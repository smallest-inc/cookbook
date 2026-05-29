/**
 * Returns the Smallest API key to the browser so the WS hooks can use it as a
 * query param. For a real production deploy, replace this with a short-lived
 * scoped token endpoint — exposing the long-lived API key to the browser is
 * fine for a single-user demo, NOT for a public-facing app.
 */
export async function GET() {
  const key = process.env.SMALLEST_API_KEY;
  if (!key) {
    return new Response("Missing SMALLEST_API_KEY in env", { status: 500 });
  }
  return new Response(JSON.stringify({ key }), {
    headers: { "Content-Type": "application/json" },
  });
}
