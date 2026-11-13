#!/usr/bin/env python3
"""Local board for Phone Draw.

The agent POSTs each finished picture to /frame. Open the page in a browser
to watch the board update. Standard library plus python-dotenv so a shared
.env is enough.

Usage:
    uv run board.py
    # then open http://localhost:8765

GET /state is unauthenticated. Anyone who can reach this URL can see the
latest picture.
"""
import json, os, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from dotenv import load_dotenv
load_dotenv()

TOKEN = os.getenv("BOARD_TOKEN", "")
STATE = {
    "version": 0,
    "png_b64": "",
    "caption": "",
    "status": "describe a picture to the agent",
    "history": [],
}
LOCK = threading.Lock()

PAGE = """<!doctype html><html><head><meta charset=utf-8><title>Draw it over the phone</title>
<style>body{margin:0;background:#111;color:#eee;font:20px system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh}
img{max-height:78vh;max-width:92vw;border-radius:12px;box-shadow:0 0 40px #000}#s{opacity:.7;margin:14px}#c{margin-top:8px}</style></head>
<body><img id=i hidden><div id=c></div><div id=s></div><script>
let v=-1;async function t(){try{const r=await fetch('/state');const j=await r.json();
document.getElementById('s').textContent=j.status;
if(j.version!==v){v=j.version;if(j.png_b64){const i=document.getElementById('i');i.src='data:image/png;base64,'+j.png_b64;i.hidden=false;
document.getElementById('c').textContent=j.caption;}}}catch(e){}setTimeout(t,700)}t()</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, code, body, ctype="application/json"):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path == "/":
            return self._send(200, PAGE, "text/html")
        if self.path == "/state":
            with LOCK:
                return self._send(200, json.dumps({k: STATE[k] for k in ("version", "png_b64", "caption", "status")}))
        self._send(404, "{}")

    def do_POST(self):
        if TOKEN and self.headers.get("Authorization") != f"Bearer {TOKEN}":
            return self._send(401, "{}")
        n = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(n) or b"{}")
        with LOCK:
            if self.path == "/frame":
                STATE.update(png_b64=data["png_b64"], caption=data.get("caption", ""), status="done, say what to change")
                STATE["version"] += 1
                STATE["history"].append({"t": time.time(), "caption": STATE["caption"]})
            elif self.path == "/status":
                STATE["status"] = data.get("text", "")
            else:
                return self._send(404, "{}")
        self._send(200, '{"ok":true}')


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8765))
    print(f"board on http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
