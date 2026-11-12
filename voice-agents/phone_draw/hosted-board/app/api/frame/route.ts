import { checkAuth, readState, writeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 0;

export async function POST(req: Request) {
  if (!checkAuth(req)) return Response.json({}, { status: 401 });
  const data = await req.json();
  const prev = await readState();
  const next = {
    version: prev.version + 1,
    png_b64: String(data.png_b64 || ""),
    caption: String(data.caption || ""),
    status: "done, say what to change",
  };
  await writeState(next);
  return Response.json(
    { ok: true, version: next.version },
    { headers: { "Cache-Control": "no-store" } }
  );
}
