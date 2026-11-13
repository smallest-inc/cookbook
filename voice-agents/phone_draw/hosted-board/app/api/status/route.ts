import { checkAuth, readState, writeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  if (!checkAuth(req)) return Response.json({}, { status: 401 });
  const data = await req.json();
  const prev = await readState();
  await writeState({ ...prev, status: String(data.text || "") });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
