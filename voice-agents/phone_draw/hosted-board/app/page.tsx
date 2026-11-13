"use client";
import { useEffect, useState } from "react";

type State = {
  version: number;
  png_b64: string;
  caption: string;
  status: string;
};

export default function Board() {
  const [s, setS] = useState<State>({
    version: -1,
    png_b64: "",
    caption: "",
    status: "loading...",
  });

  useEffect(() => {
    let v = -1;
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        const j = (await r.json()) as State;
        if (!alive) return;
        setS((prev) => (j.version !== v ? ((v = j.version), j) : { ...prev, status: j.status }));
      } catch {
        /* ignore transient errors */
      }
      if (alive) setTimeout(tick, 700);
    }
    tick();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main
      style={{
        margin: 0,
        background: "#111",
        color: "#eee",
        font: "20px system-ui",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      {s.png_b64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={s.caption || "drawing"}
          src={`data:image/png;base64,${s.png_b64}`}
          style={{
            maxHeight: "78vh",
            maxWidth: "92vw",
            borderRadius: 12,
            boxShadow: "0 0 40px #000",
          }}
        />
      ) : null}
      <div style={{ marginTop: 8 }}>{s.caption}</div>
      <div style={{ opacity: 0.7, margin: 14 }}>{s.status}</div>
    </main>
  );
}
