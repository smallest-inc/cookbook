import { readState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const state = await readState();
  return Response.json(
    {
      version: state.version,
      png_b64: state.png_b64,
      caption: state.caption,
      status: state.status,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    }
  );
}
