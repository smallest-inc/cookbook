import { get, list, put } from "@vercel/blob";

export type BoardState = {
  version: number;
  png_b64: string;
  caption: string;
  status: string;
};

const PREFIX = "phone-draw/state-";

const EMPTY: BoardState = {
  version: 0,
  png_b64: "",
  caption: "",
  status: "call the number and describe a picture",
};

export async function readState(): Promise<BoardState> {
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    if (!blobs.length) return { ...EMPTY };
    blobs.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    const res = await get(blobs[0].pathname, { access: "private" });
    if (!res || res.statusCode !== 200) return { ...EMPTY };
    const text = await new Response(res.stream).text();
    return { ...EMPTY, ...JSON.parse(text) };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeState(state: BoardState): Promise<void> {
  // Unique pathname each write so we never depend on overwrite cache
  // (Blob cacheControlMaxAge cannot go below 60s on overwrite).
  const pathname = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  await put(pathname, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export function checkAuth(req: Request): boolean {
  const token = process.env.BOARD_TOKEN || "";
  if (!token) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${token}`;
}
