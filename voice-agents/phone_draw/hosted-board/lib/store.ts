import { get, put } from "@vercel/blob";

export type BoardState = {
  version: number;
  png_b64: string;
  caption: string;
  status: string;
};

// One blob, overwritten on every write. Reads skip the CDN cache (useCache: false)
// so the board sees each write right away, and old states never pile up.
const PATHNAME = "phone-draw/state.json";

const EMPTY: BoardState = {
  version: 0,
  png_b64: "",
  caption: "",
  status: "call the number and describe a picture",
};

export async function readState(): Promise<BoardState> {
  try {
    const res = await get(PATHNAME, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return { ...EMPTY };
    const text = await new Response(res.stream).text();
    return { ...EMPTY, ...JSON.parse(text) };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeState(state: BoardState): Promise<void> {
  await put(PATHNAME, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export function checkAuth(req: Request): boolean {
  const token = process.env.BOARD_TOKEN || "";
  if (!token) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${token}`;
}
